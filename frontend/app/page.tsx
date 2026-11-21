"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, FilePlus2, Loader2, RefreshCw, Sparkles, TimerReset } from "lucide-react";
import { getUserErrorMessage, getWorkbench } from "@/lib/api/client";
import { useRole } from "@/lib/role-context";
import type { Task } from "@/lib/api/types";
import { TaskCard } from "@/components/task-card";

const VIEWS = [
  { id: "today", label: "今日" },
  { id: "week", label: "本周" },
  { id: "todo", label: "我的待办" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];
type LoadState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "ok"; tasks: Task[] };

async function fetchTasks(roleId: string, viewId: ViewId): Promise<LoadState> {
  try {
    const data = await getWorkbench(roleId, viewId);
    return data.tasks?.length ? { status: "ok", tasks: data.tasks } : { status: "empty" };
  } catch (error) {
    return { status: "error", message: getUserErrorMessage(error, "工作任务暂时无法加载，请稍后重试。") };
  }
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: number; tone: string }) {
  return (
    <div className={`metric-card metric-${tone} rounded-2xl border border-border bg-surface p-4`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{label}</p>
        <span className="metric-icon flex h-9 w-9 items-center justify-center rounded-xl"><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-text">{value}</p>
    </div>
  );
}

export default function HomePage() {
  const { role } = useRole();
  const [view, setView] = useState<ViewId>("today");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [requestKey, setRequestKey] = useState(0);
  const key = `${role}:${view}:${requestKey}`;
  const [previousKey, setPreviousKey] = useState(key);
  if (previousKey !== key) {
    setPreviousKey(key);
    setState({ status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;
    fetchTasks(role, view).then((next) => { if (!cancelled) setState(next); });
    return () => { cancelled = true; };
  }, [role, view, requestKey]);

  const tasks = state.status === "ok" ? state.tasks : [];
  const pending = tasks.filter((task) => task.status === "待办理" || task.status === "待补充").length;
  const processing = tasks.filter((task) => task.status === "办理中" || task.status === "待复核").length;
  const completed = tasks.filter((task) => task.status === "已完成").length;
  const overdue = tasks.filter((task) => task.due_state === "overdue").length;

  return (
    <div className="mx-auto max-w-7xl">
      <section className="bank-hero px-5 py-7 sm:px-8 sm:py-9">
        <div className="max-w-2xl">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium tracking-[.18em] text-blue-100/80"><span className="h-1.5 w-1.5 rounded-full bg-[#e1c28a]" />支行工作台 · 2026 年 11 月 20 日</p>
          <h1>让每项工作，都有清晰的接力路径</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-blue-50/80">统一安排任务、跟踪办理进度、完成复核交接。今天的工作，从这里开始。</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/tasks/new" className="bank-hero-action"><FilePlus2 className="h-4 w-4" aria-hidden />安排新任务</Link>
            <Link href="/ai/report" className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-white/25 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"><Sparkles className="h-4 w-4 text-[#e4c98d]" aria-hidden />查看 AI 周报<ArrowRight className="h-4 w-4 opacity-70" aria-hidden /></Link>
          </div>
        </div>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Metric icon={Clock3} label="待处理" value={pending} tone="blue" />
        <Metric icon={TimerReset} label="办理中 / 待复核" value={processing} tone="gold" />
        <Metric icon={CheckCircle2} label="本视图已完成" value={completed} tone="green" />
        <Metric icon={Clock3} label="逾期提醒" value={overdue} tone="red" />
      </div>

      <section className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-medium tracking-[.14em] text-primary">WORK QUEUE</p><h2 className="mt-1 text-lg font-semibold text-text">我的工作队列</h2></div>
            <Link href="/tasks" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-strong">查看全部任务<ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          <div role="tablist" aria-label="工作台视图" className="mt-4 flex max-w-lg gap-1 rounded-xl border border-border bg-white p-1 shadow-sm">
            {VIEWS.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => setView(item.id)} className={`min-h-10 flex-1 rounded-lg px-3 py-2 text-sm font-medium ${view === item.id ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-bg"}`}>{item.label}</button>
            ))}
          </div>
          <div className="mt-4">
            {state.status === "loading" && <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-16 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />正在加载工作任务…</div>}
            {state.status === "empty" && <div className="rounded-2xl border border-dashed border-border bg-surface py-16 text-center text-sm text-muted">当前视图暂无任务</div>}
            {state.status === "error" && <div role="alert" className="rounded-2xl border border-border bg-surface py-16 text-center"><p className="text-sm text-muted">{state.message}</p><button type="button" onClick={() => setRequestKey((value) => value + 1)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg"><RefreshCw className="h-4 w-4" aria-hidden />重试</button></div>}
            {state.status === "ok" && <ul className="grid grid-cols-1 gap-3">{state.tasks.map((task) => <li key={task.id}><TaskCard task={task} /></li>)}</ul>}
          </div>
        </div>
        <aside className="hidden xl:block">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary"><Sparkles className="h-4 w-4" aria-hidden /></span><h2 className="font-semibold">快捷入口</h2></div>
            <div className="mt-4 space-y-2">
              <Link href="/tasks/new" className="quick-link flex items-center justify-between rounded-xl border border-border px-3 py-3 text-sm"><span>创建一项任务</span><ArrowRight className="h-4 w-4 text-muted" aria-hidden /></Link>
              <Link href="/notifications" className="quick-link flex items-center justify-between rounded-xl border border-border px-3 py-3 text-sm"><span>查看站内通知</span><ArrowRight className="h-4 w-4 text-muted" aria-hidden /></Link>
              <Link href="/board" className="quick-link flex items-center justify-between rounded-xl border border-border px-3 py-3 text-sm"><span>打开支行看板</span><ArrowRight className="h-4 w-4 text-muted" aria-hidden /></Link>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-[#d6c39a66] bg-[#fffaf0] p-5"><p className="text-xs font-medium tracking-[.14em] text-[#9b7127]">BRANCH NOTE</p><p className="mt-3 text-sm leading-6 text-[#6f5a32]">所有任务均保留完整流转记录，交接信息可随时追溯。</p></div>
        </aside>
      </section>
    </div>
  );
}
