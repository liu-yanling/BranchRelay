"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { getWorkbench } from "@/lib/api/client";
import { useRole } from "@/lib/role-context";
import type { Task } from "@/lib/api/types";
import { TaskCard } from "@/components/task-card";

export default function TasksPage() {
  const { role } = useRole();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    getWorkbench(role, "week")
      .then((data) => setTasks(data.tasks))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    getWorkbench(role, "week")
      .then((data) => { if (!cancelled) setTasks(data.tasks); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "加载失败"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [role]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">任务详情</h1>
          <p className="mt-1 text-sm text-muted">查看任务目标、责任人和完整流转记录。</p>
        </div>
        {role === "u_zh" && (
          <Link href="/tasks/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-strong">
            <Plus className="h-4 w-4" /> 安排任务
          </Link>
        )}
      </div>
      {loading && <div className="flex justify-center py-16 text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在加载…</div>}
      {error && <div className="mt-5 rounded-card border border-border bg-surface p-8 text-center text-sm text-muted">{error}<br /><button onClick={load} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2"><RefreshCw className="h-4 w-4" />重试</button></div>}
      {!loading && !error && !tasks.length && <div className="mt-5 rounded-card border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">当前身份没有本周相关任务</div>}
      {!loading && !error && tasks.length > 0 && <ul className="mt-5 grid gap-3">{tasks.map((task) => <li key={task.id}><TaskCard task={task} /></li>)}</ul>}
    </div>
  );
}
