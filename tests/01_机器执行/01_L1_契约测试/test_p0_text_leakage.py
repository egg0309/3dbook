"""分级保密性：学生可见文本不得出现内部术语、选项代号、Markdown。

范围：全部固定文本（12 条基准反馈、4 条画像、护栏/兜底/复盘提示、旁白、金句），
以及运行期返回的文本与选项结构。旁白属于史实叙述，只做禁用词与格式断言。
"""
from __future__ import annotations

import re

import pytest

from adapters import SCRIPT

CODE_RE = re.compile(r"[123][A-D]")
INTERNAL_FIELDS = ["tier", "trait", "fact_points"]


def fixed_texts(script):
    for stage in script["stages"].values():
        for cfg in stage["options"].values():
            yield f"反馈 {cfg['label']}", cfg["baseline_feedback"]
    for key, profile in script["review_profiles"].items():
        yield f"画像 {key}", profile["text"]
    for key in ("fallback", "review_hint", "review_closing"):
        yield key, script[key]
    for key in ("future_event_reply", "out_of_time_reply", "wrong_stage_reply", "qa_failure_reply"):
        yield f"护栏 {key}", script["guardrail"][key]
    for name, segments in script["narrations"].items():
        for i, segment in enumerate(segments, 1):
            yield f"旁白 {name}-{i}", segment


def _reach(agent, stage):
    session = agent.new_session()
    for code in ["1A", "2A"][: {"stage_1": 0, "stage_2": 1, "stage_3": 2}[stage]]:
        assert agent.select(code, session).advanced
    return session


def runtime_texts(agent):
    for stage in ("stage_1", "stage_2", "stage_3"):
        for code in SCRIPT["stages"][stage]["options"]:
            session = _reach(agent, stage)
            result = agent.select(code, session)
            yield f"{stage}-{code} 反馈", result.text
            for label in result.narrations:
                yield f"{stage}-{code} 旁白", label
            if result.title:
                yield f"{stage}-{code} 标题", result.title
            if result.intro:
                yield f"{stage}-{code} 引导", result.intro
            for option in result.options:
                assert set(option) == {"code", "label"}
                yield f"{stage}-{code} 选项", option["label"]

    session = _reach(agent, "stage_3")
    agent.select("3D", session)
    review = agent.select("复盘", session)
    yield "复盘", review.text
    yield "复盘金句", review.closing
    for option in review.options:
        yield "复盘选项", option["label"]


@pytest.mark.parametrize("label,text", list(fixed_texts(SCRIPT)))
def test_fixed_text_has_no_internal_leak(label, text, forbidden):
    assert text.strip(), f"{label} 为空"
    lowered = text.lower()
    for term in forbidden["internal_terms"]:
        assert term.lower() not in lowered, f"{label} 出现内部术语：{term}"
    for field in INTERNAL_FIELDS:
        assert field not in lowered, f"{label} 出现内部字段名：{field}"
    for name in forbidden["profile_names"]:
        assert name not in text, f"{label} 出现画像名：{name}"
    assert not CODE_RE.search(text), f"{label} 出现选项代号"
    for marker in forbidden["markdown_markers"]:
        assert marker not in text, f"{label} 出现 Markdown 标记：{marker}"


def test_runtime_results_do_not_expose_internal_fields(agent, forbidden):
    for label, text in runtime_texts(agent):
        assert text, f"{label} 为空"
        lowered = text.lower()
        for term in forbidden["internal_terms"]:
            assert term.lower() not in lowered, f"{label} 泄露：{term}"
        assert not CODE_RE.search(text), f"{label} 泄露选项代号"


def test_result_object_has_no_hidden_fields(agent):
    session = agent.new_session()
    result = agent.select("1A", session)
    for field in INTERNAL_FIELDS:
        assert not hasattr(result, field)
    for option in result.options:
        assert set(option) == {"code", "label"}
