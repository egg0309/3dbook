"""把 sessions.db 的匿名测试记录导出为「人能直接看懂」的 CSV + HTML。

本机运行（server 目录、.venv 环境）：
    python -m app.export          # 生成 CSV 与 HTML
    python -m app.export --open   # 生成后自动用浏览器打开 HTML

不挂任何 HTTP 路由，公网访问者无法读取这些记录。
数据库保持原始结构不动；所有可读化处理都发生在导出层。
"""
import argparse
import csv
import html
import json
import sqlite3
import statistics
import sys
import webbrowser
from collections import Counter
from contextlib import closing
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.script import SCRIPT
from app.store import DB_PATH

_BEIJING = timezone(timedelta(hours=8))
_STAGE_LABELS = {
    "level1": "第1关",
    "level2": "第2关",
    "level3": "第3关",
    "review": "已到复盘",
    "done": "已完成",
}
_STAGE_KEYS = {"1": "stage_1", "2": "stage_2", "3": "stage_3"}


@dataclass
class Session:
    index: int
    client_id: str
    session_id: str
    started_at: str
    first_turn_at: str
    finished_at: str
    duration: int | None
    status: str
    last_stage: str
    steps: list[dict]
    fallback_count: int
    report: str
    updated_at: str
    attempt_no: int = 0
    intervals: list[int | None] = field(default_factory=list)

    @property
    def has_client(self) -> bool:
        return bool(self.client_id)


def _beijing(iso_text: str | None) -> str:
    if not iso_text:
        return ""
    try:
        return datetime.fromisoformat(iso_text).astimezone(_BEIJING).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
    except ValueError:
        return iso_text


def _duration_text(seconds: int | None) -> str:
    if seconds is None:
        return ""
    seconds = max(int(seconds), 0)
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def _option_label(code: str | None) -> str:
    if not code:
        return ""
    stage = _STAGE_KEYS.get(code[:1])
    if not stage:
        return code
    option = SCRIPT.get("stages", {}).get(stage, {}).get("options", {}).get(code)
    if not option:
        return code
    return f"{code} {option.get('label', '')}".strip()


def _parse_json(text: str | None) -> dict:
    try:
        data = json.loads(text or "{}")
        return data if isinstance(data, dict) else {}
    except (TypeError, ValueError):
        return {}


def _gap(start: str | None, end: str | None) -> int | None:
    if not start or not end:
        return None
    try:
        seconds = (
            datetime.fromisoformat(end) - datetime.fromisoformat(start)
        ).total_seconds()
    except ValueError:
        return None
    return max(int(seconds), 0)


def _build_intervals(row: sqlite3.Row) -> list[int | None]:
    """各关用时依据相邻时间戳推导，缺失段留空，不补 0。"""
    answers = _parse_json(row["answers_json"])

    def mark(stage: str) -> str | None:
        return (answers.get(stage) or {}).get("ts")

    anchor = row["started_at"] or row["first_turn_at"]
    level1, level2, level3 = mark("level1"), mark("level2"), mark("level3")
    end = row["finished_at"] or mark("review")
    return [
        _gap(anchor, level1),
        _gap(level1, level2),
        _gap(level2, level3),
        _gap(level3, end),
    ]


def _status_and_stage(row: sqlite3.Row) -> tuple[str, str]:
    stage = _STAGE_LABELS.get(row["stage"] or "", row["stage"] or "未开始")
    if row["finished_at"]:
        # 旧记录可能仍把 stage 停在 review，导出时以完成时间为准
        return "已完成", "已完成"
    if row["first_turn_at"]:
        return f"中途退出（停在{stage}）", stage
    if row["started_at"]:
        return "只开始未作答", stage
    return "无开始记录", stage


def _build_steps(row: sqlite3.Row) -> list[dict]:
    answers = _parse_json(row["answers_json"])
    choices = _parse_json(row["choices_json"])
    steps = []
    for number in ("1", "2", "3"):
        stage_key = f"level{number}"
        answer = answers.get(stage_key) or {}
        code = answer.get("choice") or choices.get(f"choice_{number}") or ""
        steps.append(
            {
                "label": _STAGE_LABELS[stage_key],
                "code": code,
                "option": _option_label(code),
                "time": _beijing(answer.get("ts")),
            }
        )
    return steps


