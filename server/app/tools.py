import json

from app import knowledge

SEARCH_KNOWLEDGE_TOOL = {
    "type": "function",
    "function": {
        "name": "search_knowledge",
        "description": (
            "检索遵义会议及长征相关的内部史料库。用户询问历史人物、事件、时间、数据等"
            "客观史实时必须调用，只能依据检索到的史料回答，不得自行编造。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "检索关键词或用户的问题"}
            },
            "required": ["query"],
        },
    },
}


def handle_tool_call(name: str, arguments: str | dict) -> str:
    """大模型工具调用的统一执行入口，返回给模型的 tool 消息文本。"""
    if isinstance(arguments, str):
        arguments = json.loads(arguments or "{}")

    if name == "search_knowledge":
        entries = knowledge.retrieve(arguments.get("query", ""))
        return knowledge.format_docs(entries)

    raise ValueError(f"未注册的工具: {name}")
