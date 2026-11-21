/* BranchRelay 前端单页应用 */
const S = {
  role: localStorage.getItem("br_role") || "u_mgr",
  tab: "workbench",
  view: "today",
  boardFilter: null,
  users: [],
  demoTime: null,
  report: null,
  reportWeek: null,
  reportScope: "personal",
  summaryCache: {},
  qaDraft: "",
  diagHtml: "",
  qaHtml: "",
};

const $ = (sel) => document.querySelector(sel);

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch (e) {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.hidden = true), ms);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function isManager() {
  const u = S.users.find((x) => x.id === S.role);
  return !!u && !!u.is_manager;
}

function userName(id) {
  const u = S.users.find((x) => x.id === id);
  return u ? u.name : (id || "—");
}

function statusTag(status) {
  return `<span class="tag status-${esc(status)}">${esc(status)}</span>`;
}

function dueTags(t) {
  let s = "";
  if (t.is_overdue) s += `<span class="tag overdue">已逾期</span> `;
  else if (t.due_state === "due_soon") s += `<span class="tag due_soon">即将到期</span> `;
  return s;
}

function fmtDue(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d)) return esc(s);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------- 引导 ---------- */

async function bootstrap() {
  const data = await api("/api/bootstrap");
  S.users = data.users;
  S.demoTime = data.demo_time;
  $("#demoTime").textContent = fmtDue(data.demo_time);
  const mb = $("#modelBadge");
  if (data.model_available) { mb.textContent = "模型：已配置"; mb.className = "model-badge ok"; }
  else { mb.textContent = "模型：未配置（走规则汇总）"; mb.className = "model-badge fail"; }
  renderRoleSelect();
  if (!S.users.some((u) => u.id === S.role)) S.role = S.users[0]?.id || "u_mgr";
  applyTabs();
  await refreshNotifications();
  render();
}

function renderRoleSelect() {
  const sel = $("#roleSelect");
  sel.innerHTML = S.users.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join("");
  sel.value = S.role;
  sel.onchange = () => {
    S.role = sel.value;
    localStorage.setItem("br_role", S.role);
    S.summaryCache = {};
    S.boardFilter = null;
    S.report = null;
    S.diagHtml = "";
    S.qaHtml = "";
    render();
    refreshNotifications();
  };
}

function applyTabs() {
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === S.tab);
  });
  const boardTab = document.querySelector('[data-tab="board"]');
  if (boardTab) boardTab.style.display = isManager() ? "" : "none";
}

/* ---------- 渲染 ---------- */

function render() {
  applyTabs();
  const main = $("#main");
  if (S.tab === "workbench") renderWorkbench(main);
  else if (S.tab === "board") renderBoard(main);
  else if (S.tab === "notifications") renderNotifications(main);
  else if (S.tab === "report") renderReport(main);
}

