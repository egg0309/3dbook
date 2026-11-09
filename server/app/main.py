import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import adapter, config, store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("zunyi")

app = FastAPI(title="遵义会议推演智能体 · 前端契约后端")

store.init_db()

# dev 走 Vite 同源代理；独立域名部署时可收紧为前端域名白名单
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    sessionId: str
    stage: str
    choice: str | None = None
    message: str | None = None
    choices: dict = Field(default_factory=dict)
    # 浏览器 localStorage 里的持久匿名编号，仅用于把多次测试归到同一人
    clientId: str | None = None


class StartRequest(BaseModel):
    sessionId: str
    clientId: str | None = None


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "mock_mode": config.MOCK_MODE, "model": config.DEEPSEEK_MODEL}


@app.post("/api/session/start")
def session_start(req: StartRequest) -> dict:
    store.record_start(req.sessionId, req.clientId)
    return {"ok": True}


@app.post("/api/chat")
def chat(req: ChatRequest) -> dict:
    logger.info("session=%s stage=%s choice=%s message=%r",
                req.sessionId, req.stage, req.choice, (req.message or "")[:20])
    result = adapter.handle_turn(req.model_dump())
    # 记录失败只告警，不影响对话返回
    store.record_turn(req.model_dump(), result)
    return result
