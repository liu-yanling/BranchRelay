/** 身份（模拟身份切换，无真实登录，见决策 D5）。
 *  身份 ID 与后端 users 表一致；切换身份只影响前端传给后端的 role 查询参数，
 *  权限校验仍由后端按 role 判定（前端隐藏按钮不等于权限控制）。 */

export type RoleId = "u_zh" | "u_retail" | "u_ops" | "u_mgr";

export const DEFAULT_ROLE: RoleId = "u_retail";

export const ROLE_ORDER: RoleId[] = ["u_zh", "u_retail", "u_ops", "u_mgr"];

/** 后端未返回用户列表时的兜底（正常应来自 GET /api/bootstrap）。 */
export const ROLE_FALLBACK: { id: RoleId; name: string; post: string; is_manager: boolean }[] = [
  { id: "u_zh", name: "综合岗", post: "综合岗", is_manager: false },
  { id: "u_retail", name: "零售岗", post: "零售岗", is_manager: false },
  { id: "u_ops", name: "运营岗", post: "运营岗", is_manager: false },
  { id: "u_mgr", name: "支行负责人", post: "支行负责人", is_manager: true },
];

const ROLE_NAME: Record<RoleId, string> = {
  u_zh: "综合岗",
  u_retail: "零售岗",
  u_ops: "运营岗",
  u_mgr: "支行负责人",
};

export function roleName(id: string): string {
  return ROLE_NAME[id as RoleId] ?? id;
}
