"""SQLite 表结构（DDL）。数据读写统一走 services/repository.py。"""
from __future__ import annotations

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  post TEXT NOT NULL,
  is_manager INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  creator_id TEXT NOT NULL,
  executor_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  current_owner_id TEXT,
  plan_date TEXT NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  submit_note TEXT,
  reject_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  owner_after TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  type TEXT NOT NULL,
  dedup_key TEXT NOT NULL UNIQUE,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE TABLE IF NOT EXISTS report_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  week_start TEXT NOT NULL,
  data_cutoff TEXT NOT NULL,
  content TEXT NOT NULL,
  method TEXT NOT NULL,
  edited_at TEXT NOT NULL,
  UNIQUE(owner_id, scope, week_start)
);
"""
