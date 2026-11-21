"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, Loader2, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import { askBoard, diagnose, getBoard, getUserErrorMessage } from "@/lib/api/client";
import { useRole } from "@/lib/role-context";
import { ROLE_FALLBACK } from "@/lib/roles";
import type { BoardResponse, DiagnosisRisk } from "@/lib/api/types";
import { statusMeta } from "@/lib/task-status";

const STATS = [["total", "本周任务"], ["completed", "已完成"], ["pending_review", "待复核"], ["overdue", "已逾期"]] as const;

export default function BoardPage() {
  const { role } = useRole();
  if (role !== "u_mgr") return <div className="page-panel mx-auto max-w-3xl p-12 text-center"><BarChart3 className="mx-auto h-8 w-8 text-muted" aria-hidden /><h1 className="mt-3 font-semibold">支行看板</h1><p className="mt-1 text-sm text-muted">切换为支行负责人后可查看看板和支行范围的 AI 分析。</p></div>;
  return <BoardContent role={role} />;
}

function BoardContent({ role }: { role: string }) {
  const [data, setData] = useState<BoardResponse | null>(null);
  const [filter, setFilter] = useState("");
  const [risks, setRisks] = useState<DiagnosisRisk[]>([]);
  const [diagnosed, setDiagnosed] = useState(false);
  const [question, setQuestion] = useState("这周谁逾期最多");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const locked = useRef(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getBoard(role, filter)
      .then((result) => { if (!cancelled) { setData(result); setLoadError(""); } })
      .catch((cause) => { if (!cancelled) { setData(null); setLoadError(getUserErrorMessage(cause, "看板数据暂时无法加载，请稍后重试。")); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [role, filter, revision]);

  function refresh() {
    setLoading(true);
    setLoadError("");
    setRevision((value) => value + 1);
  }

  async function runAi(kind: "diagnosis" | "question") {
    if (locked.current || (kind === "question" && !question.trim())) return;
    locked.current = true;
    setPending(kind);
    setError("");
    try {
      if (kind === "diagnosis") {
        const result = await diagnose(role);
        if (!active.current) return;
        setRisks(result.risks);
        setDiagnosed(true);
      } else {
        const result = await askBoard(question.trim(), role);
        if (active.current) setAnswer(`${result.answer ?? "暂无结果"}${result.refs?.length ? `（引用任务 ${result.refs.join("、")}）` : ""}`);
      }
    } catch (cause) {
      if (active.current) setError(getUserErrorMessage(cause, "AI 分析暂时不可用，请稍后重试。"));
    } finally {
      locked.current = false;
      if (active.current) setPending("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="page-heading">
        <div><h1 className="text-xl font-semibold">支行看板</h1><p className="mt-1 text-sm text-muted">本周任务进展、风险定位和 AI 辅助追踪。</p></div>
        <button onClick={refresh} disabled={loading} className="loading-button rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />刷新看板</button>
      </div>
      {loadError && <p role="alert" className="status-banner status-banner-error mt-4">{loadError}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATS.map(([key, label], index) => <button key={key} disabled={loading} onClick={() => {
          const nextFilter = key === "total" || filter === key ? "" : key;
          if (nextFilter === filter) refresh();
          else { setLoading(true); setFilter(nextFilter); }
        }} aria-pressed={key === "total" ? !filter : filter === key} className={`metric-card metric-${["blue", "green", "gold", "red"][index]} page-panel p-4 text-left hover:border-primary ${filter === key ? "ring-2 ring-primary" : ""}`}>
          <span className="block text-sm text-muted">{label}</span><span className="mt-2 block text-2xl font-semibold text-primary">{data?.stats[key] ?? "—"}</span>
        </button>)}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="page-panel min-w-0 p-5" aria-busy={loading}>
          <h2 className="font-semibold">任务进展</h2>
          {loading ? <p role="status" className="loading-button py-10 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />正在加载任务…</p> : <ul className="mt-4 space-y-3">
            {data && !data.tasks.length && <li className="py-8 text-center text-sm text-muted">当前筛选暂无任务</li>}
            {data?.tasks.map((task) => <li key={task.id}><Link href={`/tasks/${task.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 hover:border-primary">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{task.id} {task.title}</p><p className="mt-1 text-xs text-muted">当前处理人　{ROLE_FALLBACK.find((user) => user.id === task.current_owner_id)?.name ?? task.current_owner_id ?? "已结束"}</p></div>
              <span className="shrink-0 rounded-full bg-primary-soft px-2 py-1 text-xs text-primary-strong">{statusMeta(task.status).label}</span>
            </Link></li>)}
          </ul>}
        </section>
        <aside className="min-w-0 space-y-5">
          {error && <p role="alert" className="status-banner status-banner-error">{error}</p>}
          <section className="page-panel p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" aria-hidden />AI 进度诊断</h2>
            <button onClick={() => void runAi("diagnosis")} disabled={Boolean(pending)} aria-busy={pending === "diagnosis"} className="loading-button mt-3 rounded-lg bg-primary px-3 py-2 text-sm text-white">{pending === "diagnosis" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{pending === "diagnosis" ? "正在分析进度…" : "生成诊断"}</button>
            <div className="mt-4 space-y-3" aria-live="polite" aria-busy={pending === "diagnosis"}>
              {risks.map((risk) => <Link key={`${risk.task_id}-${risk.type}`} href={`/tasks/${risk.task_id}`} className="block rounded-xl bg-warning-soft p-3 text-sm"><strong>{risk.task_id} · {risk.owner}</strong><p className="mt-1 break-words text-warning">{risk.advice}</p></Link>)}
              {!risks.length && <p className="text-sm text-muted">{diagnosed ? "本次诊断未发现风险任务。" : "生成诊断后可查看逾期和交接卡点。"}</p>}
            </div>
          </section>
          <form onSubmit={(event) => { event.preventDefault(); void runAi("question"); }} className="page-panel p-5">
            <h2 className="flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4 text-primary" aria-hidden />自然语言问答</h2>
            <label htmlFor="board-question" className="mt-3 block text-sm font-medium">问题</label>
            <input id="board-question" value={question} disabled={Boolean(pending)} onChange={(event) => setQuestion(event.target.value)} placeholder="例如，这周谁逾期最多" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            <button disabled={Boolean(pending) || !question.trim()} aria-busy={pending === "question"} className="loading-button mt-2 rounded-lg border border-primary px-3 py-2 text-sm text-primary">{pending === "question" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{pending === "question" ? "正在查询进度…" : "查询进度"}</button>
            <div aria-live="polite" aria-busy={pending === "question"}>{answer && <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-primary-soft p-3 text-sm leading-6 text-primary-strong">{answer}</p>}</div>
          </form>
        </aside>
      </div>
    </div>
  );
}
