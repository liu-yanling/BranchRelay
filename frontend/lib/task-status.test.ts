import { describe, expect, it } from "vitest";
import { dueStateMeta, isOverdue, statusMeta } from "./task-status";

describe("statusMeta：后端业务状态 → 前端统一状态", () => {
  it("映射常见状态与文案、tone", () => {
    expect(statusMeta("待办理")).toMatchObject({ unified: "idle", label: "待办理", tone: "neutral" });
    expect(statusMeta("办理中")).toMatchObject({ unified: "running", tone: "primary" });
    expect(statusMeta("待复核")).toMatchObject({ unified: "waiting_user", tone: "warning" });
    expect(statusMeta("待补充")).toMatchObject({ unified: "waiting_user", tone: "warning" });
    expect(statusMeta("已完成")).toMatchObject({ unified: "succeeded", tone: "success" });
  });

  it("未知状态给安全兜底，不静默当成功", () => {
    expect(statusMeta("全新状态").unified).toBe("unknown");
  });
});

describe("dueStateMeta：逾期/临期是附加标记", () => {
  it("映射为 stale 标记", () => {
    expect(dueStateMeta("overdue")).toMatchObject({ unified: "stale", label: "已逾期", tone: "danger" });
    expect(dueStateMeta("due_soon")).toMatchObject({ unified: "stale", label: "即将到期", tone: "warning" });
    expect(dueStateMeta(null)).toBeNull();
  });
});

describe("isOverdue", () => {
  it("已完成任务不算逾期", () => {
    expect(isOverdue("已完成", "2020-01-01T00:00:00+08:00", null)).toBe(false);
  });

  it("后端给出 due_state 时以它为准", () => {
    expect(isOverdue("办理中", "2099-01-01T00:00:00+08:00", "overdue")).toBe(true);
  });
});
