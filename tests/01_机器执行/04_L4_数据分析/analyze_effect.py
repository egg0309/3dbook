"""L4 效果分析：前测/后测知识增益 + 体验量表 + 可用性汇总。

用法：
    python analyze_effect.py [--pre-post ...] [--survey ...] [--usability ...] [--raw ...]

口径（见 快速施测包.md）：
- 知识增益 = 后测均分 − 前测均分，门槛 ≥ 1.0；
- 提升比例 = 后测高于前测的人数 / 前后测都完成的人数，门槛 ≥ 60%；
- 沉浸 / 信任 / 再用 三个维度各 3 题，均值门槛 ≥ 3.5；
- 可用性没有观察记录就写“未完成”，不拿设计目标人数充数。

原始导出里没有“是否走完三关”，另给出用时 ≥ 300 秒的敏感性分析（标注为探索性）。
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEST_ROOT = HERE.parent.parent
L4 = TEST_ROOT / "02_人工执行" / "03_L4_真人测试"

GATES = {"gain": 1.0, "improvement_rate": 0.60, "dimension_mean": 3.5}
DIMENSIONS = {"immersion": ["immersion_1", "immersion_2", "immersion_3"],
              "trust": ["trust_1", "trust_2", "trust_3"],
              "reuse": ["reuse_1", "reuse_2", "reuse_3"]}


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return [r for r in csv.DictReader(f) if any((v or "").strip() for v in r.values())]


def seconds(text: str) -> int | None:
    m = re.search(r"(\d+)", text or "")
    return int(m.group(1)) if m else None


def knowledge_stats(rows: list[dict]) -> dict:
    paired = [r for r in rows if (r.get("pre_score") or "").strip() and (r.get("post_score") or "").strip()]
    pre = [int(r["pre_score"]) for r in paired]
    post = [int(r["post_score"]) for r in paired]
    n = len(paired)
    improved = sum(b > a for a, b in zip(pre, post))
    stats = {
        "n_paired": n,
        "pre_mean": round(sum(pre) / n, 3) if n else None,
        "post_mean": round(sum(post) / n, 3) if n else None,
        "gain": round((sum(post) - sum(pre)) / n, 3) if n else None,
        "improved": improved,
        "unchanged": sum(b == a for a, b in zip(pre, post)),
        "declined": sum(b < a for a, b in zip(pre, post)),
        "improvement_rate": round(improved / n, 4) if n else None,
    }
    stats["gate_gain"] = {"threshold": GATES["gain"],
                          "meets": stats["gain"] >= GATES["gain"] if n else None}
    stats["gate_improvement_rate"] = {"threshold": GATES["improvement_rate"],
                                      "meets": stats["improvement_rate"] >= GATES["improvement_rate"] if n else None}
    return stats


def dimension_stats(rows: list[dict]) -> dict:
    out = {}
    for name, cols in DIMENSIONS.items():
        vals = []
        for r in rows:
            for c in cols:
                v = (r.get(c) or "").strip()
                if v:
                    vals.append(int(v))
        mean = round(sum(vals) / len(vals), 3) if vals else None
        out[name] = {
            "n_items": len(vals),
            "mean": mean,
            "gate": GATES["dimension_mean"],
            "meets": mean >= GATES["dimension_mean"] if vals else None,
        }
    return out


def usability_stats(rows: list[dict]) -> dict:
    if not rows:
        return {"status": "未完成", "n": 0,
                "note": "没有观察记录；按施测包要求写“未完成”，不用设计目标人数充数。"}
    n = len(rows)
    indep = {}
    for key in ("t1_independent", "t2_independent", "t3_independent"):
        vals = [(r.get(key) or "").strip() for r in rows]
        vals = [v for v in vals if v]
        indep[key] = round(sum(v == "1" for v in vals) / len(vals), 4) if vals else None
    return {"status": "已完成", "n": n, "independent_rate": indep}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pre-post", default=str(L4 / "03_数据录入" / "pre_post.csv"))
    ap.add_argument("--survey", default=str(L4 / "03_数据录入" / "survey.csv"))
    ap.add_argument("--usability", default=str(L4 / "03_数据录入" / "usability.csv"))
    ap.add_argument("--raw", default=str(L4 / "结果" / "遵义会议_v1.csv"),
                    help="问卷星原始导出，仅用于用时敏感性分析")
    ap.add_argument("--out-dir", default=str(HERE / "reports"))
    args = ap.parse_args()

    pp = read_csv(Path(args.pre_post))
    survey = read_csv(Path(args.survey))
    usability = read_csv(Path(args.usability))
    if not pp:
        raise SystemExit(f"[EMPTY] {args.pre_post} 只有表头，先运行 import_questionnaire.py")

    knowledge = knowledge_stats(pp)
    dims = dimension_stats(survey)
    usable = usability_stats(usability)

    sensitivity = None
    raw_path = Path(args.raw)
    if raw_path.exists():
        raw = read_csv(raw_path)
        # 问卷星导出“序号”唯一；用时列名为“所用时间”
        time_col = next((k for k in raw[0] if "所用时间" in k), None)
        slow = set()
        if time_col:
            for r in raw:
                s = seconds(r.get(time_col, ""))
                if s is not None and s >= 300:
                    slow.add(r["序号"].strip() if "序号" in r else r[list(r)[0]].strip())
        slow_rows = [r for r in pp if (r.get("participant_id") or "").strip() in slow]
        if slow_rows:
            sensitivity = knowledge_stats(slow_rows)
            sensitivity["note"] = "用时≥300秒的敏感性分析，属于探索性分组，不是正式判定口径。"

    effect_meets = all(v.get("meets") for v in (knowledge["gate_gain"], knowledge["gate_improvement_rate"]))
    effect_meets = effect_meets and all(d["meets"] for d in dims.values())

    report = {
        "generated_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "files": {"pre_post": args.pre_post, "survey": args.survey, "usability": args.usability},
        "knowledge": knowledge,
        "dimensions": dims,
        "usability": usable,
        "sensitivity_duration_ge_300s": sensitivity,
        "overall_effect": "PASS" if effect_meets else "FAIL",
        "gate_note": "门槛：知识增益≥1.0、提升比例≥60%、三维度均值≥3.5；可用性单独判定。",
    }

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = __import__("datetime").datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"L4_effect_{stamp}.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    k = knowledge
    print(f"[配对样本] {k['n_paired']} 人")
    print(f"[知识] 前测 {k['pre_mean']} → 后测 {k['post_mean']}，增益 {k['gain']} (门槛≥1.0) "
          f"{'OK' if k['gate_gain']['meets'] else 'FAIL'}")
    print(f"[提升] {k['improved']}/{k['n_paired']} = {k['improvement_rate']} (门槛≥60%) "
          f"{'OK' if k['gate_improvement_rate']['meets'] else 'FAIL'}"
          f"  持平 {k['unchanged']} / 下降 {k['declined']}")
    for name, d in dims.items():
        print(f"[{name}] {d['mean']} (门槛≥3.5) {'OK' if d['meets'] else 'FAIL'}")
    print(f"[可用性] {usable['status']}")
    if sensitivity:
        print(f"[探索] 用时≥300秒 n={sensitivity['n_paired']}：前测 {sensitivity['pre_mean']} → "
              f"后测 {sensitivity['post_mean']}，增益 {sensitivity['gain']}，提升率 {sensitivity['improvement_rate']}")
    print(f"[结论] 效果测试 {report['overall_effect']}")
    print(f"[OK] 报告 → {out_path}")


if __name__ == "__main__":
    main()
