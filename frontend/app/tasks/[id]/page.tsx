"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { ApiError, applyTaskAction, draftText, getTask, getUserErrorMessage, summarizeTask } from "@/lib/api/client";
import { useRole } from "@/lib/role-context";
import type { TaskDetail } from "@/lib/api/types";
import { statusMeta } from "@/lib/task-status";

function dateText(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

const ACTION_LABELS: Record<string, string> = {
  start: "开始办理",
  update_progress: "更新进展",
  submit_review: "提交复核",
  approve: "复核通过",
  reject: "退回补充",
};

function TaskDetailRoute() {
  const params = useParams<{ id: string }>();
  const { role } = useRole();
  return <TaskDetailContent key={`${params.id}:${role}`} taskId={params.id} role={role} />;
}

function TaskDetailContent({ taskId, role }: { taskId: string; role: string }) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const locked = useRef(false);
  const active = useRef(true);
  const errorBanner = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getTask(taskId, role)
      .then((result) => {
        if (cancelled) return;
        setTask(result);
        setLoadError("");
      })
      .catch((cause) => {
        if (cancelled) return;
        setTask(null);
        setLoadError(getUserErrorMessage(cause, "任务详情暂时无法加载，请稍后重试。"));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId, role, revision]);

  useEffect(() => {
    if (error || loadError) errorBanner.current?.focus();
  }, [error, loadError]);

  function refresh() {
    setLoading(true);
    setLoadError("");
    setRevision((value) => value + 1);
  }

  async function action(name: string) {
    if (!task || locked.current) return;
    locked.current = true;
    setBusy(name);
    setError("");
    setSuccess("");
    try {
      await applyTaskAction({ task_id: task.id, actor_id: role, action: name, note, version: task.version });
      if (!active.current) return;
      setNote("");
      setSummary("");
      setSuccess(`${ACTION_LABELS[name]}成功。`);
      refresh();
    } catch (cause) {
      if (!active.current) return;
      setError(getUserErrorMessage(cause, "操作未完成，请稍后重试。"));
      if (cause instanceof ApiError && cause.status === 409) refresh();
    } finally {
      locked.current = false;
      if (active.current) setBusy("");
    }
  }

  async function runAi(kind: "summary" | "draft") {
    if (!task || locked.current) return;
    locked.current = true;
    setBusy(kind);
    setError("");
    setSuccess("");
    try {
      if (kind === "summary") {
        const result = await summarizeTask(task.id, role);
        if (active.current) setSummary(result.summary ?? "暂无摘要");
      } else {
        const result = await draftText("reject_reason", { task_id: task.id, title: task.title, current_note: task.submit_note ?? "" });
        if (active.current && result.text) {
          setNote(result.text);
          setSuccess("退回意见已起草，请确认后再提交。");
        } else if (active.current) {
          setError("暂时无法起草退回意见，已保留输入，可继续手动填写。");
        }
      }
    } catch (cause) {
      if (active.current) setError(getUserErrorMessage(cause, "AI 服务暂时不可用，请稍后重试。"));
    } finally {
      locked.current = false;
      if (active.current) setBusy("");
    }
  }

  const blocked = Boolean(busy) || loading;
  const can = task?.current_owner_id === role;
  const canSubmit = can && (task?.status === "办理中" || task?.status === "待补充");
  const canReview = can && task?.status === "待复核" && task.reviewer_id === role;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden />返回任务中心
      </Link>
      <div aria-live="polite" className="mt-3">
        {(error || loadError) && <p ref={errorBanner} tabIndex={-1} role="alert" className="status-banner status-banner-error">{[error, loadError].filter(Boolean).join(" ")}</p>}
        {success && <p role="status" className="status-banner status-banner-success mt-2">{success}</p>}
      </div>
      {loading && <div role="status" className="flex justify-center py-12 text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />正在加载任务详情…</div>}
      {loadError && !loading && <button onClick={refresh} className="loading-button mt-3 rounded-lg border border-primary px-3 py-2 text-sm text-primary"><RefreshCw className="h-4 w-4" aria-hidden />重新加载任务</button>}
      {!loading && task && <>
        <section className="page-panel mt-4 p-5">
          <div className="page-panel-header -mx-5 -mt-5 flex flex-wrap items-start justify-between gap-3 rounded-t-[inherit] px-5 py-4">
            <div><p className="text-xs text-muted">任务 {task.id}</p><h1 className="mt-1 text-xl font-semibold">{task.title}</h1></div>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-sm text-primary-strong">{statusMeta(task.status).label}</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">{task.description || "暂无说明"}</p>
          <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
            <div><dt className="inline text-muted">发起人　</dt><dd className="inline">{task.creator_name}</dd></div>
            <div><dt className="inline text-muted">经办人　</dt><dd className="inline">{task.executor_name}</dd></div>
            <div><dt className="inline text-muted">复核人　</dt><dd className="inline">{task.reviewer_name}</dd></div>
            <div><dt className="inline text-muted">当前处理人　</dt><dd className="inline">{task.owner_name || "已结束"}</dd></div>
            <div><dt className="inline text-muted">截止时间　</dt><dd className="inline">{dateText(task.due_at)}</dd></div>
            <div><dt className="inline text-muted">版本　</dt><dd className="inline">{task.version}</dd></div>
          </dl>
          {task.reject_reason && <p className="mt-4 rounded-xl bg-warning-soft p-3 text-sm">退回意见　{task.reject_reason}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => void runAi("summary")} disabled={blocked} aria-busy={busy === "summary"} className="loading-button rounded-lg border border-primary px-3 py-2 text-sm text-primary">
              {busy === "summary" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}{busy === "summary" ? "正在生成摘要…" : "AI 进展摘要"}
            </button>
            {can && task.status === "待办理" && <button onClick={() => void action("start")} disabled={blocked} aria-busy={busy === "start"} className="loading-button rounded-lg bg-primary px-4 py-2 text-sm text-white">{busy === "start" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy === "start" ? "正在开始办理…" : "开始办理"}</button>}
          </div>
          {(canSubmit || canReview) && <div className="mt-4 rounded-xl border border-border bg-bg p-4">
            <label htmlFor="task-note" className="block text-sm font-medium">{canReview ? "复核意见" : "办理进展与交付说明"}</label>
            <textarea id="task-note" value={note} disabled={blocked} onChange={(event) => setNote(event.target.value)} rows={3} placeholder={canReview ? "退回时请填写原因，通过可留空" : "补充最新进展或交付内容，提交复核时必填"} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
            <div className="mt-2 flex flex-wrap gap-2">
              {canSubmit && <>
                {task.status === "办理中" && <button onClick={() => void action("update_progress")} disabled={blocked || !note.trim()} aria-busy={busy === "update_progress"} className="loading-button rounded-lg border border-border px-4 py-2 text-sm">{busy === "update_progress" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy === "update_progress" ? "正在更新…" : "更新进展"}</button>}
                <button onClick={() => void action("submit_review")} disabled={blocked || !note.trim()} aria-busy={busy === "submit_review"} className="loading-button rounded-lg bg-primary px-4 py-2 text-sm text-white">{busy === "submit_review" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy === "submit_review" ? "正在提交复核…" : "确认提交复核"}</button>
              </>}
              {canReview && <>
                <button onClick={() => void runAi("draft")} disabled={blocked} aria-busy={busy === "draft"} className="loading-button rounded-lg border border-primary px-3 py-2 text-sm text-primary">{busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}{busy === "draft" ? "正在起草意见…" : "AI 起草退回意见"}</button>
                <button onClick={() => void action("approve")} disabled={blocked} aria-busy={busy === "approve"} className="loading-button rounded-lg bg-success px-4 py-2 text-sm text-white">{busy === "approve" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy === "approve" ? "正在通过…" : "通过"}</button>
                <button onClick={() => void action("reject")} disabled={blocked || !note.trim()} aria-busy={busy === "reject"} className="loading-button rounded-lg border border-danger px-4 py-2 text-sm text-danger">{busy === "reject" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy === "reject" ? "正在退回…" : "退回补充"}</button>
              </>}
            </div>
          </div>}
          {task.status === "待补充" && role === task.reviewer_id && <p className="mt-3 text-sm text-muted">请查看退回意见并等待经办人补充。</p>}
          <div aria-live="polite">{summary && <section className="mt-4 rounded-xl bg-primary-soft p-4 text-sm leading-6 text-primary-strong"><h2 className="font-semibold">AI 进展摘要</h2><p className="mt-2 whitespace-pre-wrap">{summary}</p></section>}</div>
        </section>
        <section className="page-panel mt-5 p-5">
          <h2 className="font-semibold">流转记录</h2>
          <ol className="mt-4 space-y-4 border-l border-border pl-5">
            {task.events.map((event, index) => <li key={event.id ?? `${event.created_at}-${index}`} className="relative text-sm">
              <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
              <div className="flex flex-wrap justify-between gap-2"><strong>{event.action_label}</strong><time className="text-xs text-muted">{dateText(event.created_at)}</time></div>
              <p className="mt-1 whitespace-pre-wrap break-words text-muted">{event.actor_name}{event.note ? `　${event.note}` : ""}</p>
            </li>)}
          </ol>
        </section>
      </>}
    </div>
  );
}

export default function TaskDetailPage() {
  return <Suspense fallback={<div role="status" className="flex justify-center py-20 text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />正在加载…</div>}><TaskDetailRoute /></Suspense>;
}
