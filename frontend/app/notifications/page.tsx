"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, Loader2, RefreshCw } from "lucide-react";
import { getNotifications, getUserErrorMessage, markNotificationRead } from "@/lib/api/client";
import { useRole } from "@/lib/role-context";
import type { NotificationItem } from "@/lib/api/types";

export default function NotificationsPage() {
  const { role } = useRole();
  return <NotificationsContent key={role} role={role} />;
}

function NotificationsContent({ role }: { role: string }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getNotifications(role)
      .then((data) => {
        if (cancelled) return;
        setItems(data.notifications);
        setError("");
      })
      .catch((cause) => { if (!cancelled) setError(getUserErrorMessage(cause, "通知暂时无法加载，请稍后重试。")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [role, revision]);

  async function read(item: NotificationItem, navigate = false) {
    if (locked.current) return;
    locked.current = true;
    setPendingId(item.id);
    setError("");
    setMessage("");
    try {
      if (!item.read_at) await markNotificationRead(item.id);
      if (!active.current) return;
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: entry.read_at ?? new Date().toISOString() } : entry));
      if (navigate) router.push(`/tasks/${item.task_id}`);
      else setMessage("通知已标记为已读。");
    } catch (cause) {
      if (active.current) setError(getUserErrorMessage(cause, "通知暂时无法标记为已读，请稍后重试。"));
    } finally {
      locked.current = false;
      if (active.current) setPendingId(null);
    }
  }

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="page-heading">
        <div><h1 className="text-xl font-semibold">站内通知</h1><p className="mt-1 text-sm text-muted">集中查看任务交接、退回、通过和到期提醒。</p></div>
        <span aria-live="polite" className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-sm text-primary-strong">未读 {unread}</span>
      </div>
      {error && <div className="status-banner status-banner-error mt-4"><p role="alert" className="flex-1">{error}</p><button disabled={pendingId !== null || loading} onClick={() => { setLoading(true); setError(""); setRevision((value) => value + 1); }} className="loading-button shrink-0 underline"><RefreshCw className="h-4 w-4" aria-hidden />重新加载</button></div>}
      <div aria-live="polite">{message && <p role="status" className="status-banner status-banner-success mt-3">{message}</p>}</div>
      {loading ? <div role="status" className="flex justify-center py-16 text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />正在加载通知…</div> : <ul className="mt-5 space-y-3">
        {!items.length && !error && <li className="page-panel border-dashed p-12 text-center text-sm text-muted">暂无通知</li>}
        {items.map((item) => <li key={item.id} className={`page-panel p-4 ${item.read_at ? "" : "notification-unread"}`}>
          <div className="flex items-start gap-3">
            <span className={`shrink-0 rounded-lg p-2 ${item.read_at ? "bg-bg text-muted" : "bg-primary-soft text-primary"}`}><Bell className="h-4 w-4" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className={`text-xs ${item.read_at ? "text-muted" : "font-medium text-primary"}`}>{item.read_at ? "已读" : "未读"}</span><time className="text-xs text-muted">{new Date(item.created_at).toLocaleString("zh-CN", { hour12: false })}</time></div>
              <p className="mt-2 break-words text-sm font-medium">{item.message}</p>
              <Link href={`/tasks/${item.task_id}`} aria-disabled={pendingId !== null} aria-busy={pendingId === item.id} onClick={(event) => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                void read(item, true);
              }} className="loading-button mt-2 text-sm text-primary hover:underline">{pendingId === item.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{pendingId === item.id ? "正在处理…" : `查看任务 ${item.task_id}`}</Link>
            </div>
            {!item.read_at && <button disabled={pendingId !== null} onClick={() => void read(item)} aria-label={`标记通知 ${item.id} 为已读`} className="shrink-0 rounded-lg p-3 text-muted hover:bg-bg"><Check className="h-4 w-4" aria-hidden /></button>}
          </div>
        </li>)}
      </ul>}
    </div>
  );
}
