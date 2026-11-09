#!/usr/bin/env bash
# 有终 · 容器内巡检看护（sshd / nginx / 应用守护）
#
#   youzhong-watchdog daemon   常驻循环，每 30s 巡检一次（由 bootstrap 拉起）
#   youzhong-watchdog once     只检查一次（给 cron 每分钟兜底用）
#
# 任何一项掉了/无响应都就地拉起；应用连续 2 次不健康则强制重启守护进程。
set -uo pipefail

APP_ROOT="${APP_ROOT:-/n3_storage/youzhong}"
START_SCRIPT="$APP_ROOT/scripts/start-dida.sh"
LOG="${WATCHDOG_LOG:-/var/log/youzhong-watchdog.log}"
PIDFILE=/var/run/youzhong-watchdog.pid
FAILFILE=/var/run/youzhong-watchdog.fails
INTERVAL="${WATCHDOG_INTERVAL:-30}"

PORT_NUM="$(grep -E '^PORT=' "$APP_ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r')"
URL_PREFIX_VAL="$(grep -E '^URL_PREFIX=' "$APP_ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r')"
APP_URL="${APP_HEALTH_URL:-http://127.0.0.1:${PORT_NUM:-10078}${URL_PREFIX_VAL%/}/api/ping}"
GATE_URL="${GATEWAY_HEALTH_URL:-http://127.0.0.1:8000${URL_PREFIX_VAL:-}/api/ping}"

log() {
  printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$LOG"
  if [ "${WATCHDOG_VERBOSE:-0}" = "1" ]; then printf '%s %s\n' "$(date '+%F %T')" "$*"; fi
}

rotate() {
  if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 2097152 ]; then
    mv -f "$LOG" "$LOG.1" 2>/dev/null || true
  fi
}

check_sshd() {
  if pgrep -x sshd > /dev/null 2>&1; then
    return 0
  fi
  log "sshd 未运行，拉起"
  /usr/sbin/sshd 2>> "$LOG" || log "sshd 启动失败"
}

check_nginx() {
  if ! pgrep -x nginx > /dev/null 2>&1; then
    log "nginx 未运行，拉起"
    nginx 2>> "$LOG" || log "nginx 启动失败"
    return 0
  fi
  if ! curl -fsS -m 5 "$GATE_URL" > /dev/null 2>&1; then
    log "nginx 在跑但 $GATE_URL 无响应，重启 nginx"
    nginx -s stop > /dev/null 2>&1 || true
    sleep 1
    pkill -x nginx > /dev/null 2>&1 || true
    sleep 1
    nginx 2>> "$LOG" || log "nginx 重启失败"
  fi
}

check_app() {
  local sup_pid
  sup_pid="$(cat "$APP_ROOT/.data/youzhong-supervisor.pid" 2>/dev/null)"
  if curl -fsS -m 6 "$APP_URL" > /dev/null 2>&1; then
    rm -f "$FAILFILE"
    # 应用健康但守护进程不在（被 kill 掉 / 手动 start 过），补一个守护
    if [ -x "$START_SCRIPT" ] && { [ -z "$sup_pid" ] || ! kill -0 "$sup_pid" 2>/dev/null; }; then
      log "应用健康但守护进程缺失（supervisor PID=${sup_pid:-无}），拉起守护"
      "$START_SCRIPT" ensure >> "$LOG" 2>&1
    fi
    return 0
  fi

  local fails
  fails=$(cat "$FAILFILE" 2>/dev/null || echo 0)
  fails=$((fails + 1))
  echo "$fails" > "$FAILFILE"
  log "应用健康检查失败 ${fails}/2（$APP_URL）"
  if [ "$fails" -ge 2 ]; then
    log "应用连续不健康，强制重启守护进程"
    "$START_SCRIPT" restore >> "$LOG" 2>&1 || log "restore 失败"
    rm -f "$FAILFILE"
  fi
}

check_all() {
  rotate
  check_sshd
  check_nginx
  check_app
}

case "${1:-daemon}" in
  daemon)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
      echo "watchdog 已在运行 (PID=$(cat "$PIDFILE"))"
      exit 0
    fi
    echo $$ > "$PIDFILE"
    trap 'rm -f "$PIDFILE"; exit 0' TERM INT
    # 顺手关掉可能继承来的守护锁 fd，避免再把锁传给 nginx/sshd 这类长驻子进程
    exec 9>&- 2>/dev/null || true
    log "watchdog 启动（间隔 ${INTERVAL}s，app=$APP_URL，gateway=$GATE_URL）"
    while true; do
      check_all
      sleep "$INTERVAL"
    done
    ;;
  once)
    check_all
    ;;
  *)
    echo "用法: $0 daemon|once" >&2
    exit 1
    ;;
esac
