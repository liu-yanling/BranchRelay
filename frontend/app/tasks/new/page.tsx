"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createTask, draftText, getBootstrap } from "@/lib/api/client";
import { useRole } from "@/lib/role-context";
import type { User } from "@/lib/api/types";
import { ROLE_FALLBACK } from "@/lib/roles";

export default function NewTaskPage() {
  const router = useRouter();
  const { role } = useRole();
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

  useEffect(() => {
    let cancelled = false;
    getBootstrap().then((data) => { if (!cancelled && data.users?.length) setUsers(data.users); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  async function improveDraft() {
    if (!title && !description) return;
    setDrafting(true);
    try {
      const result = await draftText("task_description", { title, description });
      if (result.text) setDescription(result.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 起草失败");
    } finally {
      setDrafting(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const task = await createTask({ actor_id: role, title, description, plan_date: planDate, due_at: dueAt, executor_id: executor, reviewer_id: reviewer });
      router.push(`/tasks/${task.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  if (role !== "u_zh") return <div className="mx-auto max-w-2xl rounded-card border border-border bg-surface p-10 text-center text-sm text-muted">只有综合岗可以安排任务。</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold">安排新任务</h1>
      <p className="mt-1 text-sm text-muted">填写经办人和复核人，任务会自动交接到经办人的待办。</p>
      <form onSubmit={submit} className="mt-5 space-y-4 rounded-card border border-border bg-surface p-5 shadow-sm">
        <label className="block text-sm font-medium">任务标题<input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2" placeholder="例如：准备客户活动材料" /></label>
        <label className="block text-sm font-medium">任务说明<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-border px-3 py-2" /></label>
        <button type="button" onClick={improveDraft} disabled={drafting} className="rounded-lg border border-primary px-3 py-2 text-sm text-primary">{drafting ? "生成中…" : "AI 起草说明"}</button>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">计划日<input required type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2" /></label><label className="text-sm font-medium">截止时间<input required type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2" /></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">经办人<select value={executor} onChange={(e) => setExecutor(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2">{users.filter((u) => u.id !== reviewer).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label className="text-sm font-medium">复核人<select value={reviewer} onChange={(e) => setReviewer(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2">{users.filter((u) => u.id !== executor).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label></div>
        {error && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-strong disabled:opacity-50">{busy ? "提交中…" : "创建任务并交接"}</button>
      </form>
    </div>
  );
}
