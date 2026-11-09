"""12 选项黄金路径：三关每关四个选项，逐条走一遍。

断言的是确定性骨架：合法选项必须推进一关、返回该选项的基准反馈、
旁白与下一关引导语与 script.json 完全一致；到第三关后进入复盘入口。
"""
from __future__ import annotations

import pytest

from adapters import SCRIPT

STAGES = ["stage_1", "stage_2", "stage_3"]
DEFAULT_PATH = ["1A", "2A"]


def reach(agent, stage: str):
    session = agent.new_session()
    for code in DEFAULT_PATH[: STAGES.index(stage)]:
        result = agent.select(code, session)
        assert result.advanced, f"前置路径 {code} 未推进"
    assert session.stage == stage
    return session


def all_options():
    for stage in STAGES:
        for code in SCRIPT["stages"][stage]["options"]:
            yield stage, code


def test_twelve_options_present():
    options = list(all_options())
    assert len(options) == 12
    assert len({code for _, code in options}) == 12


@pytest.mark.parametrize("stage,code", list(all_options()))
def test_option_advances_with_baseline_feedback(agent, stage, code):
    session = reach(agent, stage)
    cfg = SCRIPT["stages"][stage]["options"][code]

    result = agent.select(code, session)

    assert result.ok is True
    assert result.advanced is True
    assert result.content_type == "feedback"
    assert result.text == cfg["baseline_feedback"]
    assert session.choices[f"choice_{stage.split('_')[1]}"] == code

    stage_num = int(stage.split("_")[1])
    expected = "review" if stage_num == 3 else f"stage_{stage_num + 1}"
    assert result.stage_after == expected
    assert session.stage == expected
    assert result.narrations == SCRIPT["narrations"][
        SCRIPT["stages"][stage]["after_narration"]
    ]
    assert result.finished is False

    if expected == "review":
        assert [item["code"] for item in result.options] == ["复盘"]
        assert result.title is None
        assert result.intro is None
    else:
        next_cfg = SCRIPT["stages"][expected]
        assert [item["code"] for item in result.options] == list(next_cfg["options"])
        assert result.title == next_cfg["title"]
        assert result.intro == next_cfg["intro"]


@pytest.mark.parametrize("stage,code", list(all_options()))
def test_option_evidence_package_is_complete(agent, stage, code):
    cfg = SCRIPT["stages"][stage]["options"][code]
    assert cfg["tier"] in (1, 2, 3)
    assert cfg["trait"].strip()
    assert cfg["fact_points"], f"{code} 缺少事实要点"
    assert cfg["baseline_feedback"].strip()
    assert len(cfg["baseline_feedback"]) >= 40


def test_full_path_reaches_review_and_restart(agent):
    session = agent.new_session()
    for code in ("1A", "2A", "3D"):
        assert agent.select(code, session).advanced is True

    assert session.stage == "review"
    result = agent.select("复盘", session)

    assert result.content_type == "review"
    assert result.finished is True
    assert session.finished is True
    assert result.closing == SCRIPT["review_closing"]
    assert [item["code"] for item in result.options] == ["__restart__"]
