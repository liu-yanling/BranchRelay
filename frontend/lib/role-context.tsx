"use client";

/** 当前模拟身份（用户偏好，存在 LocalStorage；刷新后仍保持）。
 *  用 useSyncExternalStore 读取 localStorage：服务端渲染用默认值，客户端挂载后读真实值，
 *  既避免 hydration 不一致，也不在 effect 里同步 setState。
 *  后端是最终事实来源，这里只是前端记住「当前以谁的身份在看」。 */

import { createContext, useContext, useSyncExternalStore } from "react";
import { DEFAULT_ROLE, type RoleId } from "./roles";

const STORAGE_KEY = "branchrelay.role";
const VALID_ROLES: RoleId[] = ["u_zh", "u_retail", "u_ops", "u_mgr"];

const listeners = new Set<() => void>();

function readStoredRole(): RoleId {
  if (typeof window === "undefined") return DEFAULT_ROLE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return VALID_ROLES.includes(stored as RoleId) ? (stored as RoleId) : DEFAULT_ROLE;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RoleId {
  return readStoredRole();
}

function getServerSnapshot(): RoleId {
  return DEFAULT_ROLE;
}

function persistRole(next: RoleId): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, next);
  }
  listeners.forEach((listener) => listener());
}

interface RoleContextValue {
  role: RoleId;
  setRole: (role: RoleId) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const role = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <RoleContext.Provider value={{ role, setRole: persistRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const value = useContext(RoleContext);
  if (!value) throw new Error("useRole 必须在 RoleProvider 内使用");
  return value;
}
