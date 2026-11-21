"""支行看板路由。"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter

from app.services import domain

router = APIRouter()


@router.get("/board")
def board(role: str = "u_mgr", filter: Optional[str] = None):
    return domain.board(role, filter)
