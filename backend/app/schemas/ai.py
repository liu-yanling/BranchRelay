"""模型结构化输出的 Pydantic 校验模型。

模型只负责组织语言，程序负责分组/数量/状态；这些模型在渲染前强校验模型 JSON，
校验失败走有限重试，仍失败走规则汇总降级。
"""
from __future__ import annotations

from pydantic import BaseModel


class ReportItem(BaseModel):
    task_id: str
    text: str


class ReportModelOut(BaseModel):
    completed: list[ReportItem] = []
    pending: list[ReportItem] = []
    next_week: list[ReportItem] = []


class DiagnosisRisk(BaseModel):
    task_id: str
    type: str = ""
    status: str = ""
    owner: str = ""
    advice: str = ""


class DiagnosisModelOut(BaseModel):
    risks: list[DiagnosisRisk] = []


class SummaryModelOut(BaseModel):
    summary: str = ""


class DraftModelOut(BaseModel):
    text: str = ""


class QaModelOut(BaseModel):
    answer: str = ""
    refs: list[str] = []


# ---- 请求结构 ----


class ReportGenerateRequest(BaseModel):
    role: str
    scope: str = "personal"
    week_start: str = ""


class ReportSaveRequest(BaseModel):
    role: str
    scope: str = "personal"
    week_start: str = ""
    content: str = "[]"
    method: str = "rules"
    data_cutoff: str = ""


class DiagnoseRequest(BaseModel):
    role: str = "u_mgr"


class SummaryRequest(BaseModel):
    task_id: str
    role: str = "u_retail"


class DraftRequest(BaseModel):
    kind: str = ""
    context: dict = {}


class QaRequest(BaseModel):
    question: str = ""
    role: str = "u_mgr"
