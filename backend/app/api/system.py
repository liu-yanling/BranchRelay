"""基础路由：启动信息与数据重置。"""
from __future__ import annotations

from fastapi import APIRouter

from app.core import config, db
from app.services import repository

router = APIRouter()


@router.get("/bootstrap")
def bootstrap():
    conn = db.get_conn()
    try:
        users = repository.list_users(conn)
    finally:
        conn.close()
    return {
        "users": users,
        "demo_time": db.iso(db.demo_now()),
        "model_available": config.model_available(),
    }


@router.post("/reset")
def reset():
    repository.reset_db()
    return {"ok": True, "demo_time": db.iso(db.demo_now())}
