#!/usr/bin/env bash
# 重启恢复检查钩子（契约见通用手册第十节）。
#   start         用临时数据起一个服务实例，标准输出最后一行是 PID
#   write <标记>   通过产品自己的创建接口写入一条带标记的任务，输出任务 ID
#   read <ID>     读回该任务的标题（即标记原文）
#   stop          清理仍在跑的实例
# verify.sh 会自己 kill -9 进程并再次 start，本钩子只负责这四件事。
set -u

cd "$(dirname "$0")/../backend" || exit 1
PY=".venv/bin/python"
PORT=8023
DIR="${RESTART_CHECK_DIR:-/tmp/branchrelay-restart-check}"
mkdir -p "$DIR"
PIDFILE="$DIR/pid"

case "$1" in
  start)
    DB_PATH="$DIR/app.db" MODEL_API_KEY="" DEMO_TIME="2026-11-20T10:00:00+08:00" \
      nohup "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT" \
      > "$DIR/server.log" 2>&1 &
    PID=$!
    echo "$PID" > "$PIDFILE"
    for _ in $(seq 1 50); do
      if curl -s "http://127.0.0.1:$PORT/api/bootstrap" >/dev/null 2>&1; then
        echo "$PID"
        exit 0
      fi
      sleep 0.2
    done
    echo "端口 $PORT 未能就绪或已被占用" >&2
    exit 1
    ;;
  write)
    MARK="$2"
    RESP="$(curl -s -X POST "http://127.0.0.1:$PORT/api/tasks" \
      -H 'Content-Type: application/json' \
      -d "{\"actor_id\":\"u_zh\",\"title\":\"$MARK\",\"description\":\"\",\"plan_date\":\"2026-11-21\",\"due_at\":\"2026-11-21T17:00:00+08:00\",\"executor_id\":\"u_retail\",\"reviewer_id\":\"u_ops\"}")"
    echo "$RESP" | "$PY" -c "import sys,json; print(json.load(sys.stdin)['id'])"
    ;;
  read)
    ID="$2"
    curl -s "http://127.0.0.1:$PORT/api/tasks/$ID?role=u_mgr" \
      | "$PY" -c "import sys,json; print(json.load(sys.stdin)['title'])"
    ;;
  stop)
    if [ -f "$PIDFILE" ]; then
      P="$(cat "$PIDFILE" 2>/dev/null || true)"
      [ -n "$P" ] && kill "$P" 2>/dev/null || true
    fi
    ;;
  *)
    echo "未知子命令：$1（应为 start / write / read / stop）" >&2
    exit 1
    ;;
esac
