"""AI 周报路由：读取草稿、生成、保存。"""
from __future__ import annotations

from fastapi import APIRouter

from app.core import db
from app.schemas.ai import ReportGenerateRequest, ReportSaveRequest
from app.services import ai_services, reporting

router = APIRouter()


@router.get("/report")
def get_report(role: str, scope: str, week_start: str):
    draft = reporting.report_draft_get(role, scope, week_start)
    if draft:
        return {"draft": draft, "report": None}
    return {"draft": None, "report": None}


@router.post("/report/generate")
def generate_report(payload: ReportGenerateRequest):
    week_start = payload.week_start or db.iso(db.monday_of(db.demo_now()))
    return ai_services.generate_report(payload.role, payload.scope, week_start)


@router.post("/report/save")
def save_report(payload: ReportSaveRequest):
    reporting.report_draft_save(
        payload.role, payload.scope, payload.week_start,
        payload.content, payload.method, payload.data_cutoff,
    )
    return {"ok": True}
