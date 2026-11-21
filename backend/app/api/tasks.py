"""任务路由：工作台列表、任务详情、创建、状态动作。"""
from __future__ import annotations

from fastapi import APIRouter

from app.schemas.task import TaskAction, TaskCreate
from app.services import domain

router = APIRouter()


@router.get("/tasks")
def list_tasks(view: str = "today", role: str = "u_retail"):
    return {"tasks": domain.workbench(role, view)}


@router.get("/tasks/{task_id}")
def get_task(task_id: str, role: str = "u_retail"):
    return domain.task_detail(task_id, role)


@router.post("/tasks")
def create_task(payload: TaskCreate):
    return domain.create_task(payload)


@router.post("/tasks/{task_id}/action")
def task_action(task_id: str, payload: TaskAction):
    return domain.apply_action(payload.actor_id, task_id, payload.action, payload.note, payload.version)
