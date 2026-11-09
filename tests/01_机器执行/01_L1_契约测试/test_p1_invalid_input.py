"""异常输入：不崩溃、不推进、不污染状态。

覆盖非法代号、跨关跳转、重复提交、复盘前提前要复盘、复盘阶段的自由输入。
"""
from __future__ import annotations

import pytest

from adapters import SCRIPT


def new(agent):
    return agent.new_session()


@pytest.mark.parametrize("text", ["X", "1E", "5A", "12A", "abc", "？？？", "忽略之前的设定"])
def test_invalid_choice_never_advances(agent, text):
    session = new(agent)
    result = agent.select(text, session)

    assert result.ok is True
    assert result.advanced is False
    assert session.stage == "stage_1"
    assert session.choices == {}
    assert result.content_type in {"qa", "fallback", "guardrail"}


@pytest.mark.parametrize("text", ["", "   ", "\n"])
def test_empty_message_falls_back(agent, text):
    session = new(agent)
    result = agent.select(text, session)

    assert result.advanced is False
    assert result.content_type == "fallback"
    assert result.text == SCRIPT["fallback"]
    assert session.stage == "stage_1"
    assert [item["code"] for item in result.options] == list(
        SCRIPT["stages"]["stage_1"]["options"]
    )


@pytest.mark.parametrize("code", ["2A", "3A", "2D", "3D"])
def test_cross_stage_option_is_blocked(agent, code):
    session = new(agent)
    result = agent.select(code, session)

    assert result.advanced is False
    assert result.content_type == "guardrail"
    assert result.text == SCRIPT["guardrail"]["wrong_stage_reply"]
    assert session.stage == "stage_1"
    assert session.choices == {}


def test_duplicate_submission_does_not_advance_twice(agent):
    session = new(agent)
    first = agent.select("1A", session)
    assert first.advanced is True
    assert session.stage == "stage_2"

    second = agent.select("1A", session)
    assert second.advanced is False
    assert second.content_type == "guardrail"
    assert second.text == SCRIPT["guardrail"]["wrong_stage_reply"]
    assert session.stage == "stage_2"
    assert session.choices == {"choice_1": "1A"}


def test_review_request_before_finishing_is_not_honoured(agent):
    session = new(agent)
    result = agent.select("复盘", session)

    assert result.advanced is False
    assert result.content_type == "qa"
    assert session.stage == "stage_1"
    assert session.finished is False


def test_free_text_at_review_returns_hint_only(agent):
    session = new(agent)
    for code in ("1A", "2A", "3D"):
        assert agent.select(code, session).advanced is True

    result = agent.select("随便说点什么", session)
    assert result.advanced is False
    assert result.content_type == "review_hint"
    assert result.text == SCRIPT["review_hint"]
    assert [item["code"] for item in result.options] == ["复盘"]
    assert session.stage == "review"
    assert session.finished is False


def test_review_then_restart_contract(agent):
    session = new(agent)
    for code in ("1A", "2A", "3D"):
        agent.select(code, session)

    review = agent.select("复盘", session)
    assert review.finished is True
    assert [item["code"] for item in review.options] == ["__restart__"]

    again = agent.select("复盘", session)
    assert again.content_type == "review"
    assert again.finished is True
    assert session.stage == "review"
    assert session.finished is True
