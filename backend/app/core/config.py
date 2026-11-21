"""配置读取：环境变量 + 轻量 .env 加载（不依赖 python-dotenv）。

所有配置项集中在本文档，代码不硬编码模型名、地址、超时与密钥。
"""
from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]  # .../projects/<产品名>/backend


def _load_dotenv() -> None:
    """仅设置尚未定义的环境变量；已存在的（如测试注入）不覆盖。"""
    env_path = os.environ.get("BR_ENV_FILE", str(BACKEND_DIR / ".env"))
    if not os.path.exists(env_path):
        return
    with open(env_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


_load_dotenv()


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


DEMO_TIME = os.environ.get("DEMO_TIME", "").strip()
PORT = _int("PORT", 8000)

_db_path = os.environ.get("DB_PATH", "").strip() or str(BACKEND_DIR.parent / "data" / "branchrelay.db")
DB_PATH = _db_path if os.path.isabs(_db_path) else str((BACKEND_DIR / _db_path).resolve())

MODEL_API_BASE = os.environ.get("MODEL_API_BASE", "https://api.openai-next.com/v1").rstrip("/")
MODEL_NAME = os.environ.get("MODEL_NAME", "gpt-6.2-astra")
MODEL_API_KEY = os.environ.get("MODEL_API_KEY", "")
MODEL_TIMEOUT = _int("MODEL_TIMEOUT", 30)
MODEL_MAX_RETRIES = _int("MODEL_MAX_RETRIES", 1)


def model_available() -> bool:
    return bool(MODEL_API_KEY)
