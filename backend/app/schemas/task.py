"""任务相关输入结构（Pydantic）。

业务规则（经办人≠复核人、截止不早于计划日、角色权限等）在 services/domain.py 校验；
本模块只做结构与类型约束，保证请求体可被确定性解析。
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    actor_id: str
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    plan_date: str
    due_at: str
    executor_id: str
    reviewer_id: str


class TaskAction(BaseModel):
    actor_id: str
    action: str
    note: str = ""
    version: int = Field(ge=0)
