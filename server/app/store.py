"""匿名测试记录落库（SQLite 单文件，标准库实现，无外部依赖）。

每个 session_id 对应一次测试，按请求做幂等 upsert：
- record_start：进入推演时打点，只在首次写入 started_at；
- record_turn：每次 /api/chat 后更新关卡、选项、时间戳与复盘。
所有写失败只告警、不抛异常，持久化永远不能拖垮对话主链路。
"""
import json
import logging
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("zunyi")

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "sessions.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS attempts (
    session_id TEXT PRIMARY KEY,
    client_id TEXT,
    started_at TEXT,
    first_turn_at TEXT,
    finished_at TEXT,
    duration_seconds INTEGER,
    stage TEXT,
    choices_json TEXT,
    answers_json TEXT,
    fallback_count INTEGER NOT NULL DEFAULT 0,
    report TEXT,
    updated_at TEXT
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=10000")
    return conn


def init_db() -> None:
    try:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        with closing(_connect()) as conn:
            conn.execute(_SCHEMA)
            conn.commit()
    except Exception:
        logger.exception("初始化记录数据库失败")


def record_start(session_id: str, client_id: str | None) -> None:
    if not session_id:
        return
    try:
        now = _now()
        with closing(_connect()) as conn:
            row = conn.execute(
                "SELECT 1 FROM attempts WHERE session_id=?", (session_id,)
            ).fetchone()
            if row is None:
                conn.execute(
                    "INSERT INTO attempts(session_id, client_id, started_at, fallback_count, updated_at)"
                    " VALUES(?,?,?,?,?)",
                    (session_id, client_id, now, 0, now),
                )
            else:
                # 重复打点不覆盖 started_at，仅补匿名编号
                conn.execute(
                    "UPDATE attempts SET client_id=COALESCE(?, client_id), updated_at=?"
                    " WHERE session_id=?",
                    (client_id, now, session_id),
                )
            conn.commit()
    except Exception:
        logger.warning("record_start 写入失败", exc_info=True)


def record_turn(payload: dict, result: dict) -> None:
    session_id = payload.get("sessionId")
    if not session_id:
        return
    try:
        now = _now()
        stage = payload.get("stage") or ""
        choice = payload.get("choice") or None
        client_id = payload.get("clientId") or None
        incoming_choices = payload.get("choices") or {}
        is_fallback = bool(result.get("fallback"))
        report = result.get("report")
        finished = result.get("nextStage") == "done" or bool(report)

        with closing(_connect()) as conn:
            row = conn.execute(
                "SELECT * FROM attempts WHERE session_id=?", (session_id,)
            ).fetchone()

            if row is None:
                answers: dict = {}
                choices: dict = dict(incoming_choices)
                fallback_count = 0
                started_at = None
                first_turn_at = now
            else:
                answers = json.loads(row["answers_json"] or "{}")
                # 选项只增不减：合并历史与本次，避免早期关卡重试带空 choices 造成回退
                choices = {
                    **json.loads(row["choices_json"] or "{}"),
                    **incoming_choices,
                }
                fallback_count = row["fallback_count"] or 0
                started_at = row["started_at"]
                first_turn_at = row["first_turn_at"] or now

            # 同关重试覆盖该关条目，不追加重复项 → 幂等
            if stage:
                answers[stage] = {"choice": choice, "ts": now}
            if is_fallback:
                fallback_count += 1

            finished_at = now if finished else None
            recorded_stage = "done" if finished else stage
            duration = None
            if finished:
                anchor = started_at or first_turn_at
                try:
                    duration = max(
                        int(
                            (
                                datetime.now(timezone.utc)
                                - datetime.fromisoformat(anchor)
                            ).total_seconds()
                        ),
                        0,
                    )
                except (TypeError, ValueError):
                    duration = None

            choices_text = json.dumps(choices, ensure_ascii=False)
            answers_text = json.dumps(answers, ensure_ascii=False)

            if row is None:
                conn.execute(
                    "INSERT INTO attempts(session_id, client_id, started_at, first_turn_at, finished_at,"
                    " duration_seconds, stage, choices_json, answers_json, fallback_count, report, updated_at)"
                    " VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        session_id,
                        client_id,
                        started_at,
                        first_turn_at,
                        finished_at,
                        duration,
                        recorded_stage,
                        choices_text,
                        answers_text,
                        fallback_count,
                        report,
                        now,
                    ),
                )
            else:
                conn.execute(
                    "UPDATE attempts SET client_id=COALESCE(?, client_id), first_turn_at=?,"
                    " finished_at=COALESCE(?, finished_at), duration_seconds=COALESCE(?, duration_seconds),"
                    " stage=?, choices_json=?, answers_json=?, fallback_count=?,"
                    " report=COALESCE(?, report), updated_at=? WHERE session_id=?",
                    (
                        client_id,
                        first_turn_at,
                        finished_at,
                        duration,
                        recorded_stage,
                        choices_text,
                        answers_text,
                        fallback_count,
                        report,
                        now,
                        session_id,
                    ),
                )
            conn.commit()
    except Exception:
        logger.warning("record_turn 写入失败", exc_info=True)