def _to_session(index: int, row: sqlite3.Row) -> Session:
    status, last_stage = _status_and_stage(row)
    return Session(
        index=index,
        client_id=row["client_id"] or "",
        session_id=row["session_id"],
        started_at=_beijing(row["started_at"]),
        first_turn_at=_beijing(row["first_turn_at"]),
        finished_at=_beijing(row["finished_at"]),
        duration=row["duration_seconds"],
        status=status,
        last_stage=last_stage,
        steps=_build_steps(row),
        fallback_count=row["fallback_count"] or 0,
        report=row["report"] or "",
        updated_at=_beijing(row["updated_at"]),
        intervals=_build_intervals(row),
    )


def _load(db_path: Path) -> list[Session]:
    with closing(sqlite3.connect(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM attempts"
            " ORDER BY COALESCE(started_at, first_turn_at, updated_at)"
        ).fetchall()
    sessions = [_to_session(index, row) for index, row in enumerate(rows, 1)]
    seen: dict[str, int] = {}
    for session in sessions:
        if not session.has_client:
            continue
        seen[session.client_id] = seen.get(session.client_id, 0) + 1
        session.attempt_no = seen[session.client_id]
    return sessions


def _summary(sessions: list[Session]) -> dict:
    completed = [s for s in sessions if s.status == "已完成"]
    durations = [s.duration for s in completed if s.duration is not None]
    clients = {s.client_id for s in sessions if s.has_client}
    statuses = Counter(s.status for s in sessions)
    choice_counts = {
        step_label: Counter(
            s.steps[int(step_label[1]) - 1]["option"]
            for s in sessions
            if s.steps[int(step_label[1]) - 1]["option"]
        )
        for step_label in ("第1关", "第2关", "第3关")
    }
    return {
        "sessions": len(sessions),
        "clients": len(clients),
        "no_client": sum(1 for s in sessions if not s.has_client),
        "completed": len(completed),
        "completion_rate": (len(completed) / len(sessions) * 100) if sessions else 0,
        "avg_duration": (sum(durations) / len(durations)) if durations else None,
        "median_duration": statistics.median(durations) if durations else None,
        "fallback_sessions": sum(1 for s in sessions if s.fallback_count > 0),
        "first_record": next((s.started_at for s in sessions if s.started_at), ""),
        "last_record": max((s.updated_at for s in sessions if s.updated_at), default=""),
        "statuses": statuses,
        "choices": choice_counts,
    }


_CSV_COLUMNS = [
    "序号",
    "匿名编号",
    "同编号第几次",
    "会话ID",
    "开始时间",
    "首次作答",
    "完成时间",
    "时长",
    "时长(秒)",
    "状态",
    "最后关卡",
    "第1关用时",
    "第2关用时",
    "第3关用时",
    "复盘用时",
    "第1关选项",
    "第1关作答时间",
    "第2关选项",
    "第2关作答时间",
    "第3关选项",
    "第3关作答时间",
    "兜底次数",
    "复盘报告",
]


def _csv_row(session: Session) -> dict:
    intervals = session.intervals + [None] * (4 - len(session.intervals))
    row = {
        "序号": session.index,
        "匿名编号": session.client_id or "（无编号）",
        "同编号第几次": session.attempt_no or "",
        "会话ID": session.session_id,
        "开始时间": session.started_at,
        "首次作答": session.first_turn_at,
        "完成时间": session.finished_at,
        "时长": _duration_text(session.duration),
        "时长(秒)": session.duration if session.duration is not None else "",
        "状态": session.status,
        "最后关卡": session.last_stage,
        "第1关用时": _duration_text(intervals[0]),
        "第2关用时": _duration_text(intervals[1]),
        "第3关用时": _duration_text(intervals[2]),
        "复盘用时": _duration_text(intervals[3]),
        "兜底次数": session.fallback_count,
        "复盘报告": session.report,
    }
    for number, step in enumerate(session.steps, 1):
        row[f"第{number}关选项"] = step["option"]
        row[f"第{number}关作答时间"] = step["time"]
    return row


def _write_csv(sessions: list[Session], path: Path) -> None:
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=_CSV_COLUMNS)
        writer.writeheader()
        for session in sessions:
            writer.writerow(_csv_row(session))


def _html_escape(text: str) -> str:
    return html.escape(text or "", quote=True)


def _intervals_text(intervals: list[int | None]) -> str:
    values = intervals + [None] * (4 - len(intervals))
    return " / ".join(_duration_text(value) or "—" for value in values)


