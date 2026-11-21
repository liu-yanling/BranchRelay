"""五项 AI 能力：周报 / 诊断 / 摘要 / 起草 / 问答。

统一走 ai_client 调模型 + Pydantic 强校验 + 引用校验；失败降级到 reporting 的规则汇总。
程序算数与状态，模型只组织语言。
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from pydantic import ValidationError

from app.schemas.ai import (
    DiagnosisModelOut,
    DraftModelOut,
    QaModelOut,
    ReportModelOut,
    SummaryModelOut,
)

from . import ai_client, domain, reporting

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ai_client.ModelError("模型未返回 JSON")
    return json.loads(text[start:end + 1])


# ---------------- ① 周报 ----------------

def generate_report(role_id: str, scope: str, week_start: str) -> dict:
    facts = reporting.report_facts(role_id, scope, week_start)
    by_id = {f["task_id"]: f for f in facts["facts"]}
    groups = {"completed": facts["completed"], "pending": facts["pending"], "next_week": facts["next_week"]}

    if not any(groups.values()):
        return {
            "scope": facts["scope"], "week_start": facts["week_start"],
            "week_end": facts["week_end"], "data_cutoff": facts["data_cutoff"],
            "is_current_week": facts["is_current_week"], "method": "rules",
            "completed": [], "pending": [], "next_week": [], "empty": True,
        }

    prompt = json.dumps({
        "groups": groups,
        "tasks": [
            {
                "task_id": f["task_id"], "title": f["title"], "node": f["node"],
                "owner": f["owner"], "plan_date": f["plan_date"], "due_at": f["due_at"],
                "records": f["records"],
            }
            for f in facts["facts"] if f["task_id"] in groups["completed"] + groups["pending"] + groups["next_week"]
        ],
    }, ensure_ascii=False, indent=2)

    method = "rules"
    model_texts: dict[str, str] = {}
    try:
        raw = ai_client.call_model(_load_prompt("report"), prompt).content
        parsed = ReportModelOut.model_validate(_extract_json(raw))
        for grp in ("completed", "pending", "next_week"):
            for item in getattr(parsed, grp):
                # 引用校验：编号必须属于本组程序判定，否则丢弃（用规则文字）
                if item.task_id in groups[grp] and item.text.strip():
                    model_texts[item.task_id] = item.text.strip()
        method = "model" if model_texts else "rules"
    except (ai_client.ModelError, ValidationError, json.JSONDecodeError, TypeError):
        method = "rules"

    def build(grp):
        return [
            {"task_id": tid, "text": model_texts.get(tid) or reporting.rule_report_text(by_id[tid], grp)}
            for tid in groups[grp]
        ]

    return {
        "scope": facts["scope"], "week_start": facts["week_start"],
        "week_end": facts["week_end"], "data_cutoff": facts["data_cutoff"],
        "is_current_week": facts["is_current_week"], "method": method,
        "completed": build("completed"), "pending": build("pending"), "next_week": build("next_week"),
        "empty": False,
    }


# ---------------- ② 诊断 ----------------

def diagnose(role_id: str) -> dict:
    base = reporting.diagnosis_rules(role_id)
    if not base["risks"]:
        base["method"] = "rules"
        return base
    try:
        raw = ai_client.call_model(
            _load_prompt("diagnosis"),
            json.dumps({"risks": base["risks"]}, ensure_ascii=False, indent=2),
        ).content
        parsed = DiagnosisModelOut.model_validate(_extract_json(raw))
        advice_by_id = {r.task_id: r.advice.strip() for r in parsed.risks if r.advice.strip()}
        for r in base["risks"]:
            if r["task_id"] in advice_by_id:
                r["advice"] = advice_by_id[r["task_id"]]
        base["method"] = "model"
    except (ai_client.ModelError, ValidationError, json.JSONDecodeError, TypeError):
        base["method"] = "rules"
    return base


# ---------------- ③ 摘要 ----------------

def summarize(task_id: str, role_id: str) -> dict:
    detail = domain.task_detail(task_id, role_id)
    records = [e for e in detail["events"] if e["note"]]
    if not records:
        return {"summary": "", "method": "rules"}
    lines = [f"{e['action_label']}({e['actor_name']} {e['created_at']})：{e['note']}" for e in detail["events"]]
    try:
        raw = ai_client.call_model(
            _load_prompt("summary"),
            json.dumps({"task_id": task_id, "events": lines}, ensure_ascii=False, indent=2),
        ).content
        parsed = SummaryModelOut.model_validate(_extract_json(raw))
        if parsed.summary.strip():
            return {"summary": parsed.summary.strip(), "method": "model"}
    except (ai_client.ModelError, ValidationError, json.JSONDecodeError, TypeError):
        pass
    return reporting.summary_rules(task_id, role_id)


# ---------------- ④ 起草 ----------------

def draft(kind: str, context: dict) -> dict:
    try:
        raw = ai_client.call_model(
            _load_prompt("draft"),
            json.dumps({"kind": kind, "context": context}, ensure_ascii=False, indent=2),
        ).content
        parsed = DraftModelOut.model_validate(_extract_json(raw))
        if parsed.text.strip():
            return {"text": parsed.text.strip(), "method": "model"}
    except (ai_client.ModelError, ValidationError, json.JSONDecodeError, TypeError):
        pass
    return {"text": "", "method": "rules"}


# ---------------- ⑤ 问答 ----------------

def answer(question: str, role_id: str) -> dict:
    base = reporting.answer_rules(question, role_id)
    if base["method"] == "rules" and not base.get("refs"):
        return base
    try:
        raw = ai_client.call_model(
            _load_prompt("qa"),
            json.dumps({"question": question, "rule_answer": base["answer"], "refs": base["refs"]},
                       ensure_ascii=False, indent=2),
        ).content
        parsed = QaModelOut.model_validate(_extract_json(raw))
        if parsed.answer.strip():
            refs = parsed.refs or base["refs"]
            return {"answer": parsed.answer.strip(), "refs": [r for r in refs if isinstance(r, str)], "method": "model"}
    except (ai_client.ModelError, ValidationError, json.JSONDecodeError, TypeError):
        pass
    return base
