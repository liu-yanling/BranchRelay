#!/usr/bin/env python3
"""真实模型冒烟脚本：每条 AI 链路各跑一次真实调用，自动追加写入 冒烟记录.md。

用法：cd 产品文件夹 && .venv 之外直接 python3 scripts/smoke.py [阶段名]
     （脚本自行把 backend 加入 sys.path，并从 backend/.env 读模型 Key）
"""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PRODUCT_DIR = SCRIPT_DIR.parent
BACKEND_DIR = PRODUCT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.core import config  # noqa: E402
from app.services import ai_client, ai_services, domain, repository  # noqa: E402

STAGE = sys.argv[1] if len(sys.argv) > 1 else "阶段2-2"


def _prepare() -> None:
    """干净快照 + 提交 T-003（得到「已提交、待复核」的周报场景）。"""
    repository.reset_db()
    v = domain.task_detail("T-003", "u_retail")["version"]
    domain.apply_action("u_retail", "T-003", "submit_review", "初稿已整理，请核对活动时间", v)


def _run(label: str, fn) -> dict:
    result = fn()
    meta = ai_client.last_result() if result.get("method") == "model" else None
    ok = result.get("method") == "model"
    return {
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "label": label,
        "request_id": meta.request_id if meta else "-",
        "in_tokens": meta.input_tokens if meta else 0,
        "out_tokens": meta.output_tokens if meta else 0,
        "first": "-",  # 非流式，无首字耗时
        "elapsed": f"{meta.elapsed:.1f}s" if meta else "-",
        "valid": "首测合规" if ok else "降级（规则）",
        "retries": meta.retries if meta else 0,
        "outcome": "通过" if ok else "失败/降级",
    }


def main() -> None:
    _prepare()
    rows = [
        _run("周报生成", lambda: ai_services.generate_report("u_mgr", "branch", "2026-11-16")),
        _run("进度诊断", lambda: ai_services.diagnose("u_mgr")),
        _run("任务摘要", lambda: ai_services.summarize("T-003", "u_retail")),
        _run("智能起草", lambda: ai_services.draft("task", {"post": "综合岗", "title": "金融知识宣传初稿"})),
        _run("进度问答", lambda: ai_services.answer("哪些任务逾期了", "u_mgr")),
    ]

    out_dir = PRODUCT_DIR / "docs" / "evidence" / STAGE
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "冒烟记录.md"
    write_header = not path.exists()
    header = (
        "# 冒烟记录（冒烟脚本自动写入，不得手填）\n"
        f"- 产品：BranchRelay\n"
        f"- 阶段：{STAGE}\n"
        f"- 模型：{config.MODEL_NAME}\n"
        f"- 写入时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        "| 时间 | 链路 | 请求 ID | 输入 token | 输出 token | 首字耗时 | 总耗时 | 结构校验 | 重试次数 | 结果 |\n"
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n"
    )
    body = "\n".join(
        f"| {r['time']} | {r['label']} | {r['request_id']} | {r['in_tokens']} | {r['out_tokens']} "
        f"| {r['first']} | {r['elapsed']} | {r['valid']} | {r['retries']} | {r['outcome']} |"
        for r in rows
    )
    with open(path, "a", encoding="utf-8") as fh:
        if write_header:
            fh.write(header)
        fh.write(body + "\n")
    print(f"冒烟完成：{len(rows)} 条链路，写入 {path}")


if __name__ == "__main__":
    main()
