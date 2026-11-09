from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from adapters import ReferenceAgent, SCRIPT  # noqa: E402


@pytest.fixture(scope="session")
def script() -> dict:
    return SCRIPT


@pytest.fixture(scope="session")
def forbidden() -> dict:
    path = HERE / "fixtures" / "forbidden_terms.json"
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture()
def agent() -> ReferenceAgent:
    """默认参考实现（无模型故障）。"""
    return ReferenceAgent()


@pytest.fixture()
def agent_llm_down() -> ReferenceAgent:
    """模拟 LLM 端点故障：所有生成类文本应静默降级到兜底文案。"""
    return ReferenceAgent(fail_llm=True)