async function renderWorkbench(main) {
  const canCreate = S.users.find((u) => u.id === S.role)?.post === "综合岗";
  main.innerHTML = `
    <div class="toolbar">
      <div class="subtabs">
        <button class="subtab ${S.view === "today" ? "active" : ""}" data-view="today">今日</button>
        <button class="subtab ${S.view === "week" ? "active" : ""}" data-view="week">本周</button>
        <button class="subtab ${S.view === "todo" ? "active" : ""}" data-view="todo">我的待办</button>
      </div>
      <div style="flex:1"></div>
      ${canCreate ? '<button class="btn primary" id="createBtn">安排任务</button>' : ""}
    </div>
    <div class="list" id="taskList">加载中…</div>`;
  main.querySelectorAll(".subtab").forEach((b) => {
    b.onclick = () => { S.view = b.dataset.view; renderWorkbench(main); };
  });
  const cbtn = main.querySelector("#createBtn");
  if (cbtn) cbtn.onclick = openCreate;

  let tasks;
  try {
    const data = await api(`/api/tasks?view=${S.view}&role=${S.role}`);
    tasks = data.tasks;
  } catch (e) {
    main.querySelector("#taskList").innerHTML =
      `<div class="empty">读取失败：${esc(e.message)}<br/><button class="btn small" onclick="render()">重试</button></div>`;
    return;
  }
  const list = main.querySelector("#taskList");
  if (!tasks.length) {
    const emptyMsg = S.view === "today" ? "今日没有到期或逾期的待办" : "暂无任务";
    list.innerHTML = `<div class="empty">${emptyMsg}<br/><button class="btn small" data-goto="week">查看本周</button></div>`;
    const g = list.querySelector('[data-goto="week"]');
    if (g) g.onclick = () => { S.view = "week"; renderWorkbench(main); };
    return;
  }
  list.innerHTML = tasks.map((t) => {
    const summary = S.summaryCache[t.id] || "";
    return `
    <div class="task-row" data-id="${esc(t.id)}">
      <div class="main-col">
        <div class="title">${esc(t.title)} <span class="chip">${esc(t.id)}</span></div>
        <div class="meta">${statusTag(t.status)} ${dueTags(t)} 截止 ${fmtDue(t.due_at)} · 当前处理人 ${esc(userName(t.current_owner_id))}${summary ? `<br/><span class="summary-line">${esc(summary)}</span>` : ""}</div>
      </div>
      <div class="right">${nextAction(t)}</div>
    </div>`;
  }).join("");
  list.querySelectorAll(".task-row").forEach((row) => {
    row.onclick = () => openTask(row.dataset.id);
  });
  // 懒加载摘要（缓存，轮询不重复拉取）
  tasks.forEach((t) => {
    if (S.summaryCache[t.id] === undefined) {
      api("/api/summary", { method: "POST", body: { task_id: t.id, role: S.role } })
        .then((r) => {
          if (r.summary) {
            S.summaryCache[t.id] = r.summary;
            const row = list.querySelector(`[data-id="${t.id}"] .summary-line`);
            if (!row) { const meta = list.querySelector(`[data-id="${t.id}"] .meta`); if (meta) meta.insertAdjacentHTML("beforeend", `<br/><span class="summary-line">${esc(r.summary)}</span>`); }
          } else S.summaryCache[t.id] = "";
        })
        .catch(() => { S.summaryCache[t.id] = ""; });
    }
  });
}

function nextAction(t) {
  if (t.current_owner_id !== S.role) return `<span class="tag status-已完成" style="opacity:.6">等待他人</span>`;
  const map = { "待办理": "可开始", "办理中": "可更新/提交", "待复核": "待复核", "待补充": "待补充", "已完成": "已结束" };
  return `<span class="tag status-${esc(t.status)}">${map[t.status] || t.status}</span>`;
}

/* ---------- 看板 ---------- */

