import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskCard } from "./task-card";
import type { Task } from "@/lib/api/types";

const baseTask: Task = {
  id: "T-001",
  title: "汇总周例会材料",
  description: "汇总各部门本周工作要点。",
  creator_id: "u_zh",
  executor_id: "u_retail",
  reviewer_id: "u_ops",
  current_owner_id: null,
  plan_date: "2026-11-16",
  due_at: "2026-11-18T17:00:00+08:00",
  status: "已完成",
  version: 5,
  submit_note: null,
  reject_reason: null,
  created_at: "2026-11-14T09:00:00+08:00",
  updated_at: "2026-11-18T16:30:00+08:00",
  completed_at: "2026-11-18T16:30:00+08:00",
};

describe("TaskCard", () => {
  it("渲染标题、状态与任务编号", () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText("汇总周例会材料")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText(/T-001/)).toBeInTheDocument();
  });

  it("逾期任务展示「已逾期」标记", () => {
    render(
      <TaskCard
        task={{ ...baseTask, id: "T-004", status: "待补充", due_state: "overdue" }}
      />,
    );
    expect(screen.getByText("已逾期")).toBeInTheDocument();
  });
});
