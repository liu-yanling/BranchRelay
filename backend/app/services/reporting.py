"""周报 / 诊断 / 摘要 / 问答的规则化取数与降级。

原则：程序算数与状态，模型只组织语言。本模块提供确定性的取数与规则汇总，
ai_services.py 在此基础上叠加模型润色；模型不可用时直接返回本模块的规则化结果。
"""
from __future__ import annotations

import sqlite3
from datetime import timedelta

from app.core.constants import COMPLETED, IN_PROGRESS, PENDING_REVIEW, PENDING_SUPPLEMENT
from app.core.db import demo_now, get_conn, iso, monday_of, parse_dt
from app.core.errors import AppError

from . import domain
from . import repository as repo


def _require_user(conn: sqlite3.Connection, role_id: str) -> dict:
    user = repo.get_user(conn, role_id)
    if user is None:
        raise AppError("未知身份", code="not_found", http_status=404)
    return user


def report_facts(role_id: str, scope: str, week_start: str) -> dict:
    """返回给定范围、周的报告事实：分组 id、任务事实与统计截止时间。

    历史周按「当期截止前的最后事件」还原，排除之后的操作。
    """
    conn = get_conn()
    try:
        user = _require_user(conn, role_id)
        if scope == "branch" and not user["is_manager"]:
            raise AppError("支行范围仅负责人可用", code="forbidden", http_status=403)
        ws = parse_dt(week_start)
        if ws is None:
            raise AppError("周起始日格式不正确", code="validation_error", http_status=400)
        ws = monday_of(ws)
        we = ws + timedelta(days=7)
        now = demo_now()
        cutoff = now if ws == monday_of(now) else we  # 本周未结束用演示时刻，历史周用周末

        if scope == "branch":
            tasks = repo.list_tasks(conn)
        else:
            tasks = repo.list_tasks_visible(conn, role_id, is_manager=False)

        events = repo.list_all_events(conn)

        completed_ids, pending_ids, next_week_ids = [], [], []
        facts = []
        for t in tasks:
            tev = [e for e in events if e["task_id"] == t["id"] and parse_dt(e["created_at"]) <= cutoff]
            approved_this_week = any(
                e["action"] == "approve" and ws <= parse_dt(e["created_at"]) < we
                for e in events if e["task_id"] == t["id"]
            )
            snap_status = t["status"]
            snap_owner = t["current_owner_id"]
            if tev:
                snap_status = tev[-1]["to_status"] or snap_status
                snap_owner = tev[-1]["owner_after"]
            snap_completed = snap_status == COMPLETED
            plan = parse_dt(t["plan_date"])
            due = parse_dt(t["due_at"])
            in_week = (
                (plan is not None and ws <= plan < we)
                or (due is not None and ws <= due < we)
                or any(ws <= parse_dt(e["created_at"]) < we for e in tev)
            )
            records = [e["note"] for e in tev if ws <= parse_dt(e["created_at"]) < we and e["note"]]

            fact = {
                "task_id": t["id"],
                "title": t["title"],
                "node": snap_status,
                "owner": snap_owner or "",
                "plan_date": t["plan_date"],
                "due_at": t["due_at"],
                "records": records,
                "completed_at": t["completed_at"] if snap_completed else None,
                "overdue": snap_status != COMPLETED and due is not None and due < cutoff,
            }
            if approved_this_week:
                completed_ids.append(t["id"])
            elif (plan is not None and we <= plan < we + timedelta(days=7)) or (due is not None and we <= due < we + timedelta(days=7)):
                next_week_ids.append(t["id"])
            elif in_week and not snap_completed:
                pending_ids.append(t["id"])
            facts.append(fact)

        by_id = {f["task_id"]: f for f in facts}

        def priority(tid: str) -> int:
            f = by_id[tid]
            if f["overdue"]:
                return 0
            if f["node"] == PENDING_SUPPLEMENT:
                return 1
            if f["node"] == PENDING_REVIEW:
                return 2
            return 3

        pending_ids.sort(key=lambda x: (priority(x), by_id[x]["due_at"]))
        completed_ids.sort(key=lambda x: by_id[x]["completed_at"] or "")
        next_week_ids.sort(key=lambda x: by_id[x]["plan_date"])

        return {
            "scope": scope,
            "week_start": ws.isoformat(),
            "week_end": we.isoformat(),
            "data_cutoff": iso(cutoff),
            "is_current_week": ws == monday_of(now),
            "completed": completed_ids,
            "pending": pending_ids,
            "next_week": next_week_ids,
            "facts": facts,
        }
    finally:
        conn.close()


