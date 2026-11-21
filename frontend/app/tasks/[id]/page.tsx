"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { applyTaskAction, draftText, getTask, summarizeTask } from "@/lib/api/client";
import { useRole } from "@/lib/role-context";
import type { TaskDetail } from "@/lib/api/types";
import { statusMeta } from "@/lib/task-status";

function dateText(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleString("zh-CN", { hour12: false }); }

function TaskDetailContent() {
  const params = useParams<{ id: string }>();
  const { role } = useRole();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const load = () => getTask(params.id, role).then(setTask).catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  useEffect(() => {
    let cancelled = false;
    getTask(params.id, role).then((result) => { if (!cancelled) setTask(result); }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "加载失败"); });
    return () => { cancelled = true; };
  }, [params.id, role]);

  async function action(name: string) {
    if (!task) return;
    setBusy(true); setError("");
    try { await applyTaskAction({ task_id: task.id, actor_id: role, action: name, note, version: task.version }); setNote(""); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "操作失败"); await load(); }
    finally { setBusy(false); }
  }

  async function getSummary() {
    if (!task) return;
    setBusy(true);
    try { const result = await summarizeTask(task.id, role); setSummary(result.summary ?? "暂无摘要"); }
    catch (e) { setError(e instanceof Error ? e.message : "摘要生成失败"); }
    finally { setBusy(false); }
  }

  async function draftRejectReason() {
    if (!task) return;
    setBusy(true);
    try {
      const result = await draftText("reject_reason", { task_id: task.id, title: task.title, current_note: task.submit_note ?? "" });
      if (result.text) setNote(result.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 起草失败");
    } finally {
      setBusy(false);
    }
  }

  if (error && !task) return <div className="rounded-card border border-border bg-surface p-10 text-center text-sm text-muted">{error}</div>;
  if (!task) return <div className="flex justify-center py-20 text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在加载…</div>;
  const meta = statusMeta(task.status);
  const can = task.current_owner_id === role;
  const actionName = task.status === "待办理" && can ? "start" : task.status === "办理中" && can ? "submit_review" : task.status === "待补充" && can ? "submit_review" : "";
  const needsNote = actionName === "submit_review";

  return <div className="mx-auto max-w-4xl">
    <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary"><ArrowLeft className="h-4 w-4" />返回任务列表</Link>
    <div className="mt-4 rounded-card border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-muted">{task.id}</p><h1 className="mt-1 text-xl font-semibold">{task.title}</h1></div><span className="rounded-full bg-primary-soft px-3 py-1 text-sm text-primary-strong">{meta.label}</span></div>
      <p className="mt-4 text-sm leading-6 text-muted">{task.description || "暂无说明"}</p>
      <div className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2"><p><span className="text-muted">发起人：</span>{task.creator_name}</p><p><span className="text-muted">经办人：</span>{task.executor_name}</p><p><span className="text-muted">复核人：</span>{task.reviewer_name}</p><p><span className="text-muted">当前处理人：</span>{task.owner_name || "已结束"}</p><p><span className="text-muted">截止：</span>{dateText(task.due_at)}</p><p><span className="text-muted">版本：</span>{task.version}</p></div>
      <div className="mt-5 flex flex-wrap gap-2"><button onClick={getSummary} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm text-primary"><Sparkles className="h-4 w-4" />AI 进展摘要</button>{actionName && !needsNote && <button onClick={() => action(actionName)} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{actionName === "start" ? "开始办理" : "复核通过"}</button>}</div>
      {actionName === "submit_review" && <div className="mt-3"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="填写交付说明后再提交复核" className="w-full rounded-lg border border-border px-3 py-2 text-sm" /><button onClick={() => action("submit_review")} disabled={busy || !note.trim()} className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">确认提交复核</button></div>}
      {task.status === "办理中" && can && <div className="mt-3"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="填写最新进展" className="w-full rounded-lg border border-border px-3 py-2 text-sm" /><button onClick={() => action("update_progress")} disabled={busy || !note.trim()} className="mt-2 rounded-lg border border-border px-4 py-2 text-sm">更新进展</button></div>}
      {task.status === "待补充" && role === task.reviewer_id && <p className="mt-3 text-sm text-muted">请查看退回意见并等待经办人补充。</p>}
      {task.status === "待复核" && role === task.reviewer_id && <div className="mt-3"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="如需退回，请填写退回原因；通过可留空" className="w-full rounded-lg border border-border px-3 py-2 text-sm" /><div className="mt-2 flex flex-wrap gap-2"><button onClick={draftRejectReason} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm text-primary"><Sparkles className="h-4 w-4" />AI 起草退回意见</button><button onClick={() => action("approve")} disabled={busy} className="rounded-lg bg-success px-4 py-2 text-sm text-white">通过</button><button onClick={() => action("reject")} disabled={busy || !note.trim()} className="rounded-lg border border-danger px-4 py-2 text-sm text-danger">退回补充</button></div></div>}
      {summary && <div className="mt-4 rounded-lg bg-primary-soft p-3 text-sm text-primary-strong"><strong>AI 摘要：</strong>{summary}</div>}
      {error && <p className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    </div>
    <section className="mt-5 rounded-card border border-border bg-surface p-5"><h2 className="font-semibold">流转记录</h2><ol className="mt-4 space-y-4 border-l border-border pl-5">{task.events.map((event, index) => <li key={`${event.created_at}-${index}`} className="relative text-sm"><span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-primary" /><div className="flex flex-wrap justify-between gap-2"><strong>{event.action_label}</strong><time className="text-xs text-muted">{dateText(event.created_at)}</time></div><p className="mt-1 text-muted">{event.actor_name}{event.note ? `：${event.note}` : ""}</p></li>)}</ol></section>
  </div>;
}

export default function TaskDetailPage() {
  return <Suspense fallback={<div className="flex justify-center py-20 text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在加载…</div>}><TaskDetailContent /></Suspense>;
}
