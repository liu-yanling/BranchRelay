"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Loader2, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import { askBoard, diagnose, getBoard } from "@/lib/api/client";
import { useRole } from "@/lib/role-context";
import type { BoardResponse, DiagnosisRisk } from "@/lib/api/types";
import { statusMeta } from "@/lib/task-status";

export default function BoardPage() {
  const { role } = useRole();
  const [data, setData] = useState<BoardResponse | null>(null);
  const [filter, setFilter] = useState("");
  const [risks, setRisks] = useState<DiagnosisRisk[]>([]);
  const [question, setQuestion] = useState("这周谁逾期最多");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = () => { setLoading(true); getBoard(role, filter).then(setData).catch((e) => setError(e instanceof Error ? e.message : "加载失败")).finally(() => setLoading(false)); };
  useEffect(() => {
    if (role !== "u_mgr") return;
    let cancelled = false;
    getBoard(role, filter).then((result) => { if (!cancelled) setData(result); }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "加载失败"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [role, filter]);
  async function runDiagnosis() { setBusy(true); try { const result = await diagnose(role); setRisks(result.risks); } catch (e) { setError(e instanceof Error ? e.message : "诊断失败"); } finally { setBusy(false); } }
  async function ask() { if (!question.trim()) return; setBusy(true); try { const result = await askBoard(question, role); setAnswer(`${result.answer ?? ""}${result.refs?.length ? `（引用：${result.refs.join("、")}）` : ""}`); } catch (e) { setError(e instanceof Error ? e.message : "问答失败"); } finally { setBusy(false); } }
  if (role !== "u_mgr") return <div className="mx-auto max-w-3xl rounded-card border border-border bg-surface p-12 text-center"><BarChart3 className="mx-auto h-8 w-8 text-muted" /><h1 className="mt-3 font-semibold">支行看板</h1><p className="mt-1 text-sm text-muted">支行看板与负责人范围的 AI 分析仅对支行负责人开放。</p></div>;
  return <div className="mx-auto max-w-6xl"><div><h1 className="text-xl font-semibold">支行看板</h1><p className="mt-1 text-sm text-muted">本周任务全量进展、风险定位和 AI 辅助追踪。</p></div>{loading ? <div className="flex justify-center py-16 text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在加载…</div> : data && <><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{[["total", "本周任务"], ["completed", "已完成"], ["pending_review", "待复核"], ["overdue", "已逾期"]].map(([key, label]) => <button key={key} onClick={() => setFilter(filter === key ? "" : key)} className={`rounded-card border border-border bg-surface p-4 text-left shadow-sm ${filter === key ? "ring-2 ring-primary" : ""}`}><p className="text-sm text-muted">{label}</p><p className="mt-2 text-2xl font-semibold text-primary">{data.stats[key as keyof typeof data.stats]}</p></button>)}</div><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]"><section className="rounded-card border border-border bg-surface p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">任务进展</h2><button onClick={load} className="rounded-md p-2 text-muted hover:bg-bg" aria-label="刷新"><RefreshCw className="h-4 w-4" /></button></div><div className="mt-4 space-y-3">{!data.tasks.length && <p className="py-8 text-center text-sm text-muted">当前筛选暂无任务</p>}{data.tasks.map((task) => <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:border-primary"><div className="min-w-0"><p className="truncate text-sm font-medium">{task.id} {task.title}</p><p className="mt-1 text-xs text-muted">当前处理人：{task.current_owner_id || "已结束"}</p></div><span className="shrink-0 text-xs text-muted">{statusMeta(task.status).label}</span></Link>)}</div></section><aside className="space-y-5"><section className="rounded-card border border-border bg-surface p-5"><h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" />AI 进度诊断</h2><button onClick={runDiagnosis} disabled={busy} className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm text-white">{busy ? "分析中…" : "生成诊断"}</button><div className="mt-4 space-y-3">{risks.map((risk) => <Link key={risk.task_id} href={`/tasks/${risk.task_id}`} className="block rounded-lg bg-warning-soft p-3 text-sm"><strong>{risk.task_id} · {risk.owner}</strong><p className="mt-1 text-warning">{risk.advice}</p></Link>)}{!risks.length && <p className="text-sm text-muted">点击生成，识别逾期、待复核和待补充卡点。</p>}</div></section><section className="rounded-card border border-border bg-surface p-5"><h2 className="flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4 text-primary" />自然语言问答</h2><input value={question} onChange={(e) => setQuestion(e.target.value)} className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm" /><button onClick={ask} disabled={busy} className="mt-2 rounded-lg border border-primary px-3 py-2 text-sm text-primary">查询进度</button>{answer && <p className="mt-3 rounded-lg bg-primary-soft p-3 text-sm leading-6 text-primary-strong">{answer}</p>}</section></aside></div></>}{error && <p className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}</div>;
}