def rule_report_text(fact: dict, group: str) -> str:
    """规则化周报文字（模型不可用或引用校验失败时的兜底）。"""
    tid = fact["task_id"]
    if group == "completed":
        at = fact.get("completed_at")
        suffix = f"，完成于 {parse_dt(at).strftime('%m-%d %H:%M')}" if at else ""
        return f"{tid} 复核通过{suffix}。"
    if group == "next_week":
        return f"{tid} 计划于 {fact['plan_date']} 办理。"
    node = fact["node"]
    due = fact["due_at"]
    if node == PENDING_REVIEW:
        return f"{tid} 已提交，待复核（截止 {due}）。"
    if node == PENDING_SUPPLEMENT:
        extra = "，已逾期" if fact["overdue"] else ""
        return f"{tid} 被退回待补充{extra}（截止 {due}）。"
    if node == IN_PROGRESS:
        extra = "，已逾期" if fact["overdue"] else ""
        return f"{tid} 办理中{extra}（截止 {due}）。"
    return f"{tid} 待办理（截止 {due}）。"


def rule_report(role_id: str, scope: str, week_start: str) -> dict:
    """规则汇总周报（始终可用的确定性兜底）。"""
    f = report_facts(role_id, scope, week_start)
    by_id = {x["task_id"]: x for x in f["facts"]}

    def build(ids, group):
        return [{"task_id": i, "text": rule_report_text(by_id[i], group)} for i in ids]

    return {
        "scope": f["scope"],
        "week_start": f["week_start"],
        "week_end": f["week_end"],
        "data_cutoff": f["data_cutoff"],
        "is_current_week": f["is_current_week"],
        "method": "rules",
        "completed": build(f["completed"], "completed"),
        "pending": build(f["pending"], "pending"),
        "next_week": build(f["next_week"], "next_week"),
        "empty": not (f["completed"] or f["pending"] or f["next_week"]),
    }


def diagnosis_rules(role_id: str) -> dict:
    """看板一键诊断的规则化风险点（负责人视角）。"""
    conn = get_conn()
    try:
        user = _require_user(conn, role_id)
        if not user["is_manager"]:
            raise AppError("仅支行负责人可诊断", code="forbidden", http_status=403)
        now = demo_now()
        ws = monday_of(now)
        we = ws + timedelta(days=7)
        tasks = repo.list_tasks(conn)
        risks = []
        for t in tasks:
            plan = parse_dt(t["plan_date"])
            due = parse_dt(t["due_at"])
            in_week = (plan is not None and ws <= plan < we) or (due is not None and ws <= due < we)
            if not in_week:
                continue
            if t["status"] == COMPLETED:
                continue
            owner = t["current_owner_id"] or t["executor_id"]
            owner_name = repo.get_user(conn, owner)["name"]
            if due is not None and due < now:
                risks.append({"task_id": t["id"], "type": "overdue", "status": t["status"],
                              "owner": owner_name, "advice": f"已逾期，建议 {owner_name} 尽快办理或说明原因。"})
            elif t["status"] == PENDING_REVIEW:
                risks.append({"task_id": t["id"], "type": "review_waiting", "status": t["status"],
                              "owner": owner_name, "advice": f"等待复核，建议 {owner_name} 及时处理。"})
            elif t["status"] == PENDING_SUPPLEMENT:
                risks.append({"task_id": t["id"], "type": "supplement_stuck", "status": t["status"],
                              "owner": owner_name, "advice": f"被退回待补充，建议 {owner_name} 按意见补齐后重新提交。"})
            elif due is not None and now <= due <= now + timedelta(hours=24):
                risks.append({"task_id": t["id"], "type": "due_soon", "status": t["status"],
                              "owner": owner_name, "advice": f"临近截止，建议 {owner_name} 优先推进。"})
        return {"risks": risks, "method": "rules", "data_cutoff": iso(now)}
    finally:
        conn.close()


