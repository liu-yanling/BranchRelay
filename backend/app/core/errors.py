"""统一错误结构与异常处理。

错误响应统一为 {"error": {"code", "message"}}，不向前端泄露堆栈。
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("branchrelay")


class AppError(Exception):
    """业务异常：message 给用户看，code 给程序/测试用，http_status 映射 HTTP 状态。"""

    def __init__(self, message: str, code: str = "bad_request", http_status: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.http_status = http_status


def error_body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(status_code=exc.http_status, content=error_body(exc.code, exc.message))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", []) if p != "body")
        msg = first.get("msg", "请求参数不合法")
        detail = f"{loc}: {msg}" if loc else msg
        return JSONResponse(status_code=422, content=error_body("validation_error", detail))

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content=error_body("http_error", str(exc.detail)))

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception):
        logger.exception("未处理异常：%s", exc)
        return JSONResponse(status_code=500, content=error_body("internal_error", "服务器内部错误"))
