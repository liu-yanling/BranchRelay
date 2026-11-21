"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  FileBarChart,
  LayoutGrid,
  ListChecks,
  Menu,
  PieChart,
  X,
  type LucideIcon,
} from "lucide-react";
import { RoleProvider } from "@/lib/role-context";
import { getBootstrap } from "@/lib/api/client";
import type { User } from "@/lib/api/types";
import { ROLE_FALLBACK } from "@/lib/roles";
import { IdentitySwitch } from "./identity-switch";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  available: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "我的工作台", icon: LayoutGrid, available: true },
  { href: "/tasks", label: "任务详情", icon: ListChecks, available: true },
  { href: "/notifications", label: "站内通知", icon: Bell, available: true },
  { href: "/board", label: "支行看板", icon: PieChart, available: true },
  { href: "/ai/report", label: "AI 周报", icon: FileBarChart, available: true },
];

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="主导航" className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
        if (!item.available) {
          return (
            <div
              key={item.href}
              aria-disabled="true"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted opacity-60"
              title="当前身份暂不可用"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              <span className="text-[11px]">后续阶段</span>
            </div>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-primary-soft text-primary-strong"
                : "text-text hover:bg-bg"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span>{item.label}</span>
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(ROLE_FALLBACK);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBootstrap()
      .then((data) => {
        if (!cancelled && data.users?.length) setUsers(data.users);
      })
      .catch(() => {
        // 后端暂不可用时保留兜底身份列表，不阻塞页面。
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const brand = (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-primary-soft text-sm font-medium text-primary">
        沪
      </span>
      <span className="text-base font-medium tracking-tight text-white">BranchRelay</span>
    </div>
  );

  return (
    <RoleProvider>
      <div className="min-h-screen">
        {/* 桌面侧栏 */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-bg md:flex">
          <div className="flex h-14 items-center border-b border-border px-4">{brand}</div>
          <Suspense fallback={<NavList pathname="" />}>
            <PathNavList />
          </Suspense>
        </aside>

        {/* 移动端抽屉 */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-lg">
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                {brand}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-md p-1.5 text-muted hover:bg-bg"
                  aria-label="关闭导航"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <Suspense fallback={<NavList pathname="" />}>
                <PathNavList onNavigate={() => setDrawerOpen(false)} />
              </Suspense>
            </aside>
          </div>
        )}

        {/* 主区域 */}
        <div className="flex min-h-screen flex-col md:pl-60">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-bg px-4 md:px-8">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="rounded-md p-1.5 text-muted hover:bg-bg md:hidden"
                aria-label="打开导航"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>
              <span className="text-sm text-muted md:hidden">BranchRelay</span>
            </div>
            <IdentitySwitch users={users} />
          </header>
          <main className="flex-1 p-4 md:p-8 lg:p-10">{children}</main>
        </div>
      </div>
    </RoleProvider>
  );
}
