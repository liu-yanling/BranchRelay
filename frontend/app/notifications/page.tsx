"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, Loader2 } from "lucide-react";
import { getNotifications, markNotificationRead } from "@/lib/api/client";
import { useRole } from "@/lib/role-context";
import type { NotificationItem } from "@/lib/api/types";

export default function NotificationsPage() {
  const { role } = useRole();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    getNotifications(role).then((data) => { if (!cancelled) { setItems(data.notifications); setUnread(data.unread); setError(""); } }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "通知加载失败"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [role]);
  async function read(item: NotificationItem) { if (item.read_at) return; try { await markNotificationRead(item.id); setItems((current) => current.map((x) => x.id === item.id ? { ...x, read_at: new Date().toISOString() } : x)); setUnread((n) => Math.max(0, n - 1)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "标记已读失败"); } }
  return <div className="mx-auto max-w-4xl"><div className="flex items-center justify-between"><div><h1 className="text-xl font-semibold">站内通知</h1><p className="mt-1 text-sm text-muted">任务交接、退回、通过和到期提醒都会集中在这里。</p></div><span className="rounded-full bg-primary-soft px-3 py-1 text-sm text-primary-strong">未读 {unread}</span></div>{error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}{loading ? <div className="flex justify-center py-16 text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在加载…</div> : <div className="mt-5 space-y-3">{!items.length && <div className="rounded-card border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">暂无通知</div>}{items.map((item) => <div key={item.id} className={`rounded-card border border-border bg-surface p-4 shadow-sm ${item.read_at ? "opacity-70" : ""}`}><div className="flex gap-3"><div className="rounded-lg bg-primary-soft p-2 text-primary"><Bell className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium">{item.message}</p><time className="text-xs text-muted">{new Date(item.created_at).toLocaleString("zh-CN", { hour12: false })}</time></div><Link href={`/tasks/${item.task_id}`} onClick={() => read(item)} className="mt-2 inline-flex text-sm text-primary hover:underline">查看任务 {item.task_id}</Link></div>{!item.read_at && <button onClick={() => read(item)} aria-label="标记已读" className="self-start rounded-md p-1.5 text-muted hover:bg-bg"><Check className="h-4 w-4" /></button>}</div></div>)}</div>}</div>;
}
