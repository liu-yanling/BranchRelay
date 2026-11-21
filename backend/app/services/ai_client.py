"""统一模型客户端：超时 + 有限重试 + 用量与耗时采集。

所有 AI 能力共用本模块调用模型；SDK 初始化失败（无 Key）、超时、网络错误、HTTP 错误、
返回格式异常都统一抛 ModelError，由 ai_services 降级为规则汇总。
"""
from __future__ import annotations

import time
from dataclasses import dataclass

import requests

from app.core import config


class ModelError(Exception):
    pass


@dataclass
class ModelResult:
    content: str
    input_tokens: int
    output_tokens: int
    request_id: str
    elapsed: float
    retries: int


_last: ModelResult | None = None


def last_result() -> ModelResult | None:
    """返回最近一次成功调用的元数据（供冒烟脚本记录）。"""
    return _last


def _request_once(system: str, user: str, attempt: int) -> ModelResult:
    start = time.time()
    payload = {
        "model": config.MODEL_NAME,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
    }
    try:
        resp = requests.post(
            f"{config.MODEL_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {config.MODEL_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=config.MODEL_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
    except requests.Timeout:
        raise ModelError("模型请求超时")
    except requests.HTTPError as e:
        raise ModelError(f"模型接口返回错误：{e}")
    except requests.RequestException as e:
        raise ModelError(f"模型请求失败：{e}")
    except (KeyError, IndexError, ValueError) as e:
        raise ModelError(f"模型返回格式异常：{e}")

    usage = data.get("usage") or {}
    return ModelResult(
        content=content,
        input_tokens=int(usage.get("prompt_tokens", 0)),
        output_tokens=int(usage.get("completion_tokens", 0)),
        request_id=str(data.get("id", "-")),
        elapsed=time.time() - start,
        retries=attempt,
    )


def call_model(system: str, user: str) -> ModelResult:
    """带有限重试的模型调用。无 Key 直接抛错（不重试）。"""
    global _last
    if not config.MODEL_API_KEY:
        raise ModelError("密钥缺失")
    last_err: ModelError | None = None
    for attempt in range(config.MODEL_MAX_RETRIES + 1):
        try:
            _last = _request_once(system, user, attempt)
            return _last
        except ModelError as e:
            last_err = e
            if attempt >= config.MODEL_MAX_RETRIES:
                break
            time.sleep(0.5 * (attempt + 1))
    raise last_err  # type: ignore[misc]
