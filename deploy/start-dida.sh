#!/usr/bin/env bash
# 有终自托管服务 · 常驻启动器（无 systemd 容器环境）
#
#   ./scripts/start-dida.sh supervise   守护模式（崩溃自动重启 + 健康检查，推荐）
#   ./scripts/start-dida.sh ensure      没在跑就拉起守护进程（给开机自启/巡检用）
#   ./scripts/start-dida.sh start       nohup 后台启动一次（不守护）
#   ./scripts/start-dida.sh stop        停止
#   ./scripts/start-dida.sh restart     重启（停止 + 守护启动）
#   ./scripts/start-dida.sh restore     强制重启：杀掉守护与进程后重新守护（巡检用）
#   ./scripts/start-dida.sh status      查看状态
#   ./scripts/start-dida.sh logs        跟踪日志
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_HOME="${NODE_HOME:-/n3_storage/tools/node22}"
PIDFILE="$ROOT/.data/youzhong.pid"
SUPERVISOR_PIDFILE="$ROOT/.data/youzhong-supervisor.pid"
LOGFILE="$ROOT/.data/server.log"
LOCKFILE="$ROOT/.data/supervisor.lock"

# 健康检查地址：优先用 .env 里的 PORT / URL_PREFIX
PORT_NUM="$(grep -E '^PORT=' "$ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r')"
URL_PREFIX_VAL="$(grep -E '^URL_PREFIX=' "$ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r')"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT_NUM:-10078}${URL_PREFIX_VAL%/}/api/ping}"

mkdir -p "$ROOT/.data"

# Node 可执行文件：容器里用 /n3_storage/tools/node22，其它环境退回 PATH 里的 node
node_bin() {
  if [ -x "$NODE_HOME/bin/node" ]; then echo "$NODE_HOME/bin/node"; else command -v node; fi
}
node_dir() {
  if [ -x "$NODE_HOME/bin/node" ]; then echo "$NODE_HOME/bin"; else dirname "$(command -v node)"; fi
}

healthy() {
  curl -fsS -m 6 "$HEALTH_URL" > /dev/null 2>&1
}

rotate_log() {
  if [ -f "$LOGFILE" ] && [ "$(stat -c%s "$LOGFILE" 2>/dev/null || echo 0)" -gt 10485760 ]; then
    mv -f "$LOGFILE" "$LOGFILE.1" 2>/dev/null || true
  fi
}

# 启动服务端子进程：用 `node --import tsx` 单进程跑，避免 tsx CLI 再 fork 一层
# （多一层的话 kill 掉 CLI 会留下孤儿进程继续占着 10078，重启就变成 EADDRINUSE 死循环）
# setsid 让它成为进程组组长，停服/重启时可以用 kill -PID 把整组带走
start_child() {
  setsid bash -c "cd '$ROOT/apps/server' && exec env -u LD_LIBRARY_PATH PATH='$(node_dir):$PATH' NODE_ENV=production '$(node_bin)' --import tsx src/index.ts" \
    >> "$LOGFILE" 2>&1 9>&- &
  CHILD=$!
  echo "$CHILD" > "$PIDFILE"
}

# 杀掉子进程所在的整个进程组（先 TERM，等不到再 KILL）
kill_child_group() {
  local pid="$1" sig="${2:-TERM}"
  [ -z "$pid" ] && return 0
  kill "-$sig" "-$pid" 2>/dev/null || kill "-$sig" "$pid" 2>/dev/null || true
}

supervisor_running() {
  [ -f "$SUPERVISOR_PIDFILE" ] && kill -0 "$(cat "$SUPERVISOR_PIDFILE" 2>/dev/null)" 2>/dev/null
}

