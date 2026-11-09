"""把问卷星导出的原始答卷录入成 L4 标准 CSV。

用法：
    python import_questionnaire.py [--raw 结果/遵义会议_v1.csv]

产出（覆盖写入，编码 utf-8-sig，Excel 打开中文正常）：
    02_人工执行/03_L4_真人测试/03_数据录入/pre_post.csv
    02_人工执行/03_L4_真人测试/03_数据录入/survey.csv

说明：
- participant_id 用导出「序号」，group 固定 effect，同一份提交前后测即 paired=1；
- 计分口径严格按 前测卷.md / 后测卷.md 的答案页；
- 量表只取 9 题（IM1-3 / TR1-3 / RE1-3），第 10 题“整体沉浸”不在模板内，不写入；
- 开放题保留原话，问卷星的 “(空)” 视为未作答；
- 只录入实测，不做任何补值。
"""
from __future__ import annotations

import argparse
import csv
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEST_ROOT = HERE.parent.parent
RAW_DEFAULT = TEST_ROOT / "02_人工执行" / "03_L4_真人测试" / "结果" / "遵义会议_v1.csv"
OUT_DIR = TEST_ROOT / "02_人工执行" / "03_L4_真人测试" / "03_数据录入"

PRE_KEY = [2, 3, 2, 3, 1]   # B C B C A
POST_KEY = [2, 2, 2, 1, 2]  # B B B A B

PRE_COLS = list(range(7, 12))
POST_COLS = list(range(12, 17))
SCALE = {
    "immersion_1": 17,
    "immersion_2": 18,
    "immersion_3": 19,
    "trust_1": 20,
    "trust_2": 21,
    "trust_3": 22,
    "reuse_1": 24,
    "reuse_2": 25,
    "reuse_3": 26,
}
OPEN = {"open_highlight": 27, "open_issue": 28, "open_suggestion": 29}
EMPTY_MARKERS = {"", "(空)", "（空）", "N/A"}


def read_rows(path: Path) -> list[list[str]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.reader(f))


def score(row: list[str], cols: list[int], key: list[int]) -> int:
    return sum(int(row[c]) == k for c, k in zip(cols, key))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=str(RAW_DEFAULT))
    ap.add_argument("--out-dir", default=str(OUT_DIR))
    args = ap.parse_args()

    rows = read_rows(Path(args.raw))
    header, data = rows[0], rows[1:]
    if len(header) < 30:
        raise SystemExit(f"[FAIL] 列数不足 30，实际 {len(header)}，表头可能变了")

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    pre_scores, post_scores = [], []
    pre_rows, survey_rows = [], []
    for r in data:
        if len(r) < 30:
            raise SystemExit(f"[FAIL] 序号 {r[0]} 行不完整")
        pid = r[0].strip()
        pre = score(r, PRE_COLS, PRE_KEY)
        post = score(r, POST_COLS, POST_KEY)
        for c in PRE_COLS + POST_COLS:
            if r[c] not in {"1", "2", "3", "4"}:
                raise SystemExit(f"[FAIL] 序号 {pid} 第 {c + 1} 列选项非法：{r[c]!r}")
        for name, c in SCALE.items():
            if r[c] not in {"1", "2", "3", "4", "5"}:
                raise SystemExit(f"[FAIL] 序号 {pid} {name} 非法：{r[c]!r}")
        pre_scores.append(pre)
        post_scores.append(post)
        pre_rows.append([pid, "effect", pre, post, 1, ""])
        survey_rows.append(
            [pid]
            + [r[SCALE[f"{dim}_{i}"]] for dim in ("immersion", "trust", "reuse") for i in (1, 2, 3)]
            + ["" if r[c].strip() in EMPTY_MARKERS else r[c].strip() for c in OPEN.values()]
        )

    with (out_dir / "pre_post.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["participant_id", "group", "pre_score", "post_score", "paired", "notes"])
        w.writerows(pre_rows)

    with (out_dir / "survey.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            ["participant_id", "immersion_1", "immersion_2", "immersion_3",
             "trust_1", "trust_2", "trust_3", "reuse_1", "reuse_2", "reuse_3",
             "open_highlight", "open_issue", "open_suggestion"]
        )
        w.writerows(survey_rows)

    print(f"[OK] 录入 {len(data)} 份 → {out_dir / 'pre_post.csv'}")
    print(f"[OK] 录入 {len(survey_rows)} 份 → {out_dir / 'survey.csv'}")
    print(f"[前测] 均分 {sum(pre_scores) / len(pre_scores):.3f}  分布 {dict(sorted(Counter(pre_scores).items()))}")
    print(f"[后测] 均分 {sum(post_scores) / len(post_scores):.3f}  分布 {dict(sorted(Counter(post_scores).items()))}")
    print("[提示] 第 10 道量表（整体沉浸）不在模板 9 题内，未写入 survey.csv。")


if __name__ == "__main__":
    main()