async function renderBoard(main) {
  main.innerHTML = `<div class="panel">加载中…</div>`;
  if (!isManager()) {
    main.innerHTML = `<div class="empty">支行看板仅对负责人开放</div>`;
    return;
  }
  let data;
  try {
    data = await api(`/api/board?role=${S.role}${S.boardFilter ? `&filter=${S.boardFilter}` : ""}`);
  } catch (e) {
    main.innerHTML = `<div class="empty">读取失败：${esc(e.message)}<br/><button class="btn small" onclick="render()">重试</button></div>`;
    return;
  }
  const st = data.stats;
  main.innerHTML = `
    <div class="cards">
      <div class="stat-card ${!S.boardFilter ? "active" : ""}" data-f=""> <div class="num">${st.total}</div><div class="label">本周任务</div></div>
      <div class="stat-card completed ${S.boardFilter === "completed" ? "active" : ""}" data-f="completed"> <div class="num">${st.completed}</div><div class="label">已完成</div></div>
      <div class="stat-card pending_review ${S.boardFilter === "pending_review" ? "active" : ""}" data-f="pending_review"> <div class="num">${st.pending_review}</div><div class="label">待复核</div></div>
      <div class="stat-card overdue ${S.boardFilter === "overdue" ? "active" : ""}" data-f="overdue"> <div class="num">${st.overdue}</div><div class="label">逾期</div></div>
    </div>
    <div class="panel">
      <div class="toolbar" style="margin-bottom:8px">
        <h3 style="margin:0">任务列表 ${S.boardFilter ? `<span class="chip">${esc({completed:"已完成",pending_review:"待复核",overdue:"逾期"}[S.boardFilter]||"")}</span>` : ""}</h3>
        <div style="flex:1"></div>
        <button class="btn" id="diagBtn">一键诊断</button>
      </div>
      <div class="list" id="boardList"></div>
      <div id="diagBox" style="margin-top:14px"></div>
      <div class="panel" style="margin-top:14px;background:#f8fafc">
        <h3>问进度（自然语言）</h3>
        <div class="qa-row">
          <input id="qaInput" placeholder="例如：这周谁逾期最多？哪些任务卡在复核？" value="${esc(S.qaDraft)}" />
          <button class="btn primary" id="qaBtn">提问</button>
        </div>
        <div id="qaBox" style="margin-top:10px"></div>
      </div>
    </div>`;
  main.querySelectorAll(".stat-card").forEach((c) => {
    c.onclick = () => { S.boardFilter = c.dataset.f || null; renderBoard(main); };
  });
  const bl = main.querySelector("#boardList");
  bl.innerHTML = data.tasks.length ? data.tasks.map((t) => `
    <div class="task-row" data-id="${esc(t.id)}">
      <div class="main-col">
        <div class="title">${esc(t.title)} <span class="chip">${esc(t.id)}</span></div>
        <div class="meta">${statusTag(t.status)} ${dueTags(t)} 截止 ${fmtDue(t.due_at)} · 当前处理人 ${esc(userName(t.current_owner_id))}
        ${t.status === "待复核" && t.submit_note ? `<br/>提交说明：${esc(t.submit_note)}` : ""}
        ${t.status === "待复核" && t.wait_since ? `<br/>等待自 ${fmtDue(t.wait_since)}` : ""}</div>
      </div>
    </div>`).join("") : `<div class="empty">暂无符合条件的任务</div>`;
  bl.querySelectorAll(".task-row").forEach((row) => { row.onclick = () => openTask(row.dataset.id); });

  main.querySelector("#diagBtn").onclick = async () => {
    const box = main.querySelector("#diagBox");
    box.innerHTML = `<div class="empty">诊断中…</div>`;
    try {
      const r = await api("/api/diagnose", { method: "POST", body: { role: S.role } });
      const badge = `<span class="method-badge ${r.method}">${r.method === "model" ? "模型生成" : "规则汇总"}</span>`;
      if (!r.risks.length) box.innerHTML = `<h3>进度诊断 ${badge}</h3><div class="empty">未发现风险点</div>`;
      else box.innerHTML = `<h3>进度诊断 ${badge}</h3>` + r.risks.map((x) => `
        <div class="advice-box">
          <b><span class="chip ref-chip" data-id="${esc(x.task_id)}">${esc(x.task_id)}</span></b> ${esc(x.status)} · 跟进人 ${esc(x.owner)}<br/>
          ${esc(x.advice)}
        </div>`).join("");
      attachRefChips(box);
      S.diagHtml = box.innerHTML;
    } catch (e) { box.innerHTML = `<div class="empty">诊断失败：${esc(e.message)}<br/><button class="btn small" id="diagRetry">重试</button></div>`; box.querySelector("#diagRetry").onclick = main.querySelector("#diagBtn").onclick; }
  };

  main.querySelector("#qaBtn").onclick = async () => {
    const q = main.querySelector("#qaInput").value.trim();
    if (!q) return;
    const box = main.querySelector("#qaBox");
    box.innerHTML = `<div class="empty">查询中…</div>`;
    try {
      const r = await api("/api/qa", { method: "POST", body: { role: S.role, question: q } });
      const badge = `<span class="method-badge ${r.method}">${r.method === "model" ? "模型生成" : "规则汇总"}</span>`;
      box.innerHTML = `<div>${badge} ${esc(r.answer)}</div>
        ${(r.refs || []).map((id) => `<span class="chip ref-chip" data-id="${esc(id)}">${esc(id)}</span>`).join("")}`;
      attachRefChips(box);
      S.qaHtml = box.innerHTML;
    } catch (e) { box.innerHTML = `<div class="empty">查询失败：${esc(e.message)}</div>`; }
  };
  main.querySelector("#qaInput").oninput = (e) => { S.qaDraft = e.target.value; };
  if (S.diagHtml) { main.querySelector("#diagBox").innerHTML = S.diagHtml; attachRefChips(main.querySelector("#diagBox")); }
  if (S.qaHtml) { main.querySelector("#qaBox").innerHTML = S.qaHtml; attachRefChips(main.querySelector("#qaBox")); }
}

function attachRefChips(container) {
  container.querySelectorAll(".ref-chip").forEach((c) => { c.onclick = () => openTask(c.dataset.id); });
}

/* ---------- 通知 ---------- */

