"""SQLite 连接、演示时钟与时间工具。

演示时钟默认固定 2026-11-20 10:00（Asia/Shanghai），可用 DEMO_TIME 覆盖；
所有「现在」相关判断统一走 demo_now()。
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from .config import DB_PATH, DEMO_TIME

TZ = ZoneInfo("Asia/Shanghai")


def demo_now() -> datetime:
    """演示时钟（固定或真实时间），返回 Asia/Shanghai 时区的 aware datetime。"""
    raw = DEMO_TIME
    if raw:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=TZ)
        return dt.astimezone(TZ)
    return datetime.now(TZ)


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ)
    return dt.astimezone(TZ).isoformat()


def parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(s, fmt)
                break
            except ValueError:
                continue
        else:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ)
    return dt.astimezone(TZ)


def monday_of(dt: datetime) -> datetime:
    d = dt.date()
    monday = d - timedelta(days=d.weekday())
    return datetime.combine(monday, datetime.min.time(), tzinfo=TZ)


def get_conn() -> sqlite3.Connection:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
