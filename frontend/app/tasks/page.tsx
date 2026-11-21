"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { getUserErrorMessage, getWorkbench } from "@/lib/api/client";
import { useRole } from "@/lib/role-context";
import type { Task } from "@/lib/api/types";
import { TaskCard } from "@/components/task-card";

export default function TasksPage() {
  const { role } = useRole();
  return <TasksContent key={role} role={role} />;
}

function TasksContent({ role }: { role: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const load = () => {
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
  };

  useEffect(() => {
    let cancelled = false;
    getWorkbench(role, "week")
      .then((data) => { if (!cancelled) { setTasks(data.tasks); setError(""); } })
      .catch((e) => { if (!cancelled) setError(getUserErrorMessage(e, "任务暂时无法加载，请稍后重试。")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [role, revision]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="page-heading">
        <div>
          <h1 className="text-xl font-semibold">任务中心</h1>
          <p className="mt-1 text-sm text-muted">查看任务目标、责任人和完整流转记录。</p>
        </div>
        {role === "u_zh" && (
          <Link href="/tasks/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-strong">
            <Plus className="h-4 w-4" /> 安排任务
          </Link>
        )}
      </div>
      {loading && <div className="flex justify-center py-16 text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在加载…</div>}
      {error && <div role="alert" className="status-banner status-banner-error mt-5 justify-between"><span>{error}</span><button onClick={load} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-current px-3 py-2 text-sm font-medium"><RefreshCw className="h-4 w-4" />重试</button></div>}
      {!loading && !error && !tasks.length && <div className="mt-5 rounded-card border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">当前身份没有本周相关任务</div>}
      {!loading && !error && tasks.length > 0 && <ul className="mt-5 grid gap-3">{tasks.map((task) => <li key={task.id}><TaskCard task={task} /></li>)}</ul>}
    </div>
  );
}