async function refreshNotifications() {
  try {
    const data = await api(`/api/notifications?role=${S.role}`);
    const pill = $("#unreadPill");
    if (data.unread > 0) { pill.textContent = data.unread; pill.hidden = false; }
    else pill.hidden = true;
    return data;
  } catch (e) { return null; }
}

async function renderNotifications(main) {
  main.innerHTML = `<div class="panel">加载中…</div>`;
  const data = await refreshNotifications();
  if (!data) { main.innerHTML = `<div class="empty">读取失败，请重试</div>`; return; }
  const items = data.notifications;
  main.innerHTML = `
    <div class="panel">
      <h3>站内消息 <span style="color:var(--muted);font-size:12px">未读 ${data.unread} 条</span></h3>
      <div class="list">
        ${items.length ? items.map((n) => `
          <div class="task-row ${n.read_at ? "" : "unread"}" data-nid="${n.id}" data-task="${esc(n.task_id)}" style="${n.read_at ? "opacity:.65" : ""}">
            <div class="main-col">
              <div class="title">${esc(n.message)} ${!n.read_at ? '<span class="tag overdue" style="background:var(--brand)">未读</span>' : ""}</div>
              <div class="meta">${esc(n.task_title)}（${esc(n.task_id)}）· ${fmtDue(n.created_at)}</div>
            </div>
          </div>`).join("") : `<div class="empty">暂无消息</div>`}
      </div>
    </div>`;
  main.querySelectorAll(".task-row").forEach((row) => {
    row.onclick = async () => {
      const nid = row.dataset.nid;
      await api(`/api/notifications/${nid}/read`, { method: "POST" });
      openTask(row.dataset.task);
    };
  });
}

/* ---------- AI 周报 ---------- */

function weekOptions() {
  // 从演示时间推导本周一，向前给 4 周
  const dstr = (S.demoTime || "").slice(0, 10);
  const [y, m, d] = dstr.split("-").map(Number);
  const base = new Date(y, m - 1, d, 12);
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  const opts = [];
  for (let i = 0; i < 5; i++) {
    const w = new Date(monday);
    w.setDate(monday.getDate() - i * 7);
    const p = (n) => String(n).padStart(2, "0");
    opts.push(`${w.getFullYear()}-${p(w.getMonth() + 1)}-${p(w.getDate())}`);
  }
  return opts;
}

function fmtDay(s) {
  return (s || "").slice(0, 10);
}

async function renderReport(main) {
  if (!S.reportWeek) {
    const w = weekOptions();
    S.reportWeek = w[0];
    if (isManager()) S.reportScope = "branch";
  }
  const weeks = weekOptions();
  const scopeBranch = isManager();
  main.innerHTML = `
    <div class="toolbar">
      <label class="field" style="margin:0">范围
        <select id="reportScope">
          <option value="personal" ${S.reportScope === "personal" ? "selected" : ""}>个人</option>
          ${scopeBranch ? `<option value="branch" ${S.reportScope === "branch" ? "selected" : ""}>支行（负责人）</option>` : ""}
        </select>
      </label>
      <label class="field" style="margin:0">报告周
        <select id="reportWeek">
          ${weeks.map((w, i) => `<option value="${w}" ${w === S.reportWeek ? "selected" : ""}>${i === 0 ? "本周" : i + " 周前"}（${fmtDay(w)} 起）</option>`).join("")}
        </select>
      </label>
      <button class="btn primary" id="genReport">生成周报</button>
      <button class="btn" id="saveReport">保存草稿</button>
      <span id="reportMeta" style="color:var(--muted);font-size:12px"></span>
    </div>
    <div id="reportBody"><div class="empty">选择范围与报告周后点击「生成周报」</div></div>`;

  main.querySelector("#reportScope").onchange = (e) => { S.reportScope = e.target.value; S.report = null; renderReport(main); };
  main.querySelector("#reportWeek").onchange = (e) => { S.reportWeek = e.target.value; S.report = null; renderReport(main); };
  main.querySelector("#genReport").onclick = () => generateReport(main);
  main.querySelector("#saveReport").onclick = () => saveReport(main);

  if (S.report) drawReport(main);
}

