/** 后端接口返回结构（与 backend/app/schemas 与 services 对齐）。
 *  关键外部数据在进入业务层前经运行时兜底，不信任后端一定返回了每个字段。 */

export interface User {
  id: string;
  name: string;
  post: string;
  is_manager: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  creator_id: string;
  executor_id: string;
  reviewer_id: string;
  current_owner_id: string | null;
  plan_date: string;
  due_at: string;
  status: string;
  version: number;
  submit_note: string | null;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  is_overdue?: boolean;
  is_today?: boolean;
  due_state?: "overdue" | "due_soon" | null;
}

export interface TaskEvent {
  id?: number;
  task_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  action_label: string;
  from_status: string | null;
  to_status: string | null;
  owner_after: string | null;
  note: string;
  created_at: string;
}

export interface TaskDetail extends Task {
  events: TaskEvent[];
  creator_name: string;
  executor_name: string;
  reviewer_name: string;
  owner_name: string;
}

export interface WorkbenchResponse {
  tasks: Task[];
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unread: number;
}

export interface NotificationItem {
  id: number;
  recipient_id: string;
  task_id: string;
  type: string;
  message: string;
  created_at: string;
  read_at: string | null;
  task_title: string;
}

export interface BoardResponse {
  stats: { total: number; completed: number; pending_review: number; overdue: number };
  tasks: Task[];
  week_start: string;
}

export interface ReportItem {
  task_id: string;
  text: string;
}

export interface ReportResponse {
  scope: string;
  week_start: string;
  week_end: string;
  data_cutoff: string;
  is_current_week: boolean;
  method: string;
  completed: ReportItem[];
  pending: ReportItem[];
  next_week: ReportItem[];
  empty: boolean;
}

export interface ReportDraft {
  owner_id: string;
  scope: string;
  week_start: string;
  data_cutoff: string;
  content: string;
  method: string;
  edited_at: string;
}

export interface ReportGetResponse {
  draft: ReportDraft | null;
  report: ReportResponse | null;
}

export interface DiagnosisRisk {
  task_id: string;
  type: string;
  status: string;
  owner: string;
  advice: string;
}

export interface DiagnosisResponse {
  risks: DiagnosisRisk[];
  method: string;
  data_cutoff: string;
}

export interface AiTextResponse {
  summary?: string;
  text?: string;
  answer?: string;
  refs?: string[];
  method: string;
}

export interface BootstrapResponse {
  users: User[];
  demo_time: string;
  model_available: boolean;
}

/** 后端统一错误体（AGENTS.md 第 2 节第 3 条）。 */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
