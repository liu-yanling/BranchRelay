"""领域逻辑：任务状态机、权限/版本校验、工作台/看板统计、到期提醒。

本模块只做业务规则，数据读写统一走 repository；错误统一抛 AppError。
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta

from app.core.constants import COMPLETED, IN_PROGRESS, PENDING, PENDING_REVIEW, PENDING_SUPPLEMENT
from app.core.db import demo_now, get_conn, iso, monday_of, parse_dt
from app.core.errors import AppError
from app.schemas.task import TaskCreate

from . import repository as repo

# 动作 -> (前置状态集合, 目标状态, 允许角色字段, 目标处理人字段, 是否记录完成时间)
ACTION_DEF = {
    "start": {"from": [PENDING], "to": IN_PROGRESS, "role_field": "executor_id"},
    "update_progress": {"from": [IN_PROGRESS, PENDING_SUPPLEMENT], "to": None, "role_field": "executor_id"},
    "submit_review": {"from": [IN_PROGRESS, PENDING_SUPPLEMENT], "to": PENDING_REVIEW, "role_field": "executor_id", "owner": "reviewer_id", "require_note": "交付说明"},
    "reject": {"from": [PENDING_REVIEW], "to": PENDING_SUPPLEMENT, "role_field": "reviewer_id", "owner": "executor_id", "require_note": "退回原因"},
    "approve": {"from": [PENDING_REVIEW], "to": COMPLETED, "role_field": "reviewer_id", "owner": None, "complete": True},
}

ACTION_LABEL = {
    "create": "创建任务",
    "start": "开始办理",
    "update_progress": "更新进展",
    "submit_review": "提交复核",
    "reject": "退回补充",
    "approve": "复核通过",
}


def _require_user(conn: sqlite3.Connection, role_id: str) -> dict:
    user = repo.get_user(conn, role_id)
    if user is None:
        raise AppError("未知身份", code="not_found", http_status=404)
    return user


def create_task(payload: TaskCreate) -> dict:
    conn = get_conn()
    try:
        user = _require_user(conn, payload.actor_id)
        if user["post"] != "综合岗":
            raise AppError("仅综合岗可以安排任务", code="forbidden", http_status=403)

        title = (payload.title or "").strip()
        description = (payload.description or "").strip()
        plan_date = (payload.plan_date or "").strip()
        due_at = (payload.due_at or "").strip()
        executor_id = (payload.executor_id or "").strip()
        reviewer_id = (payload.reviewer_id or "").strip()

        if not (title and plan_date and due_at and executor_id and reviewer_id):
            raise AppError("标题、经办人、复核人、计划日、截止时间均为必填", code="validation_error", http_status=400)
        if executor_id == reviewer_id:
            raise AppError("同一任务的经办人与复核人须不同", code="validation_error", http_status=400)

        pd = parse_dt(plan_date)
        dd = parse_dt(due_at)
        if pd is None or dd is None:
            raise AppError("计划日或截止时间格式不正确", code="validation_error", http_status=400)
        if dd.date() < pd.date():
            raise AppError("截止日早于计划日", code="validation_error", http_status=400)
        for uid in (executor_id, reviewer_id):
            if repo.get_user(conn, uid) is None:
                raise AppError("经办人或复核人不存在", code="validation_error", http_status=400)

        now = demo_now()
        task_id = repo.next_task_id(conn)
        repo.insert_task(
            conn, task_id=task_id, title=title, description=description,
            creator_id=payload.actor_id, executor_id=executor_id, reviewer_id=reviewer_id,
            current_owner_id=executor_id, plan_date=plan_date, due_at=due_at,
            status=PENDING, version=1, created_at=iso(now), updated_at=iso(now),
        )
        repo.insert_event(
            conn, task_id=task_id, actor_id=payload.actor_id, action="create",
            from_status=None, to_status=PENDING, owner_after=executor_id,
            note="发起任务", created_at=iso(now),
        )
        conn.commit()
        _notify(conn, executor_id, task_id, "handover", "有新的待办任务，请及时办理", now)
        return repo.get_task(conn, task_id)
    finally:
        conn.close()


def apply_action(actor_id: str, task_id: str, action: str, note: str, expected_version: int) -> dict:
    conn = get_conn()
    try:
        task = repo.get_task(conn, task_id)
        if task is None:
            raise AppError("任务不存在", code="not_found", http_status=404)
        if action not in ACTION_DEF:
            raise AppError("未知操作", code="bad_request", http_status=400)
        definition = ACTION_DEF[action]
        if task["status"] not in definition["from"]:
            raise AppError(f"当前状态「{task['status']}」不能执行{ACTION_LABEL[action]}", code="conflict", http_status=409)
        if task["current_owner_id"] != actor_id:
            raise AppError("该操作只对当前处理人开放", code="forbidden", http_status=403)
        if actor_id != task[definition["role_field"]]:
            raise AppError("无权执行此操作", code="forbidden", http_status=403)
        if expected_version != task["version"]:
            raise AppError("任务已更新，请查看最新状态", code="conflict", http_status=409)
        if definition.get("require_note") and not (note or "").strip():
            raise AppError(f"{definition['require_note']}为必填", code="validation_error", http_status=400)

        now = demo_now()
        to_status = definition["to"] if definition["to"] else task["status"]
        if definition.get("owner"):
            owner_after = task[definition["owner"]]
        elif definition.get("complete"):
            owner_after = None
        else:
            owner_after = task["current_owner_id"]

        completed_at = iso(now) if definition.get("complete") else task["completed_at"]
        submit_note = note if action == "submit_review" else task["submit_note"]
        reject_reason = note if action == "reject" else task["reject_reason"]

        repo.update_task_status(
            conn, task_id=task_id, status=to_status, current_owner_id=owner_after,
            version=task["version"] + 1, submit_note=submit_note, reject_reason=reject_reason,
            updated_at=iso(now), completed_at=completed_at,
        )
        repo.insert_event(
            conn, task_id=task_id, actor_id=actor_id, action=action,
            from_status=task["status"], to_status=to_status, owner_after=owner_after,
            note=(note or "").strip(), created_at=iso(now),
        )

        if action == "submit_review":
            _notify(conn, task["reviewer_id"], task_id, "handover", "有任务提交复核，请查看提交说明", now)
        elif action == "reject":
            _notify(conn, task["executor_id"], task_id, "handover", "任务被退回，请按意见补充", now)
        elif action == "approve":
            for uid in (task["creator_id"], task["executor_id"]):
                if uid != actor_id:
                    _notify(conn, uid, task_id, "handover", "任务已复核通过", now)

        conn.commit()
        return repo.get_task(conn, task_id)
    finally:
        conn.close()


def _notify(conn: sqlite3.Connection, recipient_id: str, task_id: str, ntype: str, message: str, now: datetime) -> None:
    key = f"{recipient_id}|{task_id}|{ntype}|{iso(now)}"
    repo.insert_notification(
        conn, recipient_id=recipient_id, task_id=task_id, ntype=ntype,
        dedup_key=key, message=message, created_at=iso(now),
    )


def due_reminder_state(task: dict, now: datetime) -> str | None:
    """返回 None / 'due_soon' / 'overdue'。已完成任务不再提醒。"""
    if task["status"] == COMPLETED:
        return None
    due = parse_dt(task["due_at"])
    if due is None:
        return None
    if due < now:
        return "overdue"
    if due <= now + timedelta(hours=24):
        return "due_soon"
    return None


def ensure_due_reminders(role_id: str) -> None:
    """为当前处理人生成临期/逾期提醒（打开应用与轮询时调用，幂等）。"""
    conn = get_conn()
    try:
        now = demo_now()
        rows = conn.execute(
            "SELECT * FROM tasks WHERE current_owner_id=? AND status!=?",
            (role_id, COMPLETED),
        ).fetchall()
        for t in rows:
            t = dict(t)
            state = due_reminder_state(t, now)
            if state is None:
                continue
            due = parse_dt(t["due_at"])
            label = "已逾期" if state == "overdue" else "即将到期"
            key = f"{t['id']}|{role_id}|{t['due_at']}|{state}"
            msg = f"任务「{t['title']}」{label}，截止 {due.strftime('%m-%d %H:%M')}"
            repo.insert_notification(
                conn, recipient_id=role_id, task_id=t["id"], ntype=state,
                dedup_key=key, message=msg, created_at=iso(now),
            )
        conn.commit()
    finally:
        conn.close()


def task_detail(task_id: str, role_id: str) -> dict:
    conn = get_conn()
    try:
        task = repo.get_task(conn, task_id)
        if task is None:
            raise AppError("任务不存在", code="not_found", http_status=404)
        user = _require_user(conn, role_id)
        if not user["is_manager"] and role_id not in (
            task["creator_id"], task["executor_id"], task["reviewer_id"]
        ):
            raise AppError("无权查看该任务", code="forbidden", http_status=403)
        events = repo.list_events(conn, task_id)
        users = {u["id"]: u["name"] for u in repo.list_users(conn)}
        task["events"] = [
            {**e, "actor_name": users.get(e["actor_id"], e["actor_id"]),
             "action_label": ACTION_LABEL.get(e["action"], e["action"])}
            for e in events
        ]
        task["creator_name"] = users.get(task["creator_id"], task["creator_id"])
        task["executor_name"] = users.get(task["executor_id"], task["executor_id"])
        task["reviewer_name"] = users.get(task["reviewer_id"], task["reviewer_id"])
        task["owner_name"] = users.get(task["current_owner_id"], "") if task["current_owner_id"] else ""
        task["due_state"] = due_reminder_state(task, demo_now())
        return task
    finally:
        conn.close()


def visible_tasks(role_id: str) -> list[dict]:
    conn = get_conn()
    try:
        user = _require_user(conn, role_id)
        return repo.list_tasks_visible(conn, role_id, bool(user["is_manager"]))
    finally:
        conn.close()


def _event_scope(conn: sqlite3.Connection) -> dict[str, set]:
    now = demo_now()
    ws = monday_of(now)
    we = ws + timedelta(days=7)
    out: dict[str, set] = {ws.isoformat(): set()}
    for r in repo.list_all_events(conn):
        dt = parse_dt(r["created_at"])
        if dt and ws <= dt < we:
            out[ws.isoformat()].add(r["task_id"])
    return out


def _decorate(t: dict, now: datetime, is_overdue: bool | None = None, is_today: bool | None = None) -> dict:
    t = dict(t)
    due = parse_dt(t["due_at"])
    if is_overdue is None:
        is_overdue = t["status"] != COMPLETED and due is not None and due < now
    if is_today is None:
        is_today = due is not None and due.date() == now.date()
    t["is_overdue"] = is_overdue
    t["is_today"] = is_today
    t["due_state"] = "overdue" if is_overdue else ("due_soon" if (
        t["status"] != COMPLETED and due and due <= now + timedelta(hours=24)
    ) else None)
    return t


def workbench(role_id: str, view: str) -> list[dict]:
    conn = get_conn()
    try:
        _require_user(conn, role_id)
        now = demo_now()
        tasks = visible_tasks(role_id)
        result: list[dict] = []
        today = now.date()
        if view == "today":
            for t in tasks:
                due = parse_dt(t["due_at"])
                is_overdue = due is not None and due < now
                is_today = due is not None and due.date() == today
                if t["current_owner_id"] == role_id and (is_overdue or is_today):
                    result.append(_decorate(t, now, is_overdue, is_today))
            result.sort(key=lambda x: (0 if x["is_overdue"] else 1, x["due_at"]))
        elif view == "week":
            ws = monday_of(now)
            we = ws + timedelta(days=7)
            ev_ids = _event_scope(conn)
            for t in tasks:
                plan = parse_dt(t["plan_date"])
                due = parse_dt(t["due_at"])
                in_week = (
                    (plan is not None and ws <= plan < we)
                    or (due is not None and ws <= due < we)
                    or (t["id"] in ev_ids.get(ws.isoformat(), set()))
                )
                if in_week:
                    result.append(_decorate(t, now))
            result.sort(key=lambda x: x["due_at"])
        elif view == "todo":
            for t in tasks:
                if t["current_owner_id"] == role_id and t["status"] != COMPLETED:
                    result.append(_decorate(t, now))
            result.sort(key=lambda x: x["due_at"])
        else:
            raise AppError("未知视图", code="bad_request", http_status=400)
        return result
    finally:
        conn.close()


def board(role_id: str, filter_by: str | None = None) -> dict:
    conn = get_conn()
    try:
        user = _require_user(conn, role_id)
        if not user["is_manager"]:
            raise AppError("仅支行负责人可查看看板", code="forbidden", http_status=403)
        now = demo_now()
        ws = monday_of(now)
        we = ws + timedelta(days=7)
        all_tasks = repo.list_tasks(conn)
        week_tasks = []
        ev_in_week = set()
        for r in repo.list_all_events(conn):
            dt = parse_dt(r["created_at"])
            if dt and ws <= dt < we:
                ev_in_week.add(r["task_id"])
        for t in all_tasks:
            plan = parse_dt(t["plan_date"])
            due = parse_dt(t["due_at"])
            if (plan is not None and ws <= plan < we) or (due is not None and ws <= due < we) or t["id"] in ev_in_week:
                week_tasks.append(_decorate(t, now))
        stats = {
            "total": len(week_tasks),
            "completed": sum(1 for t in week_tasks if t["status"] == COMPLETED),
            "pending_review": sum(1 for t in week_tasks if t["status"] == PENDING_REVIEW),
            "overdue": sum(1 for t in week_tasks if t["is_overdue"]),
        }
        shown = week_tasks
        if filter_by == "completed":
            shown = [t for t in week_tasks if t["status"] == COMPLETED]
        elif filter_by == "pending_review":
            shown = [t for t in week_tasks if t["status"] == PENDING_REVIEW]
        elif filter_by == "overdue":
            shown = [t for t in week_tasks if t["is_overdue"]]
        for t in shown:
            if t["status"] == PENDING_REVIEW:
                submit_ev = conn.execute(
                    "SELECT * FROM events WHERE task_id=? AND action='submit_review' ORDER BY created_at DESC, id DESC LIMIT 1",
                    (t["id"],),
                ).fetchone()
                if submit_ev:
                    t["submit_note"] = t.get("submit_note") or submit_ev["note"]
                    t["wait_since"] = submit_ev["created_at"]
        return {"stats": stats, "tasks": shown, "week_start": ws.isoformat()}
    finally:
        conn.close()


def list_notifications(role_id: str) -> dict:
    ensure_due_reminders(role_id)
    conn = get_conn()
    try:
        items = repo.list_notifications(conn, role_id)
        unread = sum(1 for r in items if not r["read_at"])
        titles = {r["id"]: r["title"] for r in repo.list_tasks(conn)}
        for it in items:
            it["task_title"] = titles.get(it["task_id"], it["task_id"])
        return {"notifications": items, "unread": unread}
    finally:
        conn.close()


def mark_read(nid: int) -> None:
    conn = get_conn()
    try:
        repo.mark_notification_read(conn, nid, iso(demo_now()))
        conn.commit()
    finally:
        conn.close()
