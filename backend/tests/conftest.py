"""测试基座：在任何 app 模块导入前，先把数据库指向临时文件、固定演示时钟、清空模型密钥。"""
from __future__ import annotations

import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(prefix="branchrelay-test-"), "test.db")
os.environ["DEMO_TIME"] = "2026-11-20T10:00:00+08:00"
os.environ["MODEL_API_KEY"] = ""

import pytest

from app.services import repository


@pytest.fixture(autouse=True)
def _reset_db():
    repository.reset_db()
    yield
