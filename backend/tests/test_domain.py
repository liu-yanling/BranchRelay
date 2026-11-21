"""领域逻辑单测：状态机、权限/版本校验、创建校验。模型不参与，全离线。"""
from __future__ import annotations

import pytest

from app.core.constants import COMPLETED, PENDING, PENDING_REVIEW, PENDING_SUPPLEMENT
from app.core.errors import AppError
from app.schemas.task import TaskCreate
from app.services import domain


def _create(**overrides) -> TaskCreate:
    base = dict(
        actor_id="u_zh", title="测试任务", description="",
        plan_date="2026-11-21", due_at="2026-11-21T17:00:00+08:00",
        executor_id="u_retail", reviewer_id="u_ops",
    )
    base.update(overrides)
    return TaskCreate(**base)


def _version(task_id: str, role: str) -> int:
    return domain.task_detail(task_id, role)["version"]


# ---- 创建 ----

def test_create_task_ok():
    t = domain.create_task(_create())
    assert t["id"].startswith("T-")
    assert t["status"] == PENDING
    assert t["current_owner_id"] == "u_retail"


def test_create_task_same_executor_reviewer_rejected():
    with pytest.raises(AppError) as e:
        domain.create_task(_create(executor_id="u_retail", reviewer_id="u_retail"))
    assert e.value.code == "validation_error"
    assert e.value.http_status == 400


def test_create_task_due_before_plan_rejected():
    with pytest.raises(AppError) as e:
        domain.create_task(_create(plan_date="2026-11-22", due_at="2026-11-21T17:00:00+08:00"))
    assert e.value.code == "validation_error"


def test_create_task_non_zh_forbidden():
    with pytest.raises(AppError) as e:
        domain.create_task(_create(actor_id="u_retail"))
    assert e.value.http_status == 403


# ---- 提交复核 ----

def test_submit_review():
    t = domain.apply_action("u_retail", "T-003", "submit_review", "初稿已整理，请核对活动时间", _version("T-003", "u_retail"))
    assert t["status"] == PENDING_REVIEW
    assert t["current_owner_id"] == "u_ops"
    assert t["submit_note"] == "初稿已整理，请核对活动时间"


def test_submit_review_requires_note():
    with pytest.raises(AppError) as e:
        domain.apply_action("u_retail", "T-003", "submit_review", "", _version("T-003", "u_retail"))
    assert e.value.code == "validation_error"


# ---- 退回与通过 ----

def test_reject_then_resubmit_then_approve():
    # 提交
    domain.apply_action("u_retail", "T-003", "submit_review", "初稿", _version("T-003", "u_retail"))
    # 退回
    t = domain.apply_action("u_ops", "T-003", "reject", "活动时间有误，请核对", _version("T-003", "u_ops"))
    assert t["status"] == PENDING_SUPPLEMENT
    assert t["current_owner_id"] == "u_retail"
    assert t["reject_reason"] == "活动时间有误，请核对"
    # 补充后重提
    domain.apply_action("u_retail", "T-003", "update_progress", "已补充活动时间", _version("T-003", "u_retail"))
    domain.apply_action("u_retail", "T-003", "submit_review", "已补充，请再次复核", _version("T-003", "u_retail"))
    # 通过
    t = domain.apply_action("u_ops", "T-003", "approve", "通过", _version("T-003", "u_ops"))
    assert t["status"] == COMPLETED
    assert t["current_owner_id"] is None
    assert t["completed_at"] is not None
    detail = domain.task_detail("T-003", "u_mgr")
    assert [e["action"] for e in detail["events"]] == [
        "create", "start", "update", "submit_review", "reject",
        "update_progress", "submit_review", "approve",
    ]


# ---- 权限与版本 ----

def test_executor_cannot_approve():
    with pytest.raises(AppError) as e:
        domain.apply_action("u_retail", "T-005", "approve", "越权", _version("T-005", "u_ops"))
    assert e.value.http_status == 403


def test_duplicate_approve_rejected_once():
    v = _version("T-005", "u_ops")
    domain.apply_action("u_ops", "T-005", "approve", "通过", v)
    with pytest.raises(AppError) as e:
        domain.apply_action("u_ops", "T-005", "approve", "重复通过", v)
    assert e.value.http_status == 409
    detail = domain.task_detail("T-005", "u_mgr")
    assert sum(1 for ev in detail["events"] if ev["action"] == "approve") == 1


# ---- 看板统计 ----

def test_board_initial_stats():
    b = domain.board("u_mgr")
    assert b["stats"] == {"total": 5, "completed": 2, "pending_review": 1, "overdue": 1}


def test_board_only_manager():
    with pytest.raises(AppError) as e:
        domain.board("u_retail")
    assert e.value.http_status == 403
