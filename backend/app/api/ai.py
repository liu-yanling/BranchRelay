"""AI 能力路由：诊断 / 摘要 / 起草 / 问答。"""
from __future__ import annotations

from fastapi import APIRouter

from app.schemas.ai import DiagnoseRequest, DraftRequest, QaRequest, SummaryRequest
from app.services import ai_services

router = APIRouter()


@router.post("/diagnose")
def diagnose(payload: DiagnoseRequest):
    return ai_services.diagnose(payload.role)


@router.post("/summary")
def summary(payload: SummaryRequest):
    return ai_services.summarize(payload.task_id, payload.role)


@router.post("/draft")
def draft(payload: DraftRequest):
    return ai_services.draft(payload.kind, payload.context)


@router.post("/qa")
def qa(payload: QaRequest):
    return ai_services.answer(payload.question, payload.role)