is_running() {
  [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null
}

cleanup() {
  echo "[youzhong] $(date '+%F %T') 收到停止信号，退出守护" >> "$LOGFILE"
  kill_child_group "${CHILD:-0}" TERM
  rm -f "$SUPERVISOR_PIDFILE" "$PIDFILE"
  exit 0
}

# 守护模式：子进程退出即重启；进程活着但 /api/ping 连续 3 次不通过也强制重启（防卡死）
supervise() {
  exec 9> "$LOCKFILE"
  if command -v flock > /dev/null 2>&1 && ! flock -n 9; then
    echo "[youzhong] 已有守护进程在运行，跳过"
    return 0
  fi
  echo $$ > "$SUPERVISOR_PIDFILE"
  trap cleanup TERM INT
  rotate_log
  echo "[youzhong] $(date '+%F %T') 守护进程启动（node=$(node_bin) $( "$(node_bin)" -v 2>/dev/null )，健康检查 $HEALTH_URL）" >> "$LOGFILE"
  local backoff=2 failures=0 started_at uptime_s code ticks
  while true; do
    started_at=$(date +%s)
    start_child
    failures=0
    ticks=0
    while kill -0 "$CHILD" 2>/dev/null; do
      sleep 5 9>&-
      kill -0 "$CHILD" 2>/dev/null || break
      ticks=$((ticks + 1))
      # 每 60s 顺带确认巡检进程还在（容器里没有 cron，靠互相看护兜底）
      if [ $((ticks % 12)) -eq 0 ] && [ -x /usr/local/bin/youzhong-watchdog ]; then
        wpid="$(cat /var/run/youzhong-watchdog.pid 2>/dev/null)"
        if [ -z "$wpid" ] || ! kill -0 "$wpid" 2>/dev/null; then
          echo "[youzhong] $(date '+%F %T') 巡检进程不在，拉起" >> "$LOGFILE"
          setsid nohup /usr/local/bin/youzhong-watchdog daemon >> /var/log/youzhong-watchdog.log 2>&1 9>&- < /dev/null &
        fi
      fi
      if healthy; then
        failures=0
      else
        failures=$((failures + 1))
        echo "[youzhong] $(date '+%F %T') 健康检查失败 ${failures}/3" >> "$LOGFILE"
        if [ "$failures" -ge 3 ]; then
          echo "[youzhong] $(date '+%F %T') 连续不健康，强制重启进程" >> "$LOGFILE"
          kill_child_group "$CHILD" 9
          break
        fi
      fi
    done
    wait "$CHILD" 2>/dev/null
    code=$?
    uptime_s=$(( $(date +%s) - started_at ))
    if [ "$uptime_s" -lt 60 ]; then
      backoff=$(( backoff * 2 ))
      [ "$backoff" -gt 60 ] && backoff=60
    else
      backoff=2
    fi
    rotate_log
    echo "[youzhong] $(date '+%F %T') 服务退出(exit=$code，运行 ${uptime_s}s)，${backoff}s 后自动重启" >> "$LOGFILE"
    sleep "$backoff"
  done
}

ensure() {
  if supervisor_running; then
    return 0
  fi
  if is_running; then
    echo "[youzhong] 有残留进程 PID=$(cat "$PIDFILE")，先清掉"
    kill_child_group "$(cat "$PIDFILE")" 9
    rm -f "$PIDFILE"
  fi
  echo "[youzhong] 拉起守护进程…"
  setsid nohup "$0" supervise > /dev/null 2>&1 9>&- < /dev/null &
  sleep 3
  if supervisor_running; then return 0; fi
  # 锁可能还被上一轮的残留服务进程占着：清掉再来一次
  echo "[youzhong] 守护未能启动，清理残留后重试"
  if is_running; then
    kill_child_group "$(cat "$PIDFILE")" 9
    rm -f "$PIDFILE"
    sleep 1
  fi
  setsid nohup "$0" supervise > /dev/null 2>&1 9>&- < /dev/null &
  sleep 3
  supervisor_running
}

start_once() {
  if is_running; then
    echo "[youzhong] 已在运行，PID=$(cat "$PIDFILE")"
    return 0
  fi
  echo "[youzhong] 启动中… 日志: $LOGFILE"
  start_child
  sleep 2
  if is_running; then
    echo "[youzhong] 启动成功，PID=$(cat "$PIDFILE")，端口 ${PORT_NUM:-10078}"
  else
    echo "[youzhong] 启动失败，请查看日志: $LOGFILE" >&2
    exit 1
  fi
}

stop() {
  if supervisor_running; then
    local spid
    spid="$(cat "$SUPERVISOR_PIDFILE")"
    echo "[youzhong] 停止守护进程 PID=$spid"
    kill -TERM "$spid" 2>/dev/null || true
    for _ in $(seq 1 10); do kill -0 "$spid" 2>/dev/null || break; sleep 0.5; done
    kill -9 "$spid" 2>/dev/null || true
  fi
  if is_running; then
    local pid
    pid="$(cat "$PIDFILE")"
    echo "[youzhong] 停止服务 PID=$pid"
    kill_child_group "$pid" TERM
    for _ in $(seq 1 10); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
    kill_child_group "$pid" 9
  fi
  rm -f "$PIDFILE" "$SUPERVISOR_PIDFILE"
}

status() {
  if supervisor_running; then
    echo "[youzhong] 守护模式运行中（supervisor PID=$(cat "$SUPERVISOR_PIDFILE")，服务 PID=$(cat "$PIDFILE" 2>/dev/null)）"
  elif is_running; then
    echo "[youzhong] 运行中（无守护），PID=$(cat "$PIDFILE")"
  else
    echo "[youzhong] 未运行"
    exit 1
  fi
}

case "${1:-start}" in
  supervise) supervise ;;
  ensure)    ensure ;;
  start)     start_once ;;
  stop)      stop ;;
  restart)   stop; ensure ;;
  restore)   stop; sleep 1; ensure ;;
  status)    status ;;
  logs)      tail -n 100 -f "$LOGFILE" ;;
  *) echo "用法: $0 supervise|ensure|start|stop|restart|restore|status|logs" >&2; exit 1 ;;
esac
