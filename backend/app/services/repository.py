"""数据访问层（唯一读写 SQLite 的地方）。

领域逻辑（状态机、权限、统计、提醒）在 domain.py，通过本模块的函数读写数据；
未来替换存储实现时，只需保持本模块函数签名不变。
"""
from __future__ import annotations

import sqlite3
from typing import Any

from app.core.db import get_conn, iso
from app.models.demo import USERS, build_demo_tasks
from app.models.schema import SCHEMA


# ---------- 用户 ----------

def list_users(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM users ORDER BY is_manager, id").fetchall()
    return [dict(r) for r in rows]


def get_user(conn: sqlite3.Connection, user_id: str) -> dict | None:
    r = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    return dict(r) if r else None


# ---------- 任务 ----------

def list_tasks(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM tasks ORDER BY due_at").fetchall()
    return [dict(r) for r in rows]


def list_tasks_visible(conn: sqlite3.Connection, role_id: str, is_manager: bool) -> list[dict]:
    if is_manager:
        return list_tasks(conn)
    rows = conn.execute(
        """SELECT * FROM tasks
           WHERE creator_id=? OR executor_id=? OR reviewer_id=?
           ORDER BY due_at""",
        (role_id, role_id, role_id),
    ).fetchall()
    return [dict(r) for r in rows]


def get_task(conn: sqlite3.Connection, task_id: str) -> dict | None:
    r = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    return dict(r) if r else None


def next_task_id(conn: sqlite3.Connection) -> str:
    max_row = conn.execute(
        "SELECT id FROM tasks WHERE id LIKE 'T-%' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    count = conn.execute("SELECT COUNT(*) AS c FROM tasks WHERE id LIKE 'T-%'").fetchone()["c"]
    n = count + 1
    if max_row:
        try:
            n = max(int(max_row["id"][2:]), count) + 1
        except ValueError:
            pass
    return f"T-{n:03d}"


def insert_task(
    conn: sqlite3.Connection,
    *,
    task_id: str,
    title: str,
    description: str,
    creator_id: str,
    executor_id: str,
    reviewer_id: str,
    current_owner_id: str,
    plan_date: str,
    due_at: str,
    status: str,
    version: int,
    created_at: str,
    updated_at: str,
) -> None:
    conn.execute(
        """INSERT INTO tasks
           (id, title, description, creator_id, executor_id, reviewer_id,
            current_owner_id, plan_date, due_at, status, version, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (task_id, title, description, creator_id, executor_id, reviewer_id,
         current_owner_id, plan_date, due_at, status, version, created_at, updated_at),
    )


def update_task_status(
    conn: sqlite3.Connection,
    *,
    task_id: str,
    status: str,
    current_owner_id: str | None,
    version: int,
    submit_note: str | None,
    reject_reason: str | None,
    updated_at: str,
    completed_at: str | None,
) -> None:
    conn.execute(
        """UPDATE tasks SET status=?, current_owner_id=?, version=?, submit_note=?,
           reject_reason=?, updated_at=?, completed_at=? WHERE id=?""",
        (status, current_owner_id, version, submit_note, reject_reason, updated_at, completed_at, task_id),
    )


# ---------- 流转记录 ----------

def insert_event(
    conn: sqlite3.Connection,
    *,
    task_id: str,
    actor_id: str,
    action: str,
    from_status: str | None,
    to_status: str | None,
    owner_after: str | None,
    note: str,
    created_at: str,
) -> None:
    conn.execute(
        """INSERT INTO events (task_id, actor_id, action, from_status, to_status,
           owner_after, note, created_at) VALUES (?,?,?,?,?,?,?,?)""",
        (task_id, actor_id, action, from_status, to_status, owner_after, note, created_at),
    )


def list_events(conn: sqlite3.Connection, task_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM events WHERE task_id=? ORDER BY created_at, id", (task_id,)
    ).fetchall()
    return [dict(r) for r in rows]


def list_all_events(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM events ORDER BY created_at, id").fetchall()
    return [dict(r) for r in rows]


# ---------- 通知 ----------

def insert_notification(
    conn: sqlite3.Connection,
    *,
    recipient_id: str,
    task_id: str,
    ntype: str,
    dedup_key: str,
    message: str,
    created_at: str,
) -> None:
    conn.execute(
        """INSERT OR IGNORE INTO notifications
           (recipient_id, task_id, type, dedup_key, message, created_at)
           VALUES (?,?,?,?,?,?)""",
        (recipient_id, task_id, ntype, dedup_key, message, created_at),
    )


def list_notifications(conn: sqlite3.Connection, role_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM notifications WHERE recipient_id=? ORDER BY created_at DESC, id DESC",
        (role_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def mark_notification_read(conn: sqlite3.Connection, nid: int, read_at: str) -> None:
    conn.execute(
        "UPDATE notifications SET read_at=? WHERE id=? AND read_at IS NULL",
        (read_at, nid),
    )


# ---------- 周报草稿 ----------

def get_report_draft(conn: sqlite3.Connection, role_id: str, scope: str, week_start: str) -> dict | None:
    r = conn.execute(
        "SELECT * FROM report_drafts WHERE owner_id=? AND scope=? AND week_start=?",
        (role_id, scope, week_start),
    ).fetchone()
    return dict(r) if r else None


def save_report_draft(
    conn: sqlite3.Connection,
    *,
    role_id: str,
    scope: str,
    week_start: str,
    content: str,
    method: str,
    cutoff: str,
    edited_at: str,
) -> None:
    conn.execute(
        """INSERT INTO report_drafts (owner_id, scope, week_start, data_cutoff, content, method, edited_at)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(owner_id, scope, week_start)
           DO UPDATE SET data_cutoff=excluded.data_cutoff, content=excluded.content,
                         method=excluded.method, edited_at=excluded.edited_at""",
        (role_id, scope, week_start, cutoff, content, method, edited_at),
    )


# ---------- 初始化与重置 ----------

def _seed(conn: sqlite3.Connection) -> None:
    conn.executemany("INSERT INTO users (id, name, post, is_manager) VALUES (?,?,?,?)", USERS)
    for t in build_demo_tasks():
        version = len(t["events"])
        conn.execute(
            """INSERT INTO tasks
               (id, title, description, creator_id, executor_id, reviewer_id,
                current_owner_id, plan_date, due_at, status, version,
                submit_note, reject_reason, created_at, updated_at, completed_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                t["id"], t["title"], t["description"], t["creator_id"], t["executor_id"],
                t["reviewer_id"], t["current_owner_id"], t["plan_date"], t["due_at"],
                t["status"], version, t.get("submit_note"), t.get("reject_reason"),
                t["created_at"], t["events"][-1][6], t["completed_at"],
            ),
        )
        for e in t["events"]:
            action, actor, frm, to, owner, note, ts = e
            insert_event(
                conn, task_id=t["id"], actor_id=actor, action=action,
                from_status=frm, to_status=to, owner_after=owner, note=note, created_at=ts,
            )


def reset_db() -> None:
    """一次性初始化 / 重置：重建全部表并灌入演示快照。"""
    conn = get_conn()
    try:
        conn.executescript(
            "DROP TABLE IF EXISTS report_drafts;"
            "DROP TABLE IF EXISTS notifications;"
            "DROP TABLE IF EXISTS events;"
            "DROP TABLE IF EXISTS tasks;"
            "DROP TABLE IF EXISTS users;"
        )
        conn.executescript(SCHEMA)
        _seed(conn)
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """应用启动时建表；若库为空则自动灌入演示数据。"""
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)
        has_users = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        conn.commit()
    finally:
        conn.close()
    if has_users == 0:
        reset_db()
