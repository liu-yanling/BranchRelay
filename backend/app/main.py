"""FastAPI 入口：装配路由与异常处理。

一条命令起服务：cd backend && uvicorn app.main:app --port 8000
阶段 3-1 起，本服务只提供 /api/*；正式前端（frontend/）通过 proxy.ts 把 /api/* 转发到这里，
原 backend/static/ 临时验收界面已废弃（停止对外提供入口，文件保留）。
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import ai, board, notifications, report, system, tasks
from app.core.errors import register_error_handlers
from app.services import repository


@asynccontextmanager
async def lifespan(_: FastAPI):
    repository.init_db()
    yield


app = FastAPI(title="BranchRelay", lifespan=lifespan)

register_error_handlers(app)

app.include_router(tasks.router, prefix="/api")
app.include_router(board.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(report.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
