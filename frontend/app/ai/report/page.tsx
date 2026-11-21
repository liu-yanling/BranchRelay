"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Save, Sparkles } from "lucide-react";
import { generateReport, getReport, getUserErrorMessage, saveReport } from "@/lib/api/client";
import { useRole } from "@/lib/role-context";
import type { ReportResponse } from "@/lib/api/types";

const WEEK_START = "2026-11-16";
const SECTIONS = [
  { key: "completed", label: "本周完成" },
  { key: "pending", label: "待推进" },
  { key: "next_week", label: "下周安排" },
] as const;

export default function ReportPage() {
  const { role } = useRole();
  return <ReportScope key={role} role={role} />;
}

function ReportScope({ role }: { role: string }) {
  const [scope, setScope] = useState(role === "u_mgr" ? "branch" : "personal");
  return <ReportContent key={scope} role={role} scope={scope} onScopeChange={setScope} />;
}

function ReportContent({ role, scope, onScopeChange }: { role: string; scope: string; onScopeChange: (scope: string) => void }) {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [content, setContent] = useState("");
  const [method, setMethod] = useState("");
  const [cutoff, setCutoff] = useState("");
  const [pending, setPending] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const locked = useRef(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getReport(role, scope, WEEK_START)
      .then((data) => {
        if (cancelled) return;
        setReport(data.report);
        setContent(data.draft?.content ?? (data.report ? renderReport(data.report) : ""));
        setMethod(data.draft?.method ?? data.report?.method ?? "");
        setCutoff(data.draft?.data_cutoff ?? data.report?.data_cutoff ?? "");
        setError("");
      })
      .catch((cause) => { if (!cancelled) setError(getUserErrorMessage(cause, "周报草稿暂时无法加载，请稍后重试。")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [role, scope, revision]);

  async function generate() {
    if (locked.current || loading) return;
    locked.current = true;
    setPending("generate");
    setError("");
    setSaved(false);
    try {
      const result = await generateReport(role, scope, WEEK_START);
      if (!active.current) return;
      setReport(result);
      setContent(renderReport(result));
      setMethod(result.method);
      setCutoff(result.data_cutoff);
    } catch (cause) {
      if (active.current) setError(getUserErrorMessage(cause, "周报生成暂时不可用，请稍后重试。"));
    } finally {
      locked.current = false;
      if (active.current) setPending("");
    }
  }

  async function save() {
    if (locked.current || loading || !content.trim() || !cutoff) return;
    locked.current = true;
    setPending("save");
    setError("");
    setSaved(false);
    try {
      await saveReport({ role, scope, week_start: WEEK_START, content, method: method || "manual", data_cutoff: cutoff });
      if (active.current) setSaved(true);
    } catch (cause) {
      if (active.current) setError(getUserErrorMessage(cause, "周报保存失败，请稍后重试。"));
    } finally {
      locked.current = false;
      if (active.current) setPending("");
    }
  }

  const blocked = loading || Boolean(pending);
  const methodLabel = method === "rules" ? "规则汇总" : method === "model" ? "AI 生成" : method || "尚未生成";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="page-heading">
        <div><h1 className="text-xl font-semibold">AI 周报</h1><p className="mt-1 text-sm text-muted">按任务事实生成可编辑周报，任务编号可跳转查看。</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <label htmlFor="report-scope" className="text-sm font-medium">报告范围
            <select id="report-scope" value={scope} onChange={(event) => onScopeChange(event.target.value)} className="mt-1 block rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <option value="personal">我的范围</option>{role === "u_mgr" && <option value="branch">支行范围</option>}
            </select>
          </label>
          <button onClick={() => void generate()} disabled={blocked} aria-busy={pending === "generate"} className="loading-button rounded-lg bg-primary px-4 py-2 text-sm text-white">
            {pending === "generate" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}{pending === "generate" ? "正在生成周报…" : "生成周报"}
          </button>
        </div>
      </div>
      <section className="page-panel mt-5 p-5">
        <div className="page-panel-header -mx-5 -mt-5 flex flex-wrap items-center justify-between gap-3 rounded-t-[inherit] px-5 py-4">
          <div><h2 className="font-medium">2026 年 11 月 16 日至 22 日</h2><p className="mt-1 text-xs text-muted">数据截止　{cutoff ? new Date(cutoff).toLocaleString("zh-CN", { hour12: false }) : "待加载"} · 生成方式　{methodLabel}</p></div>
          <button onClick={() => void save()} disabled={blocked || !content.trim() || !cutoff} aria-busy={pending === "save"} className="loading-button rounded-lg border border-border px-3 py-2 text-sm">
            {pending === "save" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}{pending === "save" ? "正在保存…" : "保存草稿"}
          </button>
        </div>
        <div aria-live="polite" aria-busy={loading || pending === "generate"}>
          {loading ? <p role="status" className="loading-button py-10 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />正在读取周报草稿…</p> : report ? <div className="mt-5 grid gap-4 md:grid-cols-3">
            {SECTIONS.map((section) => <section key={section.key} className="rounded-xl border border-border bg-bg p-4">
              <h3 className="font-medium">{section.label}</h3>
              <ul className="mt-3 space-y-3">{report[section.key].map((item) => <li key={item.task_id} className="break-words text-sm leading-6"><Link href={`/tasks/${item.task_id}`} className="font-semibold text-primary hover:underline">{item.task_id}</Link> {item.text.replace(`${item.task_id} `, "")}</li>)}{!report[section.key].length && <li className="text-sm text-muted">暂无记录</li>}</ul>
            </section>)}
          </div> : <div className="flex flex-col items-center py-10 text-sm text-muted"><FileText className="h-8 w-8" aria-hidden /><p className="mt-3">{cutoff ? "已恢复上次保存的周报草稿。" : "点击「生成周报」汇总当前范围任务。"}</p></div>}
        </div>
        <label htmlFor="report-draft" className="mt-5 block text-sm font-medium">可编辑草稿</label>
        <textarea id="report-draft" value={content} disabled={blocked || !cutoff} onChange={(event) => { setContent(event.target.value); setSaved(false); }} rows={8} className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm leading-6" placeholder="生成后可编辑周报草稿并保存。" />
        {error && <div className="status-banner status-banner-error mt-3"><p role="alert">{error}</p>{!cutoff && <button disabled={blocked} onClick={() => { setLoading(true); setRevision((value) => value + 1); }} className="shrink-0 underline">重新加载</button>}</div>}
        <div aria-live="polite">{saved && <p role="status" className="status-banner status-banner-success mt-3">周报草稿已保存。</p>}</div>
      </section>
    </div>
  );
}

function renderReport(report: ReportResponse): string {
  return SECTIONS.map((section) => `${section.label}\n${report[section.key].map((item) => item.text.startsWith(item.task_id) ? item.text : `${item.task_id} ${item.text}`).join("\n") || "暂无记录"}`).join("\n\n");
}
