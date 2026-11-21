/** 后端业务状态 → 前端统一状态与展示信息（见《前端适配声明》第 4 节）。
 *  后端是最终事实来源；这里只做展示映射，未知状态给安全的兜底，不静默当成功。 */

export type UnifiedStatus =
  | "idle"
  | "running"
  | "waiting_user"
  | "succeeded"
  | "stale"
  | "unknown";

export type Tone = "neutral" | "primary" | "warning" | "success" | "danger";

export interface StatusMeta {
  unified: UnifiedStatus;
  /** 展示给用户的中文状态文案。 */
  label: string;
  /** 用于配色的语义 tone，对应 globals.css 里的颜色工具类。 */
  tone: Tone;
}

const STATUS_META: Record<string, StatusMeta> = {
  待办理: { unified: "idle", label: "待办理", tone: "neutral" },
  办理中: { unified: "running", label: "办理中", tone: "primary" },
  待复核: { unified: "waiting_user", label: "待复核", tone: "warning" },
  待补充: { unified: "waiting_user", label: "待补充", tone: "warning" },
  已完成: { unified: "succeeded", label: "已完成", tone: "success" },
};

const UNKNOWN_META: StatusMeta = {
  unified: "unknown",
  label: "未知状态",
  tone: "neutral",
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? UNKNOWN_META;
}

/** 截止时间附加标记：逾期 / 临期（不等同于失败，见《前端适配声明》第 4 节）。 */
export type DueState = "overdue" | "due_soon" | null;

export function dueStateMeta(dueState: DueState): StatusMeta | null {
  if (dueState === "overdue") {
    return { unified: "stale", label: "已逾期", tone: "danger" };
  }
  if (dueState === "due_soon") {
    return { unified: "stale", label: "即将到期", tone: "warning" };
  }
  return null;
}

/** 是否已逾期（优先用后端给的 due_state，其次按状态与时间兜底判断）。 */
export function isOverdue(status: string, dueAt: string, dueState?: DueState): boolean {
  if (status === "已完成") return false;
  if (dueState) return dueState === "overdue";
  const due = new Date(dueAt);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}
