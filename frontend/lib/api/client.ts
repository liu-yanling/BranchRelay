/** 集中式 API 客户端：页面不散落 fetch，统一处理基础 URL、错误归一化与查询参数。
 *  浏览器只请求同源 /api/*，由 proxy.ts 在服务端转发到后端（见《前端适配声明》第 3 节）。 */

import type {
  AiTextResponse,
  BoardResponse,
  BootstrapResponse,
  DiagnosisResponse,
  NotificationsResponse,
  ReportGetResponse,
  ReportResponse,
  Task,
  TaskDetail,
  WorkbenchResponse,
} from "./types";

export interface AppErrorLike {
  code: string;
  message: string;
  status: number;
  userMessage: string;
  retryable: boolean;
}

/** 由后端 {"error":{"code","message"}} 归一化来的应用错误。 */
export class ApiError extends Error implements AppErrorLike {
  code: string;
  status: number;
  userMessage: string;
  retryable: boolean;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.userMessage = userMessageFor(code, message);
    // 网络/超时/服务不可用才建议重试；业务冲突（如版本过期）重试无意义。
    this.retryable =
      status >= 500 || status === 408 || status === 429 || status === 0;
  }
}

function userMessageFor(code: string, fallback: string): string {
  const known: Record<string, string> = {
    not_found: "没有找到对应的内容，可能已被删除。",
    forbidden: "当前身份没有权限执行这个操作。",
    conflict: "数据已被更新，请刷新后重试。",
    validation_error: "填写的内容不符合要求，请检查后重试。",
    bad_request: "请求无法处理，请检查后重试。",
  };
  return known[code] ?? fallback;
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  if (!params) return path;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      qs.set(key, String(value));
    }
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    params?: Record<string, string | number | undefined>;
  } = {},
): Promise<T> {
  const { method = "GET", body, params } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "network_error", "网络连接失败，请检查网络后重试。");
  }

  if (!response.ok) {
    let code = "unknown";
    let message = "请求失败，请稍后再试。";
    try {
      const data = (await response.json()) as { error?: { code?: string; message?: string } };
      code = data.error?.code ?? code;
      message = data.error?.message ?? message;
    } catch {
      // 非 JSON 错误体（如 502 网关），用状态码兜底。
      message = `服务暂时不可用（${response.status}），请稍后再试。`;
      code = `http_${response.status}`;
    }
    throw new ApiError(response.status, code, message);
  }

  return (await response.json()) as T;
}

/** GET /api/bootstrap：用户列表（供身份切换）与演示时钟。 */
export function getBootstrap(): Promise<BootstrapResponse> {
  return request<BootstrapResponse>("/api/bootstrap");
}

/** GET /api/tasks：工作台列表。view ∈ today | week | todo。 */
export function getWorkbench(
  role: string,
  view: string,
): Promise<WorkbenchResponse> {
  return request<WorkbenchResponse>("/api/tasks", { params: { role, view } });
}

export function getTask(taskId: string, role: string): Promise<TaskDetail> {
  return request<TaskDetail>(`/api/tasks/${encodeURIComponent(taskId)}`, { params: { role } });
}

export function createTask(payload: {
  actor_id: string;
  title: string;
  description: string;
  plan_date: string;
  due_at: string;
  executor_id: string;
  reviewer_id: string;
}): Promise<Task> {
  return request<Task>("/api/tasks", { method: "POST", body: payload });
}

export function applyTaskAction(payload: {
  task_id: string;
  actor_id: string;
  action: string;
  note: string;
  version: number;
}): Promise<Task> {
  return request<Task>(`/api/tasks/${encodeURIComponent(payload.task_id)}/action`, {
    method: "POST",
    body: {
      actor_id: payload.actor_id,
      action: payload.action,
      note: payload.note,
      version: payload.version,
    },
  });
}

export function getNotifications(role: string): Promise<NotificationsResponse> {
  return request<NotificationsResponse>("/api/notifications", { params: { role } });
}

export function markNotificationRead(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: "POST" });
}

export function getBoard(role: string, filter?: string): Promise<BoardResponse> {
  return request<BoardResponse>("/api/board", { params: { role, filter } });
}

export function getReport(role: string, scope: string, weekStart: string): Promise<ReportGetResponse> {
  return request<ReportGetResponse>("/api/report", { params: { role, scope, week_start: weekStart } });
}

export function generateReport(role: string, scope: string, weekStart: string): Promise<ReportResponse> {
  return request<ReportResponse>("/api/report/generate", {
    method: "POST",
    body: { role, scope, week_start: weekStart },
  });
}

export function saveReport(payload: {
  role: string;
  scope: string;
  week_start: string;
  content: string;
  method: string;
  data_cutoff: string;
}): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/report/save", { method: "POST", body: payload });
}

export function diagnose(role: string): Promise<DiagnosisResponse> {
  return request<DiagnosisResponse>("/api/diagnose", { method: "POST", body: { role } });
}

export function summarizeTask(taskId: string, role: string): Promise<AiTextResponse> {
  return request<AiTextResponse>("/api/summary", { method: "POST", body: { task_id: taskId, role } });
}

export function draftText(kind: string, context: Record<string, unknown>): Promise<AiTextResponse> {
  return request<AiTextResponse>("/api/draft", { method: "POST", body: { kind, context } });
}

export function askBoard(question: string, role: string): Promise<AiTextResponse> {
  return request<AiTextResponse>("/api/qa", { method: "POST", body: { question, role } });
}

export type { Task };
