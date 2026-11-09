"""L2 生成采样：把 30 条 prompt 各采样 5 次，产出可人工评分的结果。

用法：
    python run_sampling.py --dry-run          # 只校验样本集，不调模型
    python run_sampling.py --endpoint URL --model MODEL --api-key KEY
    python run_sampling.py                    # 读 LLM_ENDPOINT / LLM_MODEL / LLM_API_KEY

结果写入 runs/L2_runs_<时间戳>.jsonl，一行一次生成，sample_id 与
02_人工执行/01_L2_人工评分/评分表.csv 的样本编号一一对应。
答疑样本带 search_knowledge 工具，镜像正式智能体的检索流程。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEST_ROOT = HERE.parent.parent
L1_DIR = TEST_ROOT / "01_机器执行" / "01_L1_契约测试"
FIXTURES = L1_DIR / "fixtures"
PROMPTS_PATH = HERE / "prompts.jsonl"

EXPECTED_KINDS = {"feedback": 12, "review": 4, "qa": 14}

QA_TOOL = {
    "type": "function",
    "function": {
        "name": "search_knowledge",
        "description": (
            "检索遵义会议及长征相关的内部史料库。用户询问历史人物、事件、时间、数据等"
            "客观史实时必须调用，只能依据检索到的史料回答，不得自行编造。"
        ),
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "检索关键词或用户的问题"}},
            "required": ["query"],
        },
    },
}


def retrieve(query: str, knowledge: list[dict], top_k: int = 3) -> list[dict]:
    scored = []
    for entry in knowledge:
        score = sum(
            query.count(kw) * (2 if kw == entry["title"] else 1) for kw in entry["keywords"]
        )
        if score:
            scored.append((score, entry))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [entry for _, entry in scored[:top_k]]


def format_docs(entries: list[dict]) -> str:
    if not entries:
        return "未检索到相关史料。"
    return "\n\n".join(f"【{entry['title']}】{entry['content']}" for entry in entries)


def handle_tool(name: str, arguments: str, knowledge: list[dict]) -> str:
    if name != "search_knowledge":
        raise RuntimeError(f"未注册的工具：{name}")
    args = json.loads(arguments or "{}")
    return format_docs(retrieve(args.get("query", ""), knowledge))


def _read_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise SystemExit(f"[FAIL] {path.name} 第 {lineno} 行不是合法 JSON：{exc}")
    return rows


def _load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def validate(prompts: list[dict], script: dict) -> list[str]:
    errors: list[str] = []
    kinds = Counter(p.get("kind") for p in prompts)
    for kind, expected in EXPECTED_KINDS.items():
        if kinds.get(kind, 0) != expected:
            errors.append(f"{kind} 应为 {expected} 条，实际 {kinds.get(kind, 0)} 条")

    ids = [p.get("id") for p in prompts]
    if len(ids) != len(set(ids)):
        errors.append("存在重复的样本编号")
    if len(prompts) != sum(EXPECTED_KINDS.values()):
        errors.append(f"样本总数应为 {sum(EXPECTED_KINDS.values())}，实际 {len(prompts)}")

    covered = set()
    for p in prompts:
        kind = p.get("kind")
        if kind == "feedback":
            stage, code = p.get("stage"), p.get("code")
            if stage not in script["stages"]:
                errors.append(f"{p.get('id')}: 未知关卡 {stage}")
                continue
            if code not in script["stages"][stage]["options"]:
                errors.append(f"{p.get('id')}: {stage} 没有选项 {code}")
                continue
            covered.add((stage, code))
        elif kind == "review":
            choices = p.get("choices") or []
            if len(choices) != 3:
                errors.append(f"{p.get('id')}: 复盘样本必须给出三关选择")
            for i, code in enumerate(choices, 1):
                stage = f"stage_{i}"
                if stage in script["stages"] and code not in script["stages"][stage]["options"]:
                    errors.append(f"{p.get('id')}: {stage} 没有选项 {code}")
            if p.get("expect_profile") not in script["review_profiles"]:
                errors.append(f"{p.get('id')}: 未知画像 {p.get('expect_profile')}")
        elif kind == "qa":
            if not (p.get("question") or "").strip():
                errors.append(f"{p.get('id')}: 问题为空")
            for kb in p.get("expect_kb") or []:
                if not kb:
                    errors.append(f"{p.get('id')}: 空的 expect_kb")

    expected_combo = {
        (stage, code)
        for stage in ("stage_1", "stage_2", "stage_3")
        for code in script["stages"][stage]["options"]
    }
    missing = expected_combo - covered
    if missing:
        errors.append(f"反馈样本未覆盖 12 个选项：缺少 {sorted(missing)}")

    profiles = {p.get("expect_profile") for p in prompts if p.get("kind") == "review"}
    if profiles != set(script["review_profiles"]):
        errors.append(f"复盘样本未覆盖四类画像：{sorted(profiles)}")

    qa_ids = sorted(p["id"] for p in prompts if p.get("kind") == "qa")
    expected_qa = [f"QA-{i:02d}" for i in range(1, 15)]
    if qa_ids != expected_qa:
        errors.append(f"QA 样本编号应为 QA-01..QA-14，实际 {qa_ids}")
    return errors


def build_messages(prompt: dict, script: dict) -> list[dict]:
    kind = prompt["kind"]
    if kind == "feedback":
        stage = script["stages"][prompt["stage"]]
        cfg = stage["options"][prompt["code"]]
        user = script["feedback_user_template"].format(
            stage_title=stage["title"],
            stage_focus=stage["focus"],
            option_label=cfg["label"],
            strategy_text=script["feedback_strategies"][str(cfg["tier"])],
            trait=cfg["trait"],
            fact_points="\n".join(
                f"{i}. {point}" for i, point in enumerate(cfg["fact_points"], 1)
            ),
            baseline_feedback=cfg["baseline_feedback"],
        )
        return [
            {"role": "system", "content": script["feedback_system_prompt"]},
            {"role": "user", "content": user},
        ]

    if kind == "review":
        evidence = {}
        for i, code in enumerate(prompt["choices"], 1):
            cfg = script["stages"][f"stage_{i}"]["options"][code]
            evidence[f"label_{i}"] = cfg["label"]
            evidence[f"trait_{i}"] = cfg["trait"]
            evidence[f"tier_{i}"] = cfg["tier"]
        return [
            {"role": "system", "content": script["review_system_prompt"]},
            {"role": "user", "content": script["review_user_template"].format(**evidence)},
        ]

    return [
        {"role": "system", "content": script["qa_system_prompt"]},
        {"role": "user", "content": prompt["question"]},
    ]


def screen(text: str, kind: str, forbidden: dict) -> tuple[int, list[str]]:
    issues: list[str] = []
    if not (text or "").strip():
        issues.append("empty")
        return 0, issues
    lowered = text.lower()
    for term in list(forbidden["internal_terms"]) + ["tier", "trait", "fact_points"]:
        if term.lower() in lowered:
            issues.append(f"forbidden:{term}")
    if re.search(r"[123][A-D]", text):
        issues.append("option_code")
    for marker in forbidden["markdown_markers"]:
        if marker in text:
            issues.append(f"markdown:{marker}")
    chars = len(re.findall(r"[一-鿿A-Za-z0-9]", text))
    if kind == "feedback" and not 120 <= chars <= 180:
        issues.append(f"length:{chars}")
    elif kind == "review" and not 200 <= chars <= 260:
        issues.append(f"length:{chars}")
    return chars, issues


def call_model(
    endpoint: str,
    api_key: str,
    model: str,
    messages: list[dict],
    temperature: float,
    tools: list[dict] | None = None,
    knowledge: list[dict] | None = None,
) -> str:
    history = list(messages)
    for _ in range(4):
        payload = {
            "model": model,
            "messages": history,
            "temperature": temperature,
        }
        if tools:
            payload["tools"] = tools
        request = urllib.request.Request(
            endpoint,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                **({"Authorization": f"Bearer {api_key}"} if api_key else {}),
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            data = json.load(response)
        try:
            message = data["choices"][0]["message"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"响应结构不符合 OpenAI 兼容格式：{data}") from exc

        tool_calls = message.get("tool_calls")
        if tools and tool_calls:
            history.append(
                {
                    "role": "assistant",
                    "content": message.get("content") or "",
                    "tool_calls": tool_calls,
                }
            )
            for call in tool_calls:
                function = call["function"]
                history.append(
                    {
                        "role": "tool",
                        "tool_call_id": call["id"],
                        "content": handle_tool(function["name"], function.get("arguments", "{}"), knowledge or []),
                    }
                )
            continue
        return message.get("content", "")
    raise RuntimeError("工具调用轮次超过上限，未拿到最终回复")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass

    parser = argparse.ArgumentParser(description="L2 生成采样")
    parser.add_argument("--dry-run", action="store_true", help="只校验样本集，不调用模型")
    parser.add_argument("--endpoint", default=os.environ.get("LLM_ENDPOINT", ""))
    parser.add_argument("--api-key", default=os.environ.get("LLM_API_KEY", ""))
    parser.add_argument("--model", default=os.environ.get("LLM_MODEL", ""))
    parser.add_argument("--samples", type=int, default=5)
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--limit", type=int, default=0, help="只跑前 N 条样本（调试用）")
    parser.add_argument("--out-dir", default=str(HERE / "runs"))
    args = parser.parse_args()

    script = _load(FIXTURES / "script_snapshot.json")
    forbidden = _load(FIXTURES / "forbidden_terms.json")
    knowledge = _load(FIXTURES / "knowledge_snapshot.json")
    prompts = _read_jsonl(PROMPTS_PATH)
    if args.limit:
        prompts = prompts[: args.limit]

    errors = validate(_read_jsonl(PROMPTS_PATH), script)
    if errors:
        print("[FAIL] 样本集结构校验未通过：")
        for error in errors:
            print("  -", error)
        raise SystemExit(1)
    counts = Counter(p["kind"] for p in prompts)
    print(
        f"[OK] 样本集校验通过：共 {len(prompts)} 条 "
        f"(反馈 {counts['feedback']} / 复盘 {counts['review']} / 答疑 {counts['qa']})"
    )

    if args.dry_run:
        for prompt in prompts:
            messages = build_messages(prompt, script)
            assert messages[-1]["content"].strip()
        print(f"[DRY-RUN] 仅校验，不产生可评分数据；真实采样每条 ×{args.samples}。")
        raise SystemExit(0)

    if not args.endpoint or not args.model:
        print("[FAIL] 缺少 --endpoint / --model（或设置 LLM_ENDPOINT / LLM_MODEL）")
        raise SystemExit(1)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"L2_runs_{stamp}.jsonl"

    total = 0
    flagged = 0
    with out_path.open("w", encoding="utf-8") as out:
        for prompt in prompts:
            messages = build_messages(prompt, script)
            for run_idx in range(1, args.samples + 1):
                try:
                    text = call_model(
                        args.endpoint,
                        args.api_key,
                        args.model,
                        messages,
                        args.temperature,
                        tools=[QA_TOOL] if prompt["kind"] == "qa" else None,
                        knowledge=knowledge,
                    )
                    chars, issues = screen(text, prompt["kind"], forbidden)
                except (urllib.error.URLError, RuntimeError, TimeoutError) as exc:
                    text, chars, issues = "", 0, [f"error:{exc}"]
                record = {
                    "sample_id": prompt["id"],
                    "category": prompt["kind"],
                    "run_idx": run_idx,
                    "model": args.model,
                    "endpoint": args.endpoint,
                    "temperature": args.temperature,
                    "rag": prompt["kind"] == "qa",
                    "generated_at": datetime.now().isoformat(timespec="seconds"),
                    "chars": chars,
                    "flags": issues,
                    "response": text,
                }
                out.write(json.dumps(record, ensure_ascii=False) + "\n")
                out.flush()
                total += 1
                if issues:
                    flagged += 1
                print(f"  {prompt['id']} #{run_idx}: {chars} 字" + (f"  问题 {issues}" if issues else ""))

    print(f"[DONE] {total} 次生成，{flagged} 次带格式/禁用词提示")
    print(f"[OUT] {out_path}")
    print("[NEXT] 逐条对照 02_人工执行/01_L2_人工评分/评分表.csv 打分；脚本不代替人工判定。")


if __name__ == "__main__":
    main()
