"""AI 能力降级测试：无模型 Key 时全部走规则汇总，且分组/状态由程序保证。"""
from __future__ import annotations

import pytest

from app.core.errors import AppError
from app.services import ai_services, domain


def _submit_t003():
    v = domain.task_detail("T-003", "u_retail")["version"]
    domain.apply_action("u_retail", "T-003", "submit_review", "初稿已整理，请核对活动时间", v)


def test_report_rules_fallback():
    _submit_t003()
    r = ai_services.generate_report("u_mgr", "branch", "2026-11-16")
    assert r["method"] == "rules"
    assert [x["task_id"] for x in r["completed"]] == ["T-001", "T-002"]
    assert "T-003" in [x["task_id"] for x in r["pending"]]
    assert "T-006" in [x["task_id"] for x in r["next_week"]]


def test_report_branch_scope_forbidden_for_retail():
    with pytest.raises(AppError) as e:
        ai_services.generate_report("u_retail", "branch", "2026-11-16")
    assert e.value.http_status == 403


def test_report_empty_week():
    r = ai_services.generate_report("u_retail", "personal", "2026-10-01")
    assert r["method"] == "rules"
    assert r["empty"] is True
    assert r["completed"] == [] and r["pending"] == [] and r["next_week"] == []


def test_diagnose_rules_fallback():
    r = ai_services.diagnose("u_mgr")
    assert r["method"] == "rules"
    assert any(x["task_id"] == "T-004" and x["type"] == "overdue" for x in r["risks"])


def test_qa_rules_fallback_and_scope():
    r = ai_services.answer("哪些任务逾期了", "u_mgr")
    assert r["method"] == "rules"
    assert "T-004" in r["refs"]
    r2 = ai_services.answer("哪些任务逾期了", "u_retail")
    assert r2["refs"] == []
