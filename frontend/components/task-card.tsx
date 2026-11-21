/** 任务卡片（工作台列表项，纯展示组件）。 */

import Link from "next/link";
import { CalendarDays, Clock3 } from "lucide-react";
import type { Task } from "@/lib/api/types";
import { dueStateMeta, statusMeta } from "@/lib/task-status";

function formatDue(dueAt: string): string {
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return dueAt;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toneClass(tone: string): string {
  switch (tone) {
    case "primary":
      return "bg-primary-soft text-primary-strong";
    case "warning":
      return "bg-warning-soft text-warning";
    case "success":
      return "bg-success-soft text-success";
    case "danger":
      return "bg-danger-soft text-danger";
    default:
      return "bg-bg text-muted";
  }
}

export function TaskCard({ task }: { task: Task }) {
  const status = statusMeta(task.status);
  const due = dueStateMeta(task.due_state ?? null);

  const cardTone = status.tone === "danger" ? "task-danger" : status.tone === "warning" ? "task-warning" : status.tone === "success" ? "task-success" : "task-primary";

  return (
    <Link href={`/tasks/${encodeURIComponent(task.id)}`} className="block rounded-card focus:outline-none focus:ring-2 focus:ring-primary">
      <article className={`task-card ${cardTone} rounded-card border border-border bg-surface p-4 transition-all`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-text">{task.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted">
            {task.description || "（无任务说明）"}
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClass(status.tone)}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          截止 {formatDue(task.due_at)}
        </span>
        {due && (
          <span className={`inline-flex items-center gap-1 font-medium ${due.tone === "danger" ? "text-danger" : "text-warning"}`}>
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            {due.label}
          </span>
        )}
        <span className="ml-auto text-xs">编号 {task.id}</span>
      </div>
      </article>
    </Link>
  );
}
