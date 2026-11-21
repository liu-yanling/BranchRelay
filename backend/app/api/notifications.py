"""站内通知路由。"""
from __future__ import annotations

from fastapi import APIRouter

from app.services import domain

router = APIRouter()


@router.get("/notifications")
def notifications(role: str = "u_retail"):
    return domain.list_notifications(role)


@router.post("/notifications/refresh")
def refresh_notifications(role: str = "u_retail"):
    domain.ensure_due_reminders(role)
    return {"ok": True}


@router.post("/notifications/{nid}/read")
def mark_read(nid: int):
    domain.mark_read(nid)
    return {"ok": True}
