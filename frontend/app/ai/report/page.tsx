"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Save, Sparkles } from "lucide-react";
import { generateReport, getReport, saveReport } from "@/lib/api/client";
import { useRole } from "@/lib/role-context";
import type { ReportResponse } from "@/lib/api/types";

const WEEK_START = "2026-11-16";
const sections = [{ key: "completed", label: "本周完成" }, { key: "pending", label: "待推进" }, { key: "next_week", label: "下周安排" }] as const;

export default function ReportPage() {
  const { role } = useRole();
  return <ReportContent key={role} role={role} />;
}

function ReportContent({ role }: { role: string }) {
  const [scope, setScope] = useState(role === "u_mgr" ? "branch" : "personal");
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getReport(role, scope, WEEK_START).then((data) => { if (!cancelled) setContent(data.draft?.content ?? ""); }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "草稿加载失败"); });
    return () => { cancelled = true; };
  }, [role, scope]);

  const generate = async () => {
    setLoading(true); setError(""); setSaved(false);
    try { const result = await generateReport(role, scope, WEEK_START); setReport(result); setContent(renderReport(result)); }
    catch (e) { setError(e instanceof Error ? e.message : "周报生成失败"); }
    finally { setLoading(false); }
  };
  const save = async () => { if (!report && !content) return; setBusy(true); try { await saveReport({ role, scope, week_start: WEEK_START, content, method: report?.method ?? "rules", data_cutoff: report?.data_cutoff ?? new Date().toISOString() }); setSaved(true); } catch (e) { setError(e instanceof Error ? e.message : "保存失败"); } finally { setBusy(false); } };
  const parsed = useMemo(() => report, [report]);
  return <div className="mx-auto max-w-5xl"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold">AI 周报</h1><p className="mt-1 text-sm text-muted">按任务事实生成可编辑周报，所有结论保留任务编号引用。</p></div><div className="flex items-center gap-2"><select value={scope} onChange={(e) => { setScope(e.target.value); setReport(null); setContent(""); setSaved(false); setError(""); }} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"><option value="personal">我的范围</option>{role === "u_mgr" && <option value="branch">支行范围</option>}</select><button onClick={generate} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white"><Sparkles className="h-4 w-4" />{loading ? "生成中…" : "生成周报"}</button></div></div><div className="mt-5 rounded-card border border-border bg-surface p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-2 border-b border-border pb-4"><div><p className="font-medium">2026-11-16 至 2026-11-23</p><p className="mt-1 text-xs text-muted">数据截止：演示当前时刻；生成方式：{report?.method ?? "尚未生成"}</p></div><button onClick={save} disabled={busy || (!report && !content)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"><Save className="h-4 w-4" />{saved ? "已保存" : "保存草稿"}</button></div>{parsed ? <div className="mt-5 grid gap-4 md:grid-cols-3">{sections.map((section) => <section key={section.key} className="rounded-lg bg-bg p-4"><h2 className="font-medium">{section.label}</h2><ul className="mt-3 space-y-3">{parsed[section.key].map((item) => <li key={item.task_id} className="text-sm leading-6"><Link href={`/tasks/${item.task_id}`} className="font-semibold text-primary hover:underline">{item.task_id}</Link> {item.text.replace(`${item.task_id} `, "")}</li>)}{!parsed[section.key].length && <li className="text-sm text-muted">暂无记录</li>}</ul></section>)}</div> : <div className="flex flex-col items-center py-14 text-center text-sm text-muted"><FileText className="h-8 w-8" /><p className="mt-3">选择范围后点击「生成周报」。</p></div>}<label className="mt-5 block text-sm font-medium">可编辑草稿<textarea value={content} onChange={(e) => { setContent(e.target.value); setSaved(false); }} rows={8} className="mt-2 w-full rounded-lg border border-border px-3 py-2 font-mono text-sm leading-6" placeholder="生成的周报草稿会显示在这里，也可以直接编辑。" /></label>{error && <p className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}</div></div>;
}

function renderReport(report: ReportResponse): string {
  return sections.map((section) => `${section.label}\n${report[section.key].map((item) => `${item.task_id} ${item.text}`).join("\n") || "暂无记录"}`).join("\n\n");
}
