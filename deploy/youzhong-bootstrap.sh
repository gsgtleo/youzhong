#!/usr/bin/env bash
# 有终 · 容器内一键拉起（幂等）：sshd + nginx + 应用守护 + 巡检 + cron
#
# 容器 PID 1 是交互式 bash（docker run -it … bash），所以 /root/.bashrc 会在容器启动时执行，
# 那里的钩子会调用本脚本；crontab 的 @reboot 与每分鐘巡检作为第二层兜底。
#
#   youzhong-bootstrap            正常输出
#   youzhong-bootstrap --quiet    静默（给 .bashrc / @reboot 用）
set -uo pipefail

APP_ROOT="${APP_ROOT:-/n3_storage/youzhong}"
START_SCRIPT="$APP_ROOT/scripts/start-dida.sh"
WATCHDOG=/usr/local/bin/youzhong-watchdog
LOG=/var/log/youzhong-boot.log
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

say() {
  printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$LOG"
  [ "$QUIET" -eq 1 ] || printf '%s\n' "$*"
}

# 并发保护：.bashrc 可能在多个会话里同时触发
# 注意：长驻子进程必须 8>&- 关闭这个 fd，否则它会把锁一直攥住，后续 bootstrap 全被跳过
exec 8> /var/lock/youzhong-bootstrap.lock
if command -v flock > /dev/null 2>&1 && ! flock -n 8; then
  exit 0
fi
trap 'exec 8>&-' EXIT

# 1. sshd
if ! pgrep -x sshd > /dev/null 2>&1; then
  say "启动 sshd"
  /usr/sbin/sshd 2>> "$LOG" 8>&- || say "sshd 启动失败"
fi

# 2. nginx
if ! pgrep -x nginx > /dev/null 2>&1; then
  say "启动 nginx"
  nginx 2>> "$LOG" 8>&- || say "nginx 启动失败"
fi

# 3. 应用守护
if [ -x "$START_SCRIPT" ]; then
  if "$START_SCRIPT" status > /dev/null 2>&1; then
    say "应用守护已在运行"
  else
    say "拉起应用守护"
    "$START_SCRIPT" ensure >> "$LOG" 2>&1 8>&- || say "应用守护拉起失败"
  fi
else
  say "找不到 $START_SCRIPT"
fi

# 4. 巡检（每 30s 检查 sshd / nginx / 应用）
# 用 pidfile 判断，别用 pgrep -f：命令行里带同样字符串的 shell 会造成误判
if [ -x "$WATCHDOG" ]; then
  WPIDFILE=/var/run/youzhong-watchdog.pid
  if [ -f "$WPIDFILE" ] && kill -0 "$(cat "$WPIDFILE" 2>/dev/null)" 2>/dev/null; then
    say "巡检已在运行（PID=$(cat "$WPIDFILE")）"
  else
    say "启动巡检"
    setsid nohup "$WATCHDOG" daemon >> /var/log/youzhong-watchdog.log 2>&1 8>&- < /dev/null &
    sleep 1
  fi
fi

# 5. cron（有就启动，作为每分钟兜底）
if command -v cron > /dev/null 2>&1; then
  if ! pgrep -x cron > /dev/null 2>&1 && ! pgrep -x crond > /dev/null 2>&1; then
    say "启动 cron"
    cron 2>> "$LOG" || say "cron 启动失败"
  fi
fi

exit 0
