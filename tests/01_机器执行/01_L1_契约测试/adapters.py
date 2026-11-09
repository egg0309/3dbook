"""唯一接入点：把被测智能体适配成 L1 测试可调用的三个方法。

默认 ``ReferenceAgent`` 是依据 zunyi-agent 的 ``app/router.py`` 与
``app/engine.py`` 逐条镜像的确定性实现：只读 ``fixtures/script_snapshot.json``，
不调模型、不联网。被测系统的确定性骨架若与本实现不一致，L1 应该变红——
这正是契约测试要守住的东西。

接入真实系统时只替换本文件里的三个方法体（见测试工作目录 §五）：

    select(choice, session)     非法输入不推进；合法选项推进并返回反馈
    build_review(session)       返回复盘文本（受字数与禁用词约束）
    judge_profile(tier_sequence) 与线上画像规则表一致

能力开关 ``capabilities`` 用于区分完整版与精简版：
- 完整版 zunyi-agent：自由输入走 QA（RAG），有复盘与画像；
- 精简版 3dbook/server：自由输入一律兜底，无 QA。
L1 中依赖 QA 的用例按 ``capabilities["qa"]`` 自动跳过，不会把差异当成失败。
"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"

OPTION_RE = re.compile(r"^[123][A-D]$")

REVIEW_BUTTON = [{"code": "复盘", "label": "查看我的复盘报告"}]


def _load_json(name: str) -> dict | list:
    with (FIXTURES / name).open(encoding="utf-8") as f:
        return json.load(f)


SCRIPT: dict = _load_json("script_snapshot.json")
KNOWLEDGE: list[dict] = _load_json("knowledge_snapshot.json")


@dataclass
class Session:
    """与 zunyi-agent app.session.Session 对齐的最小会话。"""

    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    stage: str = "stage_1"
    choices: dict[str, str] = field(default_factory=dict)
    messages: list[dict] = field(default_factory=list)
    finished: bool = False

    def remember(self, role: str, content: str) -> None:
        self.messages.append({"role": role, "content": content})
        del self.messages[:-8]


@dataclass
class Result:
    """一次交互的可见结果；静默字段（system/user/tier）不出现。"""

    ok: bool
    advanced: bool
    stage_after: str
    content_type: str
    text: str | None
    fallback: bool = False
    options: list[dict] = field(default_factory=list)
    title: str | None = None
    narrations: list[str] = field(default_factory=list)
    intro: str | None = None
    closing: str | None = None
    finished: bool = False
    intent: str = ""


class ReferenceAgent:
    """确定性参考实现：镜像线上 router / engine 的判定规则。"""

    capabilities = {"qa": True, "review": True, "llm": False}

    def __init__(self, *, fail_llm: bool = False) -> None:
        self.script = SCRIPT
        self.fail_llm = fail_llm

    # ---- 测试用辅助 -------------------------------------------------
    def new_session(self) -> Session:
        return Session()

    @property
    def guardrail(self) -> dict:
        return self.script["guardrail"]

    def option_buttons(self, stage: str) -> list[dict]:
        options = self.script["stages"][stage]["options"]
        return [{"code": code, "label": cfg["label"]} for code, cfg in options.items()]

    def option_cfg(self, stage: str, code: str) -> dict:
        return self.script["stages"][stage]["options"][code]

    # ---- 文档约定的三个接入方法 -------------------------------------
    def select(self, choice: str, session: Session) -> Result:
        """提交一个选项；非选项文本按完整版的自由输入路由处理。"""
        text = (choice or "").strip()

        if session.stage == "review":
            if text == "复盘":
                return self.build_review(session)
            return self._fixed(
                session,
                self.script["review_hint"],
                "review_hint",
                options=REVIEW_BUTTON,
                title=None,
                intent="review_hint",
            )

        if OPTION_RE.match(text):
            allowed = self.script["stages"][session.stage]["options"]
            if text in allowed:
                return self._drama(session, text)
            return self._fixed(
                session,
                self.guardrail["wrong_stage_reply"],
                "guardrail",
                options=self.option_buttons(session.stage),
                title=self.script["stages"][session.stage]["title"],
                intent="guardrail:wrong_stage_reply",
            )

        # 完整版：非选项文本走 QA / 护栏；精简版应在这里统一兜底。
        return self.submit(choice, session)

    def build_review(self, session: Session) -> Result:
        """按三关选择生成复盘；LLM 故障时使用规则画像文本。"""
        evidence: dict[str, object] = {}
        tiers: list[int] = []
        codes: list[str | None] = []
        for i in (1, 2, 3):
            code = session.choices.get(f"choice_{i}")
            cfg = self.script["stages"][f"stage_{i}"]["options"].get(code) if code else None
            codes.append(code)
            if cfg is None:
                evidence[f"label_{i}"] = "未作答"
                evidence[f"trait_{i}"] = "证据缺失"
                evidence[f"tier_{i}"] = 1
                tiers.append(1)
            else:
                evidence[f"label_{i}"] = cfg["label"]
                evidence[f"trait_{i}"] = cfg["trait"]
                evidence[f"tier_{i}"] = cfg["tier"]
                tiers.append(cfg["tier"])

        profile_key = self.judge_profile_codes(codes)
        profile = self.script["review_profiles"][profile_key]
        session.finished = True
        return Result(
            ok=True,
            advanced=True,
            stage_after=session.stage,
            content_type="review",
            text=profile["text"],
            fallback=self.fail_llm,
            options=[{"code": "__restart__", "label": "重新推演一遍"}],
            title=None,
            narrations=[],
            closing=self.script["review_closing"],
            finished=True,
            intent="review",
        )

    def judge_profile(self, tier_sequence: Iterable[int]) -> str:
        """只依据层级序列判画像（tier_sequence 契约）。

        注意：线上规则里 ``3B`` 优先于层级判定，仅凭 tier 无法识别，
        这类样本请用 :meth:`judge_profile_codes`。
        """
        tiers = list(tier_sequence)
        if len(tiers) != 3:
            raise ValueError("tier_sequence 必须是三关的层级序列")
        if tiers.count(3) >= 2 and 1 not in tiers:
            return "seeker"
        if tiers[0] == 1 and tiers[1] >= 2 and tiers[2] >= 2:
            return "growing"
        if tiers.count(1) >= 2:
            return "warm"
        return "cautious"

    def judge_profile_codes(self, codes: Iterable[str | None]) -> str:
        """线上完整规则：与 zunyi-agent engine.rule_profile_key 一致。"""
        codes = list(codes)
        if len(codes) != 3:
            raise ValueError("codes 必须是三关的选项序列")
        tiers: list[int] = []
        for i, code in enumerate(codes, start=1):
            cfg = self.script["stages"][f"stage_{i}"]["options"].get(code) if code else None
            tiers.append(cfg["tier"] if cfg else 1)

        if tiers.count(3) >= 2 and 1 not in tiers:
            return "seeker"
        if tiers[0] == 1 and tiers[1] >= 2 and tiers[2] >= 2:
            return "growing"
        if codes[2] == "3B" or tiers.count(1) >= 2:
            return "warm"
        return "cautious"

    # ---- 自由输入 ---------------------------------------------------
    def submit(self, raw_text: str, session: Session) -> Result:
        """完整版自由输入路由：空 → 兜底；复盘阶段 → 复盘提示；护栏 → 固定话术；其余 → QA。"""
        text = (raw_text or "").strip()
        if not text:
            return self._fixed(
                session,
                self.script["fallback"],
                "fallback",
                options=self.option_buttons(session.stage)
                if session.stage in self.script["stages"]
                else REVIEW_BUTTON,
                title=self.script["stages"][session.stage]["title"]
                if session.stage in self.script["stages"]
                else None,
                intent="fallback",
            )

        intent = self.classify(session, text)
        kind = intent[0]

        if kind == "review":
            return self.build_review(session)
        if kind == "review_hint":
            return self._fixed(
                session,
                self.script["review_hint"],
                "review_hint",
                options=REVIEW_BUTTON,
                title=None,
                intent="review_hint",
            )
        if kind == "guardrail":
            key, reply = intent[1], self.guardrail[intent[1]]
            session.remember("user", text)
            session.remember("assistant", reply)
            return self._fixed(
                session,
                reply,
                "guardrail",
                options=self.option_buttons(session.stage),
                title=self.script["stages"][session.stage]["title"],
                intent=f"guardrail:{key}",
            )
        if kind == "drama":
            return self._drama(session, intent[1])

        # QA：参考实现不调模型；只验证路由、状态与保密性。
        session.remember("user", text)
        if self.fail_llm:
            reply = self.guardrail["qa_failure_reply"]
            return self._qa_result(
                session, reply, fallback=True, intent="qa:fallback"
            )
        return self._qa_result(session, None, fallback=False, intent="qa")

    def classify(self, session: Session, raw_text: str) -> tuple:
        """与 zunyi-agent router.classify 一致的意图路由。"""
        text = raw_text.strip()
        guard = self.guardrail

        if session.stage == "review":
            return ("review",) if text == "复盘" else ("review_hint",)

        if OPTION_RE.match(text):
            allowed = self.script["stages"][session.stage]["options"]
            if text in allowed:
                return ("drama", text)
            return ("guardrail", "wrong_stage_reply")

        if any(kw in text for kw in guard["future_event_keywords"]):
            return ("guardrail", "future_event_reply")

        if any(kw in text for kw in guard["modern_keywords"]):
            return ("guardrail", "out_of_time_reply")

        return ("qa", text)

    # ---- 内部 -------------------------------------------------------
    def _drama(self, session: Session, code: str) -> Result:
        stage_name = session.stage
        stage = self.script["stages"][stage_name]
        opt = stage["options"][code]
        stage_num = int(stage_name.split("_")[1])

        session.choices[f"choice_{stage_num}"] = code
        session.remember("user", f"{code} {opt['label']}")

        next_stage = f"stage_{stage_num + 1}"
        session.stage = "review" if next_stage not in self.script["stages"] else next_stage

        if session.stage == "review":
            options, intro, title = REVIEW_BUTTON, None, None
        else:
            next_cfg = self.script["stages"][session.stage]
            options = self.option_buttons(session.stage)
            intro = next_cfg["intro"]
            title = next_cfg["title"]

        return Result(
            ok=True,
            advanced=True,
            stage_after=session.stage,
            content_type="feedback",
            text=opt["baseline_feedback"],
            fallback=self.fail_llm,
            options=options,
            title=title,
            narrations=list(self.script["narrations"][stage["after_narration"]]),
            intro=intro,
            finished=False,
            intent="drama",
        )

    def _fixed(
        self,
        session: Session,
        text: str,
        content_type: str,
        *,
        options: list[dict],
        title: str | None,
        intent: str,
    ) -> Result:
        return Result(
            ok=True,
            advanced=False,
            stage_after=session.stage,
            content_type=content_type,
            text=text,
            fallback=False,
            options=options,
            title=title,
            finished=session.finished,
            intent=intent,
        )

    def _qa_result(
        self, session: Session, text: str | None, *, fallback: bool, intent: str
    ) -> Result:
        return Result(
            ok=True,
            advanced=False,
            stage_after=session.stage,
            content_type="qa",
            text=text,
            fallback=fallback,
            options=self.option_buttons(session.stage)
            if session.stage in self.script["stages"]
            else REVIEW_BUTTON,
            title=self.script["stages"][session.stage]["title"]
            if session.stage in self.script["stages"]
            else None,
            intent=intent,
        )
