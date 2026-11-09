"""降级演练：模型端点故障时，所有生成支路都应静默回落到基准文案。

模拟方式：ReferenceAgent(fail_llm=True)。断言用户侧不报错、状态照常推进，
且回落文本非空、无内部术语。
"""
from __future__ import annotations

import pytest

from adapters import SCRIPT


def reach(agent, stage):
    session = agent.new_session()
    for code in ["1A", "2A"][: {"stage_1": 0, "stage_2": 1, "stage_3": 2}[stage]]:
        assert agent.select(code, session).advanced
    return session


def all_options():
    for stage in ("stage_1", "stage_2", "stage_3"):
        for code in SCRIPT["stages"][stage]["options"]:
            yield stage, code


@pytest.mark.parametrize("stage,code", list(all_options()))
def test_feedback_falls_back_to_baseline(agent_llm_down, stage, code):
    session = reach(agent_llm_down, stage)
    cfg = SCRIPT["stages"][stage]["options"][code]

    result = agent_llm_down.select(code, session)

    assert result.ok is True
    assert result.advanced is True
    assert result.fallback is True
    assert result.text == cfg["baseline_feedback"]
    assert result.text.strip()


def test_qa_failure_returns_friendly_reply(agent_llm_down):
    session = agent_llm_down.new_session()
    result = agent_llm_down.submit("为什么一定要开这次会？", session)

    assert result.ok is True
    assert result.advanced is False
    assert result.fallback is True
    assert result.text == SCRIPT["guardrail"]["qa_failure_reply"]
    assert session.stage == "stage_1"


def test_review_failure_uses_rule_profile(agent_llm_down):
    session = agent_llm_down.new_session()
    for code in ("1A", "2A", "3A"):
        agent_llm_down.select(code, session)

    result = agent_llm_down.build_review(session)

    assert result.content_type == "review"
    assert result.fallback is True
    assert result.text == SCRIPT["review_profiles"]["seeker"]["text"]
    assert result.finished is True
    assert result.closing == SCRIPT["review_closing"]


def test_fixed_branches_are_unaffected_by_llm_failure(agent, agent_llm_down):
    for agent_under_test in (agent, agent_llm_down):
        session = agent_under_test.new_session()
        wrong = agent_under_test.select("2A", session)
        assert wrong.content_type == "guardrail"
        assert wrong.fallback is False

        empty = agent_under_test.select("", session)
        assert empty.content_type == "fallback"
        assert empty.fallback is False


def test_fallback_texts_are_safe(agent_llm_down, forbidden):
    session = agent_llm_down.new_session()
    texts = [agent_llm_down.submit("这是什么会议？", session).text]
    texts.append(agent_llm_down.select("1A", session).text)
    for text in texts:
        assert text and text.strip()
        for term in forbidden["internal_terms"]:
            assert term.lower() not in text.lower()