def _write_html(
    sessions: list[Session], summary: dict, path: Path, source: str
) -> None:
    generated = datetime.now(_BEIJING).strftime("%Y-%m-%d %H:%M:%S")
    avg = _duration_text(round(summary["avg_duration"]) if summary["avg_duration"] is not None else None)
    avg_text = avg or "—"
    median = _duration_text(
        round(summary["median_duration"])
        if summary["median_duration"] is not None
        else None
    )
    median_text = median or "—"

    status_rows = "".join(
        f"<tr><td>{_html_escape(status)}</td><td>{count}</td></tr>"
        for status, count in summary["statuses"].most_common()
    )
    choice_rows = []
    for stage_label, counter in summary["choices"].items():
        cells = "".join(
            f"<tr><td>{_html_escape(stage_label)}</td><td>{_html_escape(option)}</td><td>{count}</td></tr>"
            for option, count in counter.most_common()
        )
        choice_rows.append(cells)
    choice_html = "".join(choice_rows) or '<tr><td colspan="3">还没有作答记录</td></tr>'

    cards = []
    for session in sessions:
        steps = "".join(
            f'<li><span class="step-name">{_html_escape(step["label"])}</span>'
            f'<span class="step-choice">{_html_escape(step["option"] or "未作答")}</span>'
            f'<span class="step-time">{_html_escape(step["time"])}</span></li>'
            for step in session.steps
        )
        report = ""
        if session.report:
            report = (
                f'<details><summary>复盘全文（{len(session.report)} 字）</summary>'
                f'<p class="report">{_html_escape(session.report)}</p></details>'
            )
        else:
            report = '<p class="muted">未生成复盘</p>'
        badge = "done" if session.status == "已完成" else "open"
        attempt = f" · 第{session.attempt_no}次" if session.attempt_no else ""
        cards.append(
            f'<article class="session">'
            f'<div class="session-head"><span class="idx">#{session.index}</span>'
            f'<span class="badge {badge}">{_html_escape(session.status)}</span>'
            f'<span class="client">{_html_escape(session.client_id or "（无编号）")}{attempt}</span></div>'
            f'<div class="meta">开始 {_html_escape(session.started_at or "—")}'
            f' · 首次作答 {_html_escape(session.first_turn_at or "—")}'
            f' · 完成 {_html_escape(session.finished_at or "—")}'
            f' · 时长 {_html_escape(_duration_text(session.duration) or "—")}'
            f' · 各关用时 1/2/3/复盘 {_html_escape(_intervals_text(session.intervals))}'
            f' · 兜底 {session.fallback_count} 次</div>'
            f'<ul class="steps">{steps}</ul>{report}'
            f'</article>'
        )

    document = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>遵义会议内测记录</title>
