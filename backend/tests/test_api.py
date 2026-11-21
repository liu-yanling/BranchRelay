"""API 层测试：统一错误结构 + 关键接口契约（用 TestClient 走真实路由）。"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_error_shape_business_rule():
    with TestClient(app) as client:
        r = client.post("/api/tasks", json={
            "actor_id": "u_zh", "title": "x", "description": "",
            "plan_date": "2026-11-21", "due_at": "2026-11-21T17:00:00+08:00",
            "executor_id": "u_retail", "reviewer_id": "u_retail",
        })
        assert r.status_code == 400
        body = r.json()
        assert set(body) == {"error"}
        assert set(body["error"]) == {"code", "message"}
        assert body["error"]["code"] == "validation_error"


def test_error_shape_missing_field():
    with TestClient(app) as client:
        r = client.post("/api/tasks", json={"actor_id": "u_zh"})
        assert r.status_code == 422
        assert set(r.json()) == {"error"}
        assert r.json()["error"]["code"] == "validation_error"


def test_create_task_and_list_todo():
    with TestClient(app) as client:
        r = client.post("/api/tasks", json={
            "actor_id": "u_zh", "title": "测试任务", "description": "",
            "plan_date": "2026-11-21", "due_at": "2026-11-21T17:00:00+08:00",
            "executor_id": "u_retail", "reviewer_id": "u_ops",
        })
        assert r.status_code == 200
        tid = r.json()["id"]
        rr = client.get("/api/tasks", params={"view": "todo", "role": "u_retail"})
        assert tid in [t["id"] for t in rr.json()["tasks"]]


def test_bootstrap_and_reset():
    with TestClient(app) as client:
        r = client.get("/api/bootstrap")
        assert r.status_code == 200
        assert len(r.json()["users"]) == 4
        r = client.post("/api/reset")
        assert r.status_code == 200
        assert r.json()["ok"] is True