async function generateReport(main) {
  const btn = main.querySelector("#genReport");
  btn.disabled = true;
  btn.textContent = "生成中…";
  try {
    S.report = await api("/api/report/generate", {
      method: "POST",
      body: { role: S.role, scope: S.reportScope, week_start: S.reportWeek },
    });
    drawReport(main);
  } catch (e) {
    toast("生成失败：" + e.message);
    main.querySelector("#reportBody").innerHTML = `<div class="empty">生成失败：${esc(e.message)}<br/><button class="btn small" onclick="render()">重试</button></div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "生成周报";
  }
}

function drawReport(main) {
  const r = S.report;
  const badge = `<span class="method-badge ${r.method}">${r.method === "model" ? "模型生成" : "规则汇总"}</span>`;
  main.querySelector("#reportMeta").innerHTML = `${badge} 数据截止 ${fmtDue(r.data_cutoff)}`;
  if (r.empty) {
    main.querySelector("#reportBody").innerHTML = `<div class="empty">所选范围无记录，未调用模型</div>`;
    return;
  }
  const group = (title, items, key) => `
    <div class="report-group">
      <h4>${title}（${items.length}）</h4>
      ${items.length ? items.map((it, i) => `
        <div class="report-item">
          <span class="chip ref-chip" data-id="${esc(it.task_id)}">${esc(it.task_id)}</span>
          <textarea data-key="${key}" data-i="${i}">${esc(it.text)}</textarea>
        </div>`).join("") : `<div class="empty" style="padding:8px">暂无已登记安排</div>`}
    </div>`;
  main.querySelector("#reportBody").innerHTML =
    group("本周完成", r.completed, "completed") +
    group("待推进", r.pending, "pending") +
    group("下周安排", r.next_week, "next_week");
  main.querySelectorAll(".ref-chip").forEach((c) => c.onclick = () => openTask(c.dataset.id));
}

async function saveReport(main) {
  if (!S.report) return;
  const collect = (key) => {
    const arr = S.report[key] || [];
    return arr.map((it, i) => {
      const ta = main.querySelector(`textarea[data-key="${key}"][data-i="${i}"]`);
      return { task_id: it.task_id, text: ta ? ta.value : it.text };
    });
  };
  const content = JSON.stringify({
    completed: collect("completed"),
    pending: collect("pending"),
    next_week: collect("next_week"),
  });
  try {
    await api("/api/report/save", {
      method: "POST",
      body: { role: S.role, scope: S.reportScope, week_start: S.reportWeek, content, method: S.report.method, data_cutoff: S.report.data_cutoff },
    });
    toast("草稿已保存");
  } catch (e) { toast("保存失败：" + e.message); }
}

/* ---------- 任务详情 ---------- */

async function openTask(id) {
  const modal = $("#taskModal");
  modal.hidden = false;
  const body = $("#taskModalBody");
  body.innerHTML = `<div class="empty">加载中…</div>`;
  let t;
  try {
    t = await api(`/api/tasks/${id}?role=${S.role}`);
  } catch (e) {
    body.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    return;
  }
  $("#taskModalTitle").textContent = `${t.title}（${t.id}）`;
  body.innerHTML = `
    <div class="panel" style="margin-top:0">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${statusTag(t.status)} ${dueTags(t)}
        <span class="tag status-办理中">当前处理人 ${esc(t.owner_name || "—")}</span>
      </div>
      <p style="color:var(--muted)">${esc(t.description)}</p>
      <div class="meta">发起人 ${esc(t.creator_name)} · 经办人 ${esc(t.executor_name)} · 复核人 ${esc(t.reviewer_name)}</div>
      <div class="meta">计划日 ${fmtDay(t.plan_date)} · 截止 ${fmtDue(t.due_at)}${t.completed_at ? ` · 完成于 ${fmtDue(t.completed_at)}` : ""}</div>
      <div id="summaryLine" class="meta" style="margin-top:6px"></div>
      <div id="actionArea" style="margin-top:12px"></div>
    </div>
    <div class="panel">
      <h3>流转记录</h3>
      <ul class="timeline">
        ${t.events.map((e) => `
          <li>
            <div class="t-time">${fmtDue(e.created_at)} · ${esc(e.actor_name)} · ${esc(e.action_label)}</div>
            ${e.note ? `<div class="t-note">${esc(e.note)}</div>` : ""}
          </li>`).join("")}
      </ul>
    </div>`;

  // 摘要
  api("/api/summary", { method: "POST", body: { task_id: id, role: S.role } }).then((r) => {
    if (r.summary) { S.summaryCache[id] = r.summary; const el = $("#summaryLine"); if (el) el.innerHTML = `进展摘要：${esc(r.summary)}`; }
  }).catch(() => {});

  // 操作区
  renderActions(t);

  // 编辑摘要后返回列表时保留筛选
  modal.querySelector(".close").onclick = () => closeTask();
}

function closeTask() {
  $("#taskModal").hidden = true;
  render();
}

function renderActions(t) {
  const area = $("#actionArea");
  if (!area) return;
  const me = S.role;
  if (t.current_owner_id !== me) {
    area.innerHTML = `<div class="meta">该任务当前由 ${esc(t.owner_name || "—")} 处理</div>`;
    return;
  }
  const s = t.status;
  const version = t.version;
  const can = (act) => (act === "start" && s === "待办理" && me === t.executor_id)
    || (["update_progress", "submit_review"].includes(act) && ["办理中", "待补充"].includes(s) && me === t.executor_id)
    || (["approve", "reject"].includes(act) && s === "待复核" && me === t.reviewer_id);

  let html = "";
  if (can("start")) html += `<button class="btn primary" data-act="start">开始办理</button> `;
  if (can("update_progress") || can("submit_review")) {
    html += `<button class="btn" data-act="update_progress">更新进展</button> `;
    html += `<button class="btn primary" data-act="submit_review">提交复核</button>`;
  }
  if (can("approve") || can("reject")) {
    if (t.submit_note) html += `<div class="meta" style="margin:8px 0">提交说明：${esc(t.submit_note)}</div>`;
    html += `<button class="btn primary" data-act="approve">复核通过</button> `;
    html += `<button class="btn danger" data-act="reject">退回补充</button>`;
  }
  if (s === "待补充" && t.reject_reason) {
    html += `<div class="advice-box" style="margin-top:10px"><b>退回意见：</b>${esc(t.reject_reason)}</div>`;
  }
  html += `<div id="noteArea" style="margin-top:12px"></div>`;
  area.innerHTML = html || `<div class="meta">当前状态无可用操作</div>`;

  area.querySelectorAll("button[data-act]").forEach((b) => {
    b.onclick = () => showActionForm(t, b.dataset.act);
  });
}

function showActionForm(t, act) {
  const area = $("#noteArea");
  const needNote = act === "submit_review" || act === "reject";
  const label = { start: "开始办理", update_progress: "更新进展（可留空）", submit_review: "交付说明（必填）", reject: "退回原因（必填）", approve: "复核意见（可留空）" }[act];
  area.innerHTML = `
    <div class="field">
      <label>${label}</label>
      ${needNote || act !== "start" ? `<textarea id="actionNote" placeholder="${needNote ? "请填写" : "可选"}">${act === "submit_review" ? "初稿已整理，请核对活动时间。" : ""}</textarea>` : ""}
      ${act === "reject" ? `<button class="btn small" id="draftReject">AI 起草退回意见</button>` : ""}
      <div class="hint" id="actionHint"></div>
    </div>
    <button class="btn primary" id="doAction">确认</button>
    <button class="btn" id="cancelAction">取消</button>`;
  area.querySelector("#cancelAction").onclick = () => renderActions(t);
  const draftBtn = area.querySelector("#draftReject");
  if (draftBtn) draftBtn.onclick = async () => {
    draftBtn.disabled = true;
    try {
      const r = await api("/api/draft", { method: "POST", body: { kind: "reject", context: { task_id: t.id, title: t.title, submit_note: t.submit_note || "" } } });
      if (r.text) area.querySelector("#actionNote").value = r.text;
      else toast("模型不可用，请手写退回意见");
    } catch (e) { toast("起草失败：" + e.message); }
    draftBtn.disabled = false;
  };
  area.querySelector("#doAction").onclick = async () => {
    const note = area.querySelector("#actionNote") ? area.querySelector("#actionNote").value : "";
    const hint = area.querySelector("#actionHint");
    if (needNote && !note.trim()) { hint.textContent = "此项为必填"; return; }
    const btn = area.querySelector("#doAction");
    btn.disabled = true;
    try {
      await api(`/api/tasks/${t.id}/action`, { method: "POST", body: { actor_id: S.role, action: act, note, version: t.version } });
      S.summaryCache = {};
      toast("操作成功");
      openTask(t.id);
    } catch (e) {
      hint.textContent = e.message;
      btn.disabled = false;
      if (e.status === 409 || e.status === 403) {
        toast(e.message);
        setTimeout(() => openTask(t.id), 700);
      }
    }
  };
}

/* ---------- 安排任务 ---------- */

function openCreate() {
  const modal = $("#createModal");
  modal.hidden = false;
  const staff = S.users.filter((u) => !u.is_manager);
  const opts = staff.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join("");
  $("#createModalBody").innerHTML = `
    <div class="field"><label>任务标题 *</label><input id="cTitle" placeholder="例如：准备金融知识宣传初稿" /></div>
    <div class="field">
      <label>工作说明</label>
      <textarea id="cDesc" placeholder="说明目标、交付物与时间要求"></textarea>
      <button class="btn small" id="draftDesc" style="margin-top:6px">AI 起草</button>
    </div>
    <div class="row2">
      <div class="field"><label>计划日 *</label><input id="cPlan" type="date" /></div>
      <div class="field"><label>截止时间 *</label><input id="cDue" type="datetime-local" /></div>
    </div>
    <div class="row2">
      <div class="field"><label>经办人 *</label><select id="cExecutor">${opts}</select></div>
      <div class="field"><label>复核人 *</label><select id="cReviewer">${opts}</select></div>
    </div>
    <div class="hint" id="cHint"></div>
    <button class="btn primary" id="cSubmit">创建任务</button>
    <button class="btn" data-close="createModal">取消</button>`;
  modal.querySelector("[data-close='createModal']").onclick = () => (modal.hidden = true);
  modal.querySelector(".close").onclick = () => (modal.hidden = true);
  modal.querySelector("#draftDesc").onclick = async () => {
    const btn = modal.querySelector("#draftDesc");
    btn.disabled = true;
    const title = modal.querySelector("#cTitle").value;
    try {
      const r = await api("/api/draft", { method: "POST", body: { kind: "description", context: { title } } });
      if (r.text) modal.querySelector("#cDesc").value = r.text;
      else toast("模型不可用，请手写说明");
    } catch (e) { toast("起草失败：" + e.message); }
    btn.disabled = false;
  };
  modal.querySelector("#cSubmit").onclick = async () => {
    const hint = modal.querySelector("#cHint");
    const payload = {
      actor_id: S.role,
      title: modal.querySelector("#cTitle").value,
      description: modal.querySelector("#cDesc").value,
      plan_date: modal.querySelector("#cPlan").value,
      due_at: modal.querySelector("#cDue").value,
      executor_id: modal.querySelector("#cExecutor").value,
      reviewer_id: modal.querySelector("#cReviewer").value,
    };
    if (!payload.title || !payload.plan_date || !payload.due_at || !payload.executor_id || !payload.reviewer_id) {
      hint.textContent = "标题、计划日、截止时间、经办人、复核人为必填";
      return;
    }
    if (payload.executor_id === payload.reviewer_id) { hint.textContent = "经办人与复核人不能为同一人"; return; }
    try {
      const t = await api("/api/tasks", { method: "POST", body: payload });
      modal.hidden = true;
      S.summaryCache = {};
      toast("任务已创建");
      openTask(t.id);
    } catch (e) { hint.textContent = e.message; }
  };
}

/* ---------- 全局事件与轮询 ---------- */

document.querySelector("#tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  S.tab = btn.dataset.tab;
  render();
});

document.querySelectorAll(".modal-backdrop").forEach((m) => {
  m.addEventListener("click", (e) => {
    if (e.target === m) m.hidden = true;
  });
});

let _polling = false;
setInterval(() => {
  if (_polling) return;
  const modalOpen = !$("#taskModal").hidden || !$("#createModal").hidden;
  if (modalOpen) return;
  _polling = true;
  const refresh = S.tab === "notifications" ? refreshNotifications() : api(`/api/notifications/refresh?role=${S.role}`).catch(() => {});
  refresh.finally(() => {
    // 周报在编辑时不做轮询重绘，避免覆盖草稿文字
    if (S.tab !== "report") render();
    _polling = false;
  });
}, 3000);

bootstrap().catch((e) => {
  $("#main").innerHTML = `<div class="empty">初始化失败：${esc(e.message)}</div>`;
});
