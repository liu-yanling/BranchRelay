"use client";

/** 工作台代表页（阶段 3-1）：身份切换 + 今日/本周/我的待办三视图。
 *  只读后端真实数据；加载中 / 空 / 失败三种状态分开呈现（前端手册 9.3）。 */

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { getWorkbench } from "@/lib/api/client";
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
    return data.tasks && data.tasks.length > 0
      ? { status: "ok", tasks: data.tasks }
      : { status: "empty" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "加载失败，请稍后再试。",
    };
  }
}

export default function HomePage() {
  const { role } = useRole();
  const [view, setView] = useState<ViewId>("today");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [requestKey, setRequestKey] = useState(0);

  // 身份 / 视图 / 手动重试变化时，在渲染阶段把状态重置回「加载中」，
  // 再在 effect 里发起请求（effect 体内不同步 setState，避免级联渲染）。
  const key = `${role}:${view}:${requestKey}`;
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    setState({ status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;
    fetchTasks(role, view).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [role, view, requestKey]);


  return (
    <div className="mx-auto max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-text">我的工作台</h1>
        <p className="mt-1 text-sm text-muted">
          安排、办理、复核全程有明确接手人；看板与周报同步。
        </p>
      </div>

      <div
        role="tablist"
        aria-label="工作台视图"
        className="mt-5 flex gap-1 rounded-lg border border-border bg-surface p-1"
      >
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            onClick={() => setView(item.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              view === item.id
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:bg-bg"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {state.status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            正在加载…
          </div>
        )}

        {state.status === "empty" && (
          <div className="rounded-card border border-dashed border-border bg-surface py-16 text-center text-sm text-muted">
            当前视图暂无任务
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-card border border-border bg-surface py-16 text-center">
            <p className="text-sm text-muted">{state.message}</p>
            <button
              type="button"
              onClick={() => setRequestKey((k) => k + 1)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              重试
            </button>
          </div>
        )}

        {state.status === "ok" && (
          <ul className="grid grid-cols-1 gap-3">
            {state.tasks.map((task) => (
              <li key={task.id}>
                <TaskCard task={task} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
