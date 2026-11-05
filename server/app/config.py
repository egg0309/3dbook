import os

from dotenv import load_dotenv

load_dotenv()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat").strip()
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "30"))

# .env 未配置或仍是占位符时进入本地模拟模式，不发起真实 API 调用
MOCK_MODE = (not DEEPSEEK_API_KEY) or DEEPSEEK_API_KEY.startswith("sk-在此")
