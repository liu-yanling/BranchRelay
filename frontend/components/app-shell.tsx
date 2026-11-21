"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronRight,
  FileBarChart,
  Landmark,
  LayoutGrid,
  ListChecks,
  Menu,
  PieChart,
  X,
} from "lucide-react";
import { RoleProvider } from "@/lib/role-context";
import { getBootstrap } from "@/lib/api/client";
import type { User } from "@/lib/api/types";
import { ROLE_FALLBACK } from "@/lib/roles";
import { IdentitySwitch } from "./identity-switch";

const NAV = [
  { href: "/", label: "我的工作台", icon: LayoutGrid },
  { href: "/tasks", label: "任务中心", icon: ListChecks },
  { href: "/notifications", label: "站内通知", icon: Bell },
  { href: "/board", label: "支行看板", icon: PieChart },
  { href: "/ai/report", label: "AI 周报", icon: FileBarChart },
];

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="主导航" className="flex flex-col gap-2 px-4 py-6">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className="bank-nav-link flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {active && <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );
}

function PathNavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <NavList pathname={pathname} onNavigate={onNavigate} />;
}

function BankBrand() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="BranchRelay 工作台">
      <span className="bank-mark"><Landmark className="h-6 w-6" aria-hidden /></span>
      <span>
        <span className="block text-lg font-semibold tracking-tight text-white">BranchRelay</span>
        <span className="block text-[11px] tracking-[.14em] text-blue-200/70">支行智能协同平台</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(ROLE_FALLBACK);
  const [demoTime, setDemoTime] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    getBootstrap()
      .then((data) => {
        if (cancelled) return;
        if (data.users?.length) setUsers(data.users);
        setDemoTime(data.demo_time);
      })
      .catch(() => {
        // 接口暂不可用时，保留可切换的演示身份。
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const dialog = drawer.current;
    const trigger = menuButton.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [drawerOpen]);

  return (
    <RoleProvider>
      <div className="min-h-screen">
        <aside className="bank-sidebar fixed inset-y-0 left-0 z-30 hidden w-60 flex-col md:flex">
          <div className="flex h-24 items-center border-b border-white/10 px-6"><BankBrand /></div>
          <Suspense fallback={<NavList pathname="" />}><PathNavList /></Suspense>
          <div className="bank-sidebar-footer mx-4 mb-6 mt-auto rounded-2xl border border-white/10 p-4">
            <Building2 className="mb-3 h-5 w-5 text-[#dfc491]" aria-hidden />
            <p className="text-sm font-medium text-white">上海银行</p>
            <p className="mt-1 text-xs leading-6 text-blue-100/65">北京中关村支行</p>
            <p className="mt-3 border-t border-white/10 pt-3 text-[11px] text-blue-100/50">演示环境 · 数据均为虚构</p>
          </div>
        </aside>

        {drawerOpen && (
          <dialog
            ref={drawer}
            aria-label="主导航"
            onCancel={() => setDrawerOpen(false)}
            onClick={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}
            className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-950/50"
          >
            <div className="bank-sidebar flex h-full w-72 flex-col text-white">
              <div className="flex h-24 items-center justify-between border-b border-white/10 px-5">
                <BankBrand />
                <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg p-3 text-blue-100 hover:bg-white/10" aria-label="关闭导航"><X className="h-5 w-5" aria-hidden /></button>
              </div>
              <Suspense fallback={<NavList pathname="" />}><PathNavList onNavigate={() => setDrawerOpen(false)} /></Suspense>
              <p className="mt-auto px-6 pb-6 text-xs text-blue-100/60">上海银行 · 北京中关村支行 · 演示</p>
            </div>
          </dialog>
        )}

        <div className="flex min-h-screen flex-col md:pl-60">
          <header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-3 border-b border-border bg-white/95 px-4 backdrop-blur-md md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button ref={menuButton} type="button" onClick={() => setDrawerOpen(true)} className="rounded-lg p-3 text-muted hover:bg-bg md:hidden" aria-label="打开导航" aria-expanded={drawerOpen}><Menu className="h-5 w-5" aria-hidden /></button>
              <span className="hidden h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary sm:flex"><Landmark className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">上海银行<span className="hidden font-normal text-muted lg:inline"> / 北京中关村支行</span></p>
                <p className="mt-0.5 text-[11px] text-muted">智能办公与协同管理</p>
              </div>
            </div>
            <div className="flex items-center gap-4 xl:gap-6">
              {demoTime && <span className="hidden text-xs tabular-nums text-muted xl:block">演示日期 {demoTime.slice(0, 10)}</span>}
              <Link href="/notifications" aria-label="查看站内通知" className="hidden rounded-xl border border-border p-3 text-muted hover:bg-primary-soft sm:block"><Bell className="h-[18px] w-[18px]" aria-hidden /></Link>
              <IdentitySwitch users={users} />
            </div>
          </header>
          <main className="workspace-main flex-1 p-4 md:p-7 xl:p-9">{children}</main>
        </div>
      </div>
    </RoleProvider>
  );
}
