"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createTask, draftText, getBootstrap, getUserErrorMessage } from "@/lib/api/client";
import { useRole } from "@/lib/role-context";
import type { User } from "@/lib/api/types";
import { ROLE_FALLBACK } from "@/lib/roles";

export default function NewTaskPage() {
  const { role } = useRole();
  if (role !== "u_zh") return <section className="page-panel mx-auto max-w-2xl p-10 text-center"><h1>安排新任务</h1><p className="text-sm text-muted">切换到综合岗即可安排任务。</p></section>;
  return <TaskForm role={role} />;
}

function TaskForm({ role }: { role: string }) {
  const router = useRouter();
  const active = useRef(true);
  const [users, setUsers] = useState<User[]>(ROLE_FALLBACK);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [planDate, setPlanDate] = useState("2026-11-20");
  const [dueAt, setDueAt] = useState("2026-11-20T17:00");
  const [executor, setExecutor] = useState("u_retail");
  const [reviewer, setReviewer] = useState("u_ops");
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");
  useEffect(() => {
    active.current = true;
    let cancelled = false;
    getBootstrap().then((data) => { if (!cancelled && data.users?.length) setUsers(data.users); }).catch(() => { if (!cancelled) setNotice("暂时无法读取人员列表，当前显示演示人员。"); });
    return () => { cancelled = true; active.current = false; };
  }, []);

  async function improveDraft() {
    if (busy || drafting || (!title.trim() && !description.trim())) return;
    setError("");
    setDrafting(true);
    try {
      const result = await draftText("task_description", { title, description });
      if (!active.current) return;
      if (result.text) {
        setDescription(result.text);
        setNotice("说明已起草，请检查后提交。");
      } else {
        setNotice("暂时无法生成说明，已保留输入，可继续手动填写。");
      }
    } catch (e) {
      setError(getUserErrorMessage(e, "AI 起草暂时不可用，请稍后重试。"));
    } finally {
      setDrafting(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (dueAt.slice(0, 10) < planDate || dueAt <= "2026-11-20T10:00") {
      setError("截止时间须晚于当前演示时间（11 月 20 日 10:00），且截止日期不能早于计划日。");
      setBusy(false);
      return;
    }
    try {
      const task = await createTask({ actor_id: role, title, description, plan_date: planDate, due_at: dueAt, executor_id: executor, reviewer_id: reviewer });
      if (active.current) router.push(`/tasks/${task.id}`);
    } catch (e) {
      setError(getUserErrorMessage(e, "任务创建失败，请检查填写内容后重试。"));
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="mx-auto max-w-2xl">
      <div className="page-heading">
        <div><h1 className="mt-1 text-xl font-semibold">安排新任务</h1><p className="mt-1 text-sm text-muted">填写经办人和复核人，任务会自动交接到经办人的待办。</p></div>
      </div>
      <form onSubmit={submit} className="page-panel mt-5 space-y-4 p-5">
        <fieldset disabled={busy || drafting} className="space-y-4">
        <label className="block text-sm font-medium">任务标题<input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2" placeholder="例如：准备客户活动材料" /></label>
        <label className="block text-sm font-medium">任务说明<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-border px-3 py-2" placeholder="补充任务目标、交付标准或背景信息" /></label>
        <button type="button" onClick={improveDraft} disabled={!title.trim() && !description.trim()} aria-busy={drafting} className="loading-button rounded-lg border border-primary px-3 py-2 text-sm text-primary">{drafting ? "生成中…" : "AI 起草说明"}</button>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">计划日<input required type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2" /></label><label className="text-sm font-medium">截止时间<input required type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2" /></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">经办人<select value={executor} onChange={(e) => setExecutor(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2">{users.filter((u) => u.id !== reviewer).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label className="text-sm font-medium">复核人<select value={reviewer} onChange={(e) => setReviewer(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2">{users.filter((u) => u.id !== executor).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label></div>
        </fieldset>
        <div aria-live="polite">{notice && <p className="text-sm text-primary">{notice}</p>}</div>
        {error && <p role="alert" className="status-banner status-banner-error">{error}</p>}
        <button disabled={busy || drafting} aria-busy={busy} className="loading-button w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-strong disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy ? "提交中…" : "创建任务并交接"}</button>
      </form>
    </div>
  );
}
