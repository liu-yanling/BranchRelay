# BranchRelay · 智能办公与协同管理平台（Demo）

上海银行北京中关村支行「智能办公与协同管理平台」比赛 Demo。
后端：FastAPI 分层实现任务状态机 + 权限/版本校验 + 工作台/通知/看板 + AI 能力矩阵（周报/诊断/摘要/起草/问答）。
前端：Next.js（App Router）+ TypeScript strict + Tailwind CSS，参考 `docs/DESIGN.md` 的紫黑色界面与橙红渐变操作按钮。

> 页面与数据均为比赛模拟数据，岗位、任务、流程皆为虚构。
> 旧 `agent-blueprint-engine/out/BranchRelay/skeleton/` 原样保留为比赛交付物，本目录是其框架化重构。

## 快速启动（前后端一起）

先起后端（8000），可按 `backend/.env.example` 配置模型，未配置时使用规则降级：

```bash
cd backend
./run.sh                 # 首次自动建 .venv、装依赖；按需配置 backend/.env 模型参数
```

再起前端（3000）：

```bash
cd ../frontend
cp .env.example .env.local   # 首次：.env.local 已默认指向 http://127.0.0.1:8000，通常无需改
npm install
npm run dev                 # 打开 http://localhost:3000
```

浏览器打开 `http://localhost:3000`，通过右上角切换综合岗、零售岗、运营岗和支行负责人。综合岗可安排任务，经办人与复核人按任务分工流转，负责人可访问支行看板和支行范围周报。工作台、任务详情、站内通知、支行看板及 AI 周报均已接入后端。前端通过 `proxy.ts` 将 `/api/*` 转发到后端 8000。演示日期固定为 2026 年 11 月 20 日，周报使用 11 月 16 日所在周。

重置演示数据（回到 2026-11-20 10:00 快照）：

```bash
# 运行中的后端：curl -X POST http://127.0.0.1:8000/api/reset
# 或：cd backend && ./run.sh --reset
```

## 环境变量

后端 `backend/.env`（密钥不提交）：

| 变量 | 说明 |
| --- | --- |
| `MODEL_API_BASE` / `MODEL_NAME` / `MODEL_API_KEY` | 官方模型接口（OpenAI 兼容 chat/completions） |
| `MODEL_TIMEOUT` / `MODEL_MAX_RETRIES` | 超时秒数与网络错误额外重试次数 |
| `DEMO_TIME` | 演示时钟，默认 `2026-11-20T10:00:00+08:00` |
| `PORT` | 服务端口，默认 8000 |
| `DB_PATH` | SQLite 路径，默认 `../data/branchrelay.db` |

前端 `frontend/.env.local`（不进仓库，参考 `frontend/.env.example`）：

| 变量 | 说明 |
| --- | --- |
| `BACKEND_URL` | 后端地址，本地 `http://127.0.0.1:8000`；`proxy.ts` 每次请求时读取 |
| `PROXY_SHARED_SECRET` | 前后端共享密钥，本地演示可留空；上线时按部署手册配置 |

## 测试与验收

后端 mock 单测（离线）：

```bash
cd backend
MODEL_API_KEY="" .venv/bin/python -m pytest -q
```

前端检查（lint / typecheck / test / build）：

```bash
cd frontend
npm run lint
npm run typecheck
npm test           # vitest run
npm run build
```

## 目录结构

```text
backend/                 # FastAPI 后端（只提供 /api/*）
├── app/
│   ├── api/            # 路由（tasks / board / notifications / report / ai / system）
│   ├── core/           # 配置、时钟与连接、统一错误、状态常量
│   ├── models/         # SQLite 表结构（DDL）与演示数据
│   ├── schemas/        # Pydantic 输入与模型输出结构
│   ├── services/       # repository、domain、reporting、ai_client、ai_services
│   │   └── prompts/    # 5 份 Prompt 独立文件
│   └── main.py
├── static/             # 旧临时验收界面（阶段 3-1 起废弃入口，文件保留）
├── tests/              # pytest
└── .env / .env.example
frontend/               # Next.js 16 正式前端
├── app/                # 工作台、任务、通知、看板及 AI 周报页面
├── components/         # app-shell、identity-switch、task-card
├── lib/                # roles、task-status、role-context、api/client、proxy/forward
├── proxy.ts            # /api/* 运行时转发到 BACKEND_URL
├── scripts/            # browser-check.mjs（一次性浏览器检查/截图）
└── vitest 配置与测试
scripts/                # smoke.py（真实冒烟）、restart-check.sh（重启恢复钩子）
data/                   # SQLite 数据（gitignore）
docs/                   # PRD、技术适配声明、阶段文档、evidence
```

## 错误结构

统一为 `{"error": {"code": "...", "message": "..."}}`；不泄露堆栈。
模型不可用时，五项 AI 能力各自降级为规则汇总（标注来源），任务办理不受影响。
