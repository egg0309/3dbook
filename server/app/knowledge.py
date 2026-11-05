import json
from pathlib import Path
from typing import List

_KB_PATH = Path(__file__).resolve().parent.parent / "data" / "knowledge.json"

with open(_KB_PATH, "r", encoding="utf-8") as f:
    _KNOWLEDGE: List[dict] = json.load(f)


def retrieve(query: str, top_k: int = 3) -> List[dict]:
    """轻量关键词检索：命中关键词计分，标题命中加权。

    当前无需嵌入模型即可运行；后续接入向量库时，只需替换本函数实现，
    返回结构保持 {title, content} 不变。
    """
    scored = []
    for entry in _KNOWLEDGE:
        score = 0
        for kw in entry["keywords"]:
            hits = query.count(kw)
            if hits:
                score += hits * (2 if kw == entry["title"] else 1)
        if score > 0:
            scored.append((score, entry))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [entry for _, entry in scored[:top_k]]


def format_docs(entries: List[dict]) -> str:
    if not entries:
        return "未检索到相关史料。"
    return "\n\n".join(f"【{e['title']}】{e['content']}" for e in entries)
