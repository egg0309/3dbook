"""四类画像与兜底：规则画像必须可复现、可解释。

覆盖：四种画像各一组代表性选择、3B 特例优先级、全部 64 种组合均有定档、
未答完时的规则兜底，以及 build_review 选取的固定画像文本。
"""
from __future__ import annotations

import itertools

import pytest

from adapters import SCRIPT

PROFILE_CASES = {
    "seeker": ["1A", "2A", "3A"],
    "growing": ["1C", "2A", "3D"],
    "warm": ["1C", "2A", "3B"],
    "cautious": ["1B", "2A", "3A"],
}


def play(agent, codes):
    session = agent.new_session()
    for code in codes:
        assert agent.select(code, session).advanced is True
    return session


@pytest.mark.parametrize("profile_key,codes", PROFILE_CASES.items())
def test_known_sequences_hit_expected_profile(agent, profile_key, codes):
    session = play(agent, codes)
    assert session.stage == "review"
    assert agent.judge_profile_codes(codes) == profile_key

    result = agent.build_review(session)
    assert result.content_type == "review"
    assert result.text == SCRIPT["review_profiles"][profile_key]["text"]
    assert result.finished is True
    assert session.finished is True


def test_three_b_takes_precedence_over_tier_rule(agent):
    codes = ["1A", "2A", "3B"]
    tiers = [
        SCRIPT["stages"][f"stage_{i}"]["options"][code]["tier"]
        for i, code in enumerate(codes, start=1)
    ]
    assert tiers == [3, 3, 1]
    assert agent.judge_profile_codes(codes) == "warm"
    # tier 序列本身看不到 3B，这正是文档标注的已知边界
    assert agent.judge_profile(tiers) != "warm"


def test_all_sixty_four_combinations_have_a_profile(agent):
    stage_codes = [
        list(SCRIPT["stages"][stage]["options"]) for stage in ("stage_1", "stage_2", "stage_3")
    ]
    seen = set()
    for codes in itertools.product(*stage_codes):
        key = agent.judge_profile_codes(codes)
        assert key in SCRIPT["review_profiles"], codes
        seen.add(key)
    assert seen == set(SCRIPT["review_profiles"])


def test_incomplete_session_falls_back_to_rule_profile(agent):
    session = agent.new_session()
    result = agent.build_review(session)

    assert result.content_type == "review"
    assert result.text == SCRIPT["review_profiles"]["warm"]["text"]
    assert result.finished is True
    assert result.closing == SCRIPT["review_closing"]


@pytest.mark.parametrize("profile_key", list(PROFILE_CASES))
def test_review_profiles_have_name_and_text(agent, profile_key):
    profile = SCRIPT["review_profiles"][profile_key]
    assert profile["name"].strip()
    assert profile["text"].strip()
    assert len(profile["text"]) >= 80
