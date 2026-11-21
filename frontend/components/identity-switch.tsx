"use client";

/** 右上角模拟身份切换（决策 D5：无真实登录）。
 *  用原生 select 保证键盘与读屏可用；切换后刷新当前页面数据。 */

import { useRole } from "@/lib/role-context";
import { ROLE_ORDER, type RoleId } from "@/lib/roles";
import type { User } from "@/lib/api/types";

export function IdentitySwitch({ users }: { users: User[] }) {
  const { role, setRole } = useRole();

  const labelFor = (id: string): string => {
    const found = users.find((u) => u.id === id);
    return found?.name ?? id;
  };

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-muted sm:inline">当前身份</span>
      <select
        value={role}
        onChange={(event) => setRole(event.target.value as RoleId)}
        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text shadow-sm outline-none transition-colors focus:border-primary"
        aria-label="切换模拟身份"
      >
        {ROLE_ORDER.map((id) => (
          <option key={id} value={id}>
            {labelFor(id)}
          </option>
        ))}
      </select>
    </label>
  );
}
