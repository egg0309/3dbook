"""前端 /api/chat 契约的无状态适配层。

前端每次请求自带 stage 与累计 choices，后端不维护会话，
同一 payload 重试不会重复推进状态，满足契约的幂等要求。
响应固定为 {reply, nextStage, report?, fallback?}。
"""
import logging

from app import llm
from app.script import SCRIPT

logger = logging.getLogger("zunyi")

STAGE_MAP = {"level1": "stage_1", "level2": "stage_2", "level3": "stage_3"}
NEXT_STAGE = {"level1": "level2", "level2": "level3", "level3": "review"}
REVIEW_REPLY = "老陈把一张写满字的纸递给你，上面是他替你整理的这一路推演复盘。"


def handle_turn(payload: dict) -> dict:
    stage = payload.get("stage", "")
    choice = (payload.get("choice") or "").strip()
    message = (payload.get("message") or "").strip()
    choices = payload.get("choices") or {}

    if stage in STAGE_MAP:
        return _handle_level(stage, choice, message)
    if stage == "review":
        return _handle_review(message, choices)

    logger.warning("未知 stage=%r，返回兜底", stage)
    return {"reply": SCRIPT["fallback"], "nextStage": "level1", "fallback": True}


def _handle_level(stage: str, choice: str, message: str) -> dict:
    stage_name = STAGE_MAP[stage]
    options = SCRIPT["stages"][stage_name]["options"]

    if choice and choice in options:
        system_prompt, user_prompt, baseline = _build_feedback(stage_name, choice)
        try:
            reply = llm.chat(system_prompt, user_prompt)
        except RuntimeError as exc:
            logger.warning("反馈生成故障，降级基准文案：%s", exc)
            reply = baseline
        return {"reply": reply, "nextStage": NEXT_STAGE[stage]}

    # 自由输入或代号与当前关不匹配：按契约统一兜底，阶段不变
    return {"reply": SCRIPT["fallback"], "nextStage": stage, "fallback": True}


def _build_feedback(stage_name: str, code: str) -> tuple[str, str, str]:
    stage = SCRIPT["stages"][stage_name]
    opt = stage["options"][code]
    user_prompt = SCRIPT["feedback_user_template"].format(
        stage_title=stage["title"],
        stage_focus=stage["focus"],
        option_label=opt["label"],
        strategy_text=SCRIPT["feedback_strategies"][str(opt["tier"])],
        trait=opt["trait"],
        fact_points="\n".join(f"{i + 1}. {p}" for i, p in enumerate(opt["fact_points"])),
        baseline_feedback=opt["baseline_feedback"],
    )
    return SCRIPT["feedback_system_prompt"], user_prompt, opt["baseline_feedback"]


def _handle_review(message: str, choices: dict) -> dict:
    if message != "复盘":
        return {"reply": SCRIPT["review_hint"], "nextStage": "review"}

    system_prompt, user_prompt, fallback_report = _build_review(choices)
    try:
        review_text = llm.chat(system_prompt, user_prompt)
    except RuntimeError as exc:
        logger.warning("复盘生成故障，降级规则画像：%s", exc)
        review_text = fallback_report

    report = f"{review_text}\n\n{SCRIPT['review_closing']}"
    return {"reply": REVIEW_REPLY, "nextStage": "done", "report": report}


def _build_review(choices: dict) -> tuple[str, str, str]:
    evidence = {}
    codes = []
    tiers = []
    for i in (1, 2, 3):
        code = choices.get(f"choice_{i}")
        cfg = (
            SCRIPT["stages"][f"stage_{i}"]["options"].get(code)
            if code else None
        )
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

    user_prompt = SCRIPT["review_user_template"].format(**evidence)
    profile = SCRIPT["review_profiles"][_rule_profile_key(tiers, codes)]
    fallback_report = f"{profile['text']}\n\n{SCRIPT['review_closing']}"
    return SCRIPT["review_system_prompt"], user_prompt, fallback_report


def _rule_profile_key(tiers: list[int], codes: list) -> str:
    """LLM 复盘故障时的确定性画像定档规则。"""
    if tiers.count(3) >= 2 and 1 not in tiers:
        return "seeker"
    if tiers[0] == 1 and tiers[1] >= 2 and tiers[2] >= 2:
        return "growing"
    if codes[2] == "3B" or tiers.count(1) >= 2:
        return "warm"
    return "cautious"
