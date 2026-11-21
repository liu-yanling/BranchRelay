#!/usr/bin/env bash
# 一条命令起服务；--reset 先重置演示数据再启动。
set -e
cd "$(dirname "$0")"

PY=python3.12
for c in python3.12 python3.11 python3.10 python3; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done
if [ -x ".venv/bin/python" ]; then
  PY=".venv/bin/python"
elif [ ! -d ".venv" ]; then
  echo "首次运行：创建虚拟环境并安装依赖..."
  python3.12 -m venv .venv || python3 -m venv .venv
  "$PY" -m pip install -q -r requirements.txt -r requirements-dev.txt
fi

if [ "$1" = "--reset" ]; then
  "$PY" - <<'EOF'
from app.services import repository
repository.reset_db()
print("演示数据已重置")
EOF
fi

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "已从 .env.example 生成 .env，请填入模型密钥（无密钥则 AI 能力走规则汇总）"
fi

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

PORT="${PORT:-8000}"
echo "BranchRelay 启动中：http://127.0.0.1:${PORT}"
"$PY" -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT"
