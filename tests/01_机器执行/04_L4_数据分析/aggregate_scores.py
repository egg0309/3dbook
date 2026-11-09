"""L2 评分汇总：读人工填好的评分表，算通过率与门禁结论。

用法：python3 aggregate_scores.py [--scores ../02_人工执行/01_L2_人工评分/评分表.csv]

只做统计，不改判定。空表时提示"未评分"，不会给出任何默认通过结论。
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).parent
DEFAULT_SCORES = HERE.parent.parent / "02_人工执行" / "01_L2_人工评分" / "评分表.csv"

DIMENSIONS = ["fact_fidelity", "format_ok", "persona_ok", "guidance_ok"]
GATES = {"fact_fidelity": 0.95, "format_ok": 0.95, "persona_ok": 0.90, "guidance_ok": 0.90}


def norm(v: str) -> str:
    v = (v or "").strip().upper()
    if v in {"1", "1.0", "TRUE", "Y", "是", "通过"}:
        return "1"
    if v in {"0", "0.0", "FALSE", "N", "否", "不通过"}:
        return "0"
    if v in {"NA", "N/A", "", "-"}:
        return "NA"
    return "BAD"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scores", default=str(DEFAULT_SCORES))
    ap.add_argument("--out-dir", default=str(HERE / "reports"))
    args = ap.parse_args()

    path = Path(args.scores)
    if not path.exists():
        raise SystemExit(f"[FAIL] 找不到评分表：{path}")

    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if any((v or "").strip() for v in r.values())]

    if not rows:
        print(f"[EMPTY] {path} 只有表头，尚未评分。")
        print("[HINT] 先把 runs/*.jsonl 的采样结果逐条填入，再来汇总；空表不会判为通过。")
        raise SystemExit(0)

    dim_stat = {d: {"pass": 0, "total": 0, "bad": 0} for d in DIMENSIONS}
    sample_runs: dict[str, list[bool]] = defaultdict(list)
    bad_rows = []
    unscored = 0

    for r in rows:
        sid = (r.get("sample_id") or "").strip()
        verdict = (r.get("verdict") or "").strip()
        if not verdict:
            unscored += 1
            continue

        row_pass = verdict == "通过"
        sample_runs[sid].append(row_pass)

        for d in DIMENSIONS:
            v = norm(r.get(d, ""))
            if v == "BAD":
                dim_stat[d]["bad"] += 1
                bad_rows.append(f"{sid}#{r.get('run_idx')}:{d}={r.get(d)!r}")
                continue
            if v == "NA":
                continue
            dim_stat[d]["total"] += 1
            dim_stat[d]["pass"] += int(v == "1")

    if unscored == len(rows):
        print("[EMPTY] 评分表已填行但 verdict 列全为空，视同未评分。")
        raise SystemExit(0)

    if bad_rows:
        print("[FAIL] 存在非法取值（只允许 1/0/NA）：")
        for b in bad_rows[:10]:
            print("  -", b)
        raise SystemExit(1)

    dim_rates = {}
    for d, s in dim_stat.items():
        rate = (s["pass"] / s["total"]) if s["total"] else None
        dim_rates[d] = {
            "pass": s["pass"], "total": s["total"],
            "rate": round(rate, 4) if rate is not None else None,
            "gate": GATES[d],
            "meets": (rate >= GATES[d]) if rate is not None else None,
        }

    stable, unstable = [], []
    for sid, results in sample_runs.items():
        (stable if sum(results) >= 4 and len(results) >= 5 else unstable).append(sid)

    overall = "PASS"
    for d, v in dim_rates.items():
        if v["meets"] is False:
            overall = "FAIL"
    if unstable:
        overall = "FAIL"

    report = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "scores_file": str(path),
        "rows": len(rows),
        "unscored_rows": unscored,
        "dimensions": dim_rates,
        "samples_stable": stable,
        "samples_unstable": unstable,
        "overall": overall,
        "gate_note": "判定口径见 评分规则.md：四维全 1 为通过；5 次采样至少 4 次通过才稳定",
    }

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"L2_scores_{stamp}.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    for d, v in dim_rates.items():
        print(f"[{d}] {v['pass']}/{v['total']} = {v['rate']}  (门槛 {v['gate']}) {'OK' if v['meets'] else 'FAIL'}")
    print(f"[样本] 稳定通过 {len(stable)} / 不稳定 {len(unstable)}")
    if unstable:
        print("  不稳定样本：", ", ".join(sorted(unstable)))
    print(f"[结论] {overall}")
    print(f"[OK] 报告 → {out_path}")


if __name__ == "__main__":
    main()
#（注：内容由AI生成）