def summary_rules(task_id: str, role_id: str) -> dict:
    """单任务一句话进展摘要（规则化兜底）。"""
    domain.task_detail(task_id, role_id)  # 触发可见性校验
    conn = get_conn()
    try:
        evs = conn.execute(
            "SELECT * FROM events WHERE task_id=? ORDER BY created_at DESC, id DESC LIMIT 1",
            (task_id,),
        ).fetchone()
        if evs is None:
            return {"summary": "", "method": "rules"}
        ev = dict(evs)
        label = domain.ACTION_LABEL.get(ev["action"], ev["action"])
        note = ev["note"] or ""
        text = f"{label}" + (f"：{note}" if note else "")
        return {"summary": text, "method": "rules"}
    finally:
        conn.close()


def answer_rules(question: str, role_id: str) -> dict:
    """自然语言看板问答的规则化兜底（负责人视角）。"""
    conn = get_conn()
    try:
        user = _require_user(conn, role_id)
        if not user["is_manager"]:
            return {"answer": "问答仅对支行负责人开放，您只能查看个人范围。", "refs": [], "method": "rules"}
        now = demo_now()
        q = question or ""
        tasks = repo.list_tasks(conn)
        name = {u["id"]: u["name"] for u in repo.list_users(conn)}

        def refs_of(pred):
            return [t["id"] for t in tasks if pred(t)]

        if "逾期" in q or "超时" in q:
            overdue = refs_of(lambda t: t["status"] != COMPLETED and parse_dt(t["due_at"]) and parse_dt(t["due_at"]) < now)
            if "最多" in q or "谁" in q:
                from collections import Counter
                cnt = Counter(t["current_owner_id"] or t["executor_id"] for t in tasks
                              if t["status"] != COMPLETED and parse_dt(t["due_at"]) and parse_dt(t["due_at"]) < now)
                if cnt:
                    top, n = cnt.most_common(1)[0]
                    return {"answer": f"当前逾期最多的是 {name.get(top, top)}，共 {n} 项逾期任务。", "refs": overdue, "method": "rules"}
                return {"answer": "当前没有逾期任务。", "refs": [], "method": "rules"}
            return {"answer": f"当前有 {len(overdue)} 项逾期任务：{'、'.join(overdue) if overdue else '无'}。", "refs": overdue, "method": "rules"}
        if "复核" in q or "卡" in q:
            pr = refs_of(lambda t: t["status"] == PENDING_REVIEW)
            return {"answer": f"当前有 {len(pr)} 项任务等待复核：{'、'.join(pr) if pr else '无'}。", "refs": pr, "method": "rules"}
        if "待补充" in q or "退回" in q:
            ps = refs_of(lambda t: t["status"] == PENDING_SUPPLEMENT)
            return {"answer": f"当前有 {len(ps)} 项任务待补充：{'、'.join(ps) if ps else '无'}。", "refs": ps, "method": "rules"}
        if "完成" in q:
            done = refs_of(lambda t: t["status"] == COMPLETED)
            return {"answer": f"当前已完成 {len(done)} 项任务：{'、'.join(done) if done else '无'}。", "refs": done, "method": "rules"}
        if "下周" in q or "安排" in q:
            nw = refs_of(lambda t: parse_dt(t["plan_date"]) and parse_dt(t["plan_date"]) >= monday_of(now) + timedelta(days=7))
            return {"answer": f"下周安排：{'、'.join(nw) if nw else '暂无已登记安排'}。", "refs": nw, "method": "rules"}
        return {"answer": "未查询到相关进度，请尝试：逾期 / 复核 / 待补充 / 已完成 / 下周安排。", "refs": [], "method": "rules"}
    finally:
        conn.close()


def report_draft_get(role_id: str, scope: str, week_start: str) -> dict | None:
    conn = get_conn()
    try:
        return repo.get_report_draft(conn, role_id, scope, week_start)
    finally:
        conn.close()


def report_draft_save(role_id: str, scope: str, week_start: str, content: str, method: str, cutoff: str) -> None:
    conn = get_conn()
    try:
        repo.save_report_draft(
            conn, role_id=role_id, scope=scope, week_start=week_start,
            content=content, method=method, cutoff=cutoff, edited_at=iso(demo_now()),
        )
        conn.commit()
    finally:
        conn.close()
