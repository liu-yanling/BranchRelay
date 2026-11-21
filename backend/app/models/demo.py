"""演示数据快照：四个身份、六项任务与合法历史。

任务编号、业务内容与角色安排均为虚构。重置后回到 2026-11-20 10:00 的演示快照。
"""
from __future__ import annotations

USERS = [
    ("u_zh", "综合岗", "综合岗", 0),
    ("u_retail", "零售岗", "零售岗", 0),
    ("u_ops", "运营岗", "运营岗", 0),
    ("u_mgr", "支行负责人", "支行负责人", 1),
]


def build_demo_tasks() -> list[dict]:
    """六项任务 + 合法历史（事件时间均早于演示时钟）。"""
    return [
        {
            "id": "T-001", "title": "汇总周例会材料", "description": "汇总各部门本周工作要点，形成周例会汇报材料。",
            "creator_id": "u_zh", "executor_id": "u_retail", "reviewer_id": "u_ops",
            "plan_date": "2026-11-16", "due_at": "2026-11-18T17:00:00+08:00",
            "created_at": "2026-11-14T09:00:00+08:00",
            "events": [
                ("create", "u_zh", "待办理", "待办理", "u_retail", "发起任务", "2026-11-14T09:00:00+08:00"),
                ("start", "u_retail", "待办理", "办理中", "u_retail", "开始办理", "2026-11-16T09:30:00+08:00"),
                ("update", "u_retail", "办理中", "办理中", "u_retail", "材料框架已搭好，正在补充各条线数据。", "2026-11-17T16:00:00+08:00"),
                ("submit", "u_retail", "办理中", "待复核", "u_ops", "材料已汇总，请复核数据口径。", "2026-11-18T15:00:00+08:00"),
                ("approve", "u_ops", "待复核", "已完成", None, "数据口径无误，通过。", "2026-11-18T16:30:00+08:00"),
            ],
            "status": "已完成", "current_owner_id": None,
            "completed_at": "2026-11-18T16:30:00+08:00",
        },
        {
            "id": "T-002", "title": "核对宣传活动场地安排", "description": "核对金融知识宣传活动的场地、时段与物料布置安排。",
            "creator_id": "u_zh", "executor_id": "u_retail", "reviewer_id": "u_ops",
            "plan_date": "2026-11-17", "due_at": "2026-11-19T17:00:00+08:00",
            "created_at": "2026-11-15T10:00:00+08:00",
            "events": [
                ("create", "u_zh", "待办理", "待办理", "u_retail", "发起任务", "2026-11-15T10:00:00+08:00"),
                ("start", "u_retail", "待办理", "办理中", "u_retail", "开始办理", "2026-11-17T09:00:00+08:00"),
                ("update", "u_retail", "办理中", "办理中", "u_retail", "已与物业确认场地档期。", "2026-11-18T14:00:00+08:00"),
                ("submit", "u_retail", "办理中", "待复核", "u_ops", "场地与时间已确认，请复核。", "2026-11-19T15:00:00+08:00"),
                ("approve", "u_ops", "待复核", "已完成", None, "通过。", "2026-11-19T16:00:00+08:00"),
            ],
            "status": "已完成", "current_owner_id": None,
            "completed_at": "2026-11-19T16:00:00+08:00",
        },
        {
            "id": "T-003", "title": "准备金融知识宣传初稿", "description": "编写金融知识宣传活动的文案初稿，明确活动时间与形式。",
            "creator_id": "u_zh", "executor_id": "u_retail", "reviewer_id": "u_ops",
            "plan_date": "2026-11-16", "due_at": "2026-11-20T16:00:00+08:00",
            "created_at": "2026-11-14T10:00:00+08:00",
            "events": [
                ("create", "u_zh", "待办理", "待办理", "u_retail", "发起任务", "2026-11-14T10:00:00+08:00"),
                ("start", "u_retail", "待办理", "办理中", "u_retail", "开始办理", "2026-11-16T10:00:00+08:00"),
                ("update", "u_retail", "办理中", "办理中", "u_retail", "初稿框架完成，正在补充活动时间细节。", "2026-11-18T11:00:00+08:00"),
            ],
            "status": "办理中", "current_owner_id": "u_retail",
            "completed_at": None,
        },
        {
            "id": "T-004", "title": "补充内部培训通知", "description": "补充内部培训通知的内容并发布。",
            "creator_id": "u_zh", "executor_id": "u_retail", "reviewer_id": "u_ops",
            "plan_date": "2026-11-18", "due_at": "2026-11-19T16:00:00+08:00",
            "created_at": "2026-11-17T09:00:00+08:00",
            "events": [
                ("create", "u_zh", "待办理", "待办理", "u_retail", "发起任务", "2026-11-17T09:00:00+08:00"),
                ("start", "u_retail", "待办理", "办理中", "u_retail", "开始办理", "2026-11-18T09:00:00+08:00"),
                ("submit", "u_retail", "办理中", "待复核", "u_ops", "培训通知已拟，请复核。", "2026-11-19T10:00:00+08:00"),
                ("reject", "u_ops", "待复核", "待补充", "u_retail", "请补充签到时间。", "2026-11-19T11:00:00+08:00"),
            ],
            "status": "待补充", "current_owner_id": "u_retail",
            "reject_reason": "请补充签到时间",
            "completed_at": None,
        },
        {
            "id": "T-005", "title": "复核活动物料清单", "description": "核对宣传活动所需物料的清单、数量与预算。",
            "creator_id": "u_zh", "executor_id": "u_retail", "reviewer_id": "u_ops",
            "plan_date": "2026-11-19", "due_at": "2026-11-20T17:00:00+08:00",
            "created_at": "2026-11-18T09:00:00+08:00",
            "events": [
                ("create", "u_zh", "待办理", "待办理", "u_retail", "发起任务", "2026-11-18T09:00:00+08:00"),
                ("start", "u_retail", "待办理", "办理中", "u_retail", "开始办理", "2026-11-19T09:00:00+08:00"),
                ("submit", "u_retail", "办理中", "待复核", "u_ops", "物料清单已列，请核对数量与预算。", "2026-11-20T09:00:00+08:00"),
            ],
            "status": "待复核", "current_owner_id": "u_ops",
            "submit_note": "物料清单已列，请核对数量与预算。",
            "completed_at": None,
        },
        {
            "id": "T-006", "title": "安排下周员工分享会", "description": "确定下周员工分享会的主题、分享人与时间。",
            "creator_id": "u_zh", "executor_id": "u_retail", "reviewer_id": "u_ops",
            "plan_date": "2026-11-23", "due_at": "2026-11-25T17:00:00+08:00",
            "created_at": "2026-11-13T09:00:00+08:00",
            "events": [
                ("create", "u_zh", "待办理", "待办理", "u_retail", "发起任务", "2026-11-13T09:00:00+08:00"),
            ],
            "status": "待办理", "current_owner_id": "u_retail",
            "completed_at": None,
        },
    ]