<style>
  :root {{ color-scheme: light; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 28px 20px 48px; background: #f6f2ea; color: #2c241c;
         font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif; }}
  header, main {{ max-width: 1080px; margin: 0 auto; }}
  h1 {{ margin: 0 0 6px; font-size: 26px; }}
  h2 {{ margin: 30px 0 10px; font-size: 18px; }}
  .sub {{ margin: 0; color: #7a6a58; font-size: 13px; }}
  .cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 18px; }}
  .card {{ background: #fffdf8; border: 1px solid #e4d8c6; border-radius: 10px; padding: 14px 16px; }}
  .card .num {{ font-size: 24px; font-weight: 700; }}
  .card .label {{ margin-top: 4px; color: #7a6a58; font-size: 12px; }}
  table {{ width: 100%; border-collapse: collapse; background: #fffdf8; border: 1px solid #e4d8c6; border-radius: 10px; overflow: hidden; }}
  th, td {{ padding: 8px 12px; border-bottom: 1px solid #eee4d4; text-align: left; font-size: 13px; }}
  th {{ background: #efe5d5; font-weight: 600; }}
  tr:last-child td {{ border-bottom: none; }}
  .session {{ margin-top: 12px; padding: 14px 16px; background: #fffdf8; border: 1px solid #e4d8c6; border-radius: 10px; }}
  .session-head {{ display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }}
  .idx {{ color: #9c8a74; font-weight: 700; }}
  .client {{ font-family: Consolas, monospace; font-size: 12px; color: #6d5d4a; }}
  .badge {{ padding: 2px 8px; border-radius: 999px; font-size: 12px; }}
  .badge.done {{ background: #e4f2e6; color: #2f6b3a; }}
  .badge.open {{ background: #f6e8d5; color: #83561f; }}
  .meta {{ margin: 8px 0; color: #7a6a58; font-size: 12px; line-height: 1.7; }}
  .steps {{ margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 4px; }}
  .steps li {{ display: flex; flex-wrap: wrap; gap: 8px; font-size: 13px; }}
  .step-name {{ min-width: 46px; color: #9c8a74; }}
  .step-choice {{ flex: 1; min-width: 220px; }}
  .step-time {{ color: #8b7a66; font-size: 12px; }}
  details {{ margin-top: 10px; }}
  summary {{ cursor: pointer; color: #8a5a2b; font-size: 13px; }}
  .report {{ margin: 8px 0 0; padding: 12px 14px; background: #faf6ee; border-left: 3px solid #c9a97a;
             white-space: pre-wrap; line-height: 1.8; font-size: 13px; }}
  .muted {{ color: #a3937f; font-size: 13px; }}
  .note {{ margin-top: 28px; color: #8b7a66; font-size: 12px; line-height: 1.8; }}
</style>
</head>
<body>
<header>
  <h1>遵义会议内测记录</h1>
  <p class="sub">生成时间：{generated} · 数据来源：{_html_escape(source)} · 匿名记录，仅本机可见</p>
  <p class="sub">本批记录：{_html_escape(summary["first_record"] or "—")} 至 {_html_escape(summary["last_record"] or "—")}</p>
  <div class="cards">
    <div class="card"><div class="num">{summary["clients"]}</div><div class="label">匿名测试人数</div></div>
    <div class="card"><div class="num">{summary["sessions"]}</div><div class="label">会话总数</div></div>
    <div class="card"><div class="num">{summary["completed"]}</div><div class="label">完成三关会话</div></div>
    <div class="card"><div class="num">{summary["completion_rate"]:.0f}%</div><div class="label">会话完成率</div></div>
    <div class="card"><div class="num">{avg_text}</div><div class="label">平均完成时长</div></div>
    <div class="card"><div class="num">{median_text}</div><div class="label">完成时长中位数</div></div>
    <div class="card"><div class="num">{summary["fallback_sessions"]}</div><div class="label">触发兜底的会话</div></div>
  </div>
</header>
<main>
  <h2>状态分布</h2>
  <table><thead><tr><th>状态</th><th>会话数</th></tr></thead><tbody>{status_rows}</tbody></table>

  <h2>各关选择分布</h2>
  <table><thead><tr><th>关卡</th><th>选择</th><th>次数</th></tr></thead><tbody>{choice_html}</tbody></table>

  <h2>会话明细</h2>
  {''.join(cards) or '<p class="muted">还没有会话记录。</p>'}

  <p class="note">
    说明：匿名编号相同表示同一浏览器；换浏览器或清缓存会生成新编号，
    同一编号的多次会话按“第N次”标出。
    各关用时为相邻作答时间戳之差，包含阅读、思考和等待反馈的时间。
    未完成的会话保留在库中，但不计入平均完成时长。
    同一关重新选择只保留最后一次选项。
  </p>
</main>
</body>
</html>
"""
    path.write_text(document, encoding="utf-8")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass

    parser = argparse.ArgumentParser(description="导出匿名测试记录为 CSV 与 HTML")
    parser.add_argument(
        "--db",
        default=str(DB_PATH),
        help="要导出的数据库文件，默认 server/data/sessions.db",
    )
    parser.add_argument(
        "--open", action="store_true", help="导出后自动用浏览器打开 HTML"
    )
    args = parser.parse_args()

    db_path = Path(args.db).expanduser().resolve()
    if not db_path.exists():
        print(f"数据库不存在：{db_path}（还没有任何测试记录）")
        return

    sessions = _load(db_path)
    summary = _summary(sessions)
    stamp = datetime.now(_BEIJING).strftime("%Y%m%d-%H%M%S")
    # 无论导出当前库还是归档库，报表统一落在 data/，便于集中查看与被 .gitignore 覆盖
    output_dir = DB_PATH.parent
    csv_path = output_dir / f"export-{stamp}.csv"
    html_path = output_dir / f"export-{stamp}.html"

    _write_csv(sessions, csv_path)
    _write_html(sessions, summary, html_path, str(db_path))

    print(
        f"已导出 {summary['sessions']} 条会话、{summary['clients']} 个匿名编号"
        f"（完成 {summary['completed']} 条）"
    )
    print(f"数据源：{db_path}")
    print(f"CSV：{csv_path}")
    print(f"HTML：{html_path}")

    if args.open:
        webbrowser.open(html_path.resolve().as_uri())


if __name__ == "__main__":
    main()
