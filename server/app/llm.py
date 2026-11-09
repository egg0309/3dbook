import json
import logging
from typing import Callable

from openai import OpenAI

from app import config

logger = logging.getLogger("zunyi")


def _client() -> OpenAI:
    return OpenAI(
        api_key=config.DEEPSEEK_API_KEY,
        base_url=config.DEEPSEEK_BASE_URL,
        timeout=config.LLM_TIMEOUT,
    )


def chat(system_prompt: str, user_prompt: str) -> str:
    if config.MOCK_MODE:
        logger.info("MOCK 模式命中，未调用真实大模型")
        return (
            "【本地模拟模式】尚未配置有效的 DEEPSEEK_API_KEY，当前为占位回复。\n"
            "复制 .env.example 为 .env 并填入 Key 后重启服务，这里就会换成老陈的真实台词。"
        )

    try:
        resp = _client().chat.completions.create(
            model=config.DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=600,
            stream=False,
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        logger.exception("DeepSeek 调用失败")
        raise RuntimeError(f"大模型服务暂时不可用：{exc}") from exc


def chat_with_tools(
    system_prompt: str,
    messages: list[dict],
    tools: list[dict],
    tool_handler: Callable[[str, str | dict], str],
    max_rounds: int = 3,
) -> str:
    """Function Calling 闭环：模型请求工具 -> 后端执行 -> 结果回灌 -> 模型收口。"""
    if config.MOCK_MODE:
        logger.info("MOCK 模式命中，工具调用闭环未发起真实请求")
        return "【本地模拟模式】尚未配置有效的 DEEPSEEK_API_KEY，当前为占位回复。"

    client = _client()
    full_messages = [{"role": "system", "content": system_prompt}, *messages]

    try:
        for round_idx in range(max_rounds):
            request_kwargs = dict(
                model=config.DEEPSEEK_MODEL,
                messages=full_messages,
                tools=tools,
                temperature=0.7,
                max_tokens=600,
                stream=False,
            )
            # 首轮强制走检索工具，防止模型跳过知识库凭记忆作答（防幻觉底线）
            if round_idx == 0:
                request_kwargs["tool_choice"] = {
                    "type": "function",
                    "function": {"name": tools[0]["function"]["name"]},
                }
            resp = client.chat.completions.create(**request_kwargs)
            msg = resp.choices[0].message

            if not msg.tool_calls:
                return (msg.content or "").strip()

            full_messages.append({
                "role": "assistant",
                "content": msg.content,
                "tool_calls": [
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.function.name,
                            "arguments": call.function.arguments,
                        },
                    }
                    for call in msg.tool_calls
                ],
            })

            for call in msg.tool_calls:
                try:
                    result = tool_handler(call.function.name, call.function.arguments)
                except Exception as exc:
                    logger.exception("工具 %s 执行失败", call.function.name)
                    result = f"工具执行失败：{exc}"
                full_messages.append({
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": result,
                })

        raise RuntimeError("工具调用轮次超过上限")
    except RuntimeError:
        raise
    except Exception as exc:
        logger.exception("DeepSeek 工具调用失败")
        raise RuntimeError(f"大模型服务暂时不可用：{exc}") from exc


def chat_stream(system_prompt: str, user_prompt: str):
    """单轮对话的 SSE 流式生成器，逐 token 产出文本。"""
    if config.MOCK_MODE:
        logger.info("MOCK 模式命中，流式输出占位文本")
        yield "【本地模拟模式】尚未配置有效的 DEEPSEEK_API_KEY，当前为占位回复。"
        return

    client = _client()
    try:
        stream = client.chat.completions.create(
            model=config.DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=600,
            stream=True,
        )
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except Exception as exc:
        logger.exception("DeepSeek 流式调用失败")
        raise RuntimeError(f"大模型服务暂时不可用：{exc}") from exc


def chat_with_tools_stream(system_prompt: str, messages: list[dict],
                           tools: list[dict], tool_handler):
    """工具闭环流式版：检索轮同步执行（强制工具），收口轮不带 tools 纯文本流式。"""
    if config.MOCK_MODE:
        logger.info("MOCK 模式命中，工具流式输出占位文本")
        yield "【本地模拟模式】尚未配置有效的 DEEPSEEK_API_KEY，当前为占位回复。"
        return

    client = _client()
    full_messages = [{"role": "system", "content": system_prompt}, *messages]
    try:
        resp = client.chat.completions.create(
            model=config.DEEPSEEK_MODEL,
            messages=full_messages,
            tools=tools,
            tool_choice={
                "type": "function",
                "function": {"name": tools[0]["function"]["name"]},
            },
            temperature=0.7,
            max_tokens=600,
            stream=False,
        )
        msg = resp.choices[0].message
        if not msg.tool_calls:
            if msg.content:
                yield msg.content
            return

        full_messages.append({
            "role": "assistant",
            "content": msg.content,
            "tool_calls": [
                {
                    "id": call.id,
                    "type": "function",
                    "function": {
                        "name": call.function.name,
                        "arguments": call.function.arguments,
                    },
                }
                for call in msg.tool_calls
            ],
        })
        for call in msg.tool_calls:
            try:
                result = tool_handler(call.function.name, call.function.arguments)
            except Exception as exc:
                logger.exception("工具 %s 执行失败", call.function.name)
                result = f"工具执行失败：{exc}"
            full_messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": result,
            })

        # 史料已注入，末轮不再给工具，强制纯文本收口
        stream = client.chat.completions.create(
            model=config.DEEPSEEK_MODEL,
            messages=full_messages,
            temperature=0.7,
            max_tokens=600,
            stream=True,
        )
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except Exception as exc:
        logger.exception("DeepSeek 工具流式调用失败")
        raise RuntimeError(f"大模型服务暂时不可用：{exc}") from exc
