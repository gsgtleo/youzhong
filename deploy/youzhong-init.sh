#!/usr/bin/env bash
# 有终 · 容器初始化 / 开机启动脚本（幂等，可反复执行）
#
#   youzhong-init                 初始化 + 拉起全部服务
#   youzhong-init --quiet         静默（给 .bashrc / 容器入口用）
#   youzhong-init --foreground    初始化后常驻（给 docker run 当 PID 1 用）
#
# 它会做这些事（缺什么补什么，已经有的跳过）：
#   1. 目录 / 日志 / 数据目录
#   2. .env（缺失则从 .env.example 生成，自动填 DB_FILE / APK_DIR / URL_PREFIX / APP_SECRET）
#   3. sshd（缺省生成 host key、放行 root 登录）→ 启动
#   4. nginx（缺则 apt 安装；站点配置缺失则写入模板）→ 校验并启动
#   5. Node 依赖（node_modules 缺失时 npm ci）
#   6. 应用守护（崩溃自动重启 + 卡死自愈）→ 启动
#   7. 巡检进程（每 30s 看护 sshd / nginx / 应用）→ 启动
set -uo pipefail

APP_ROOT="${APP_ROOT:-/n3_storage/youzhong}"
NODE_HOME="${NODE_HOME:-/n3_storage/tools/node22}"
START_SCRIPT="$APP_ROOT/scripts/start-dida.sh"
WATCHDOG=/usr/local/bin/youzhong-watchdog
NGINX_CONF=/etc/nginx/conf.d/youzhong.conf
LOG=/var/log/youzhong-init.log
LOCK=/var/lock/youzhong-init.lock

QUIET=0
FOREGROUND=0
for arg in "$@"; do
  case "$arg" in
    --quiet) QUIET=1 ;;
    --foreground) FOREGROUND=1 ;;
  esac
done

say() {
  printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$LOG"
  [ "$QUIET" -eq 1 ] || printf '%s\n' "$*"
}
warn() { printf '%s [WARN] %s\n' "$(date '+%F %T')" "$*" >> "$LOG"; [ "$QUIET" -eq 1 ] || printf '[WARN] %s\n' "$*"; }

# 并发保护；长驻子进程必须 8>&- 关掉这个 fd，否则会把锁一直攥住
exec 8> "$LOCK"
if command -v flock > /dev/null 2>&1 && ! flock -n 8; then
  [ "$FOREGROUND" -eq 1 ] && exec sleep infinity
  exit 0
fi
trap 'exec 8>&-' EXIT

node_bin() {
  if [ -x "$NODE_HOME/bin/node" ]; then echo "$NODE_HOME/bin/node"; else command -v node; fi
}
node_dir() {
  if [ -x "$NODE_HOME/bin/node" ]; then echo "$NODE_HOME/bin"; else dirname "$(command -v node 2>/dev/null || echo /usr/bin/node)"; fi
}

URL_PREFIX_VAL="$(grep -E '^URL_PREFIX=' "$APP_ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r')"
URL_PREFIX_VAL="${URL_PREFIX_VAL:-/youzhong}"

say "=== 有终初始化开始（$APP_ROOT）==="
mkdir -p "$APP_ROOT/.data" /var/log /var/run

# ---------- 1. .env ----------
if [ ! -f "$APP_ROOT/.env" ]; then
  if [ -f "$APP_ROOT/.env.example" ]; then
    cp "$APP_ROOT/.env.example" "$APP_ROOT/.env"
    SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    {
      echo "PORT=10078"
      echo "HOST=0.0.0.0"
      echo "URL_PREFIX=/youzhong"
      echo "TRUST_PROXY=true"
      echo "APP_SECRET=$SECRET"
      echo "DB_FILE=$APP_ROOT/.data/youzhong.db"
      echo "APK_DIR=$APP_ROOT/dist-packages"
      echo "SERVER_NAME=有终 · 家庭服务器"
      echo "MAX_USERS=10"
      echo "SEED_DEMO=false"
    } > "$APP_ROOT/.env"
    say "已生成 $APP_ROOT/.env（APP_SECRET 随机，管理员密码请在首次登录后修改）"
  else
    warn "既没有 .env 也没有 .env.example，跳过配置生成"
  fi
else
  say ".env 已存在，保持不动"
fi

# 补上 .env 里缺失的关键项（存在则不改）
ensure_env() {
  local key="$1" value="$2"
  grep -qE "^${key}=" "$APP_ROOT/.env" 2>/dev/null || { echo "${key}=${value}" >> "$APP_ROOT/.env"; say ".env 补充 $key"; }
}
[ -f "$APP_ROOT/.env" ] && {
  ensure_env URL_PREFIX /youzhong
  ensure_env DB_FILE "$APP_ROOT/.data/youzhong.db"
  ensure_env APK_DIR "$APP_ROOT/dist-packages"
  ensure_env PORT 10078
}

# ---------- 2. sshd ----------
if ! command -v sshd > /dev/null 2>&1 && [ ! -x /usr/sbin/sshd ]; then
  say "未找到 sshd，尝试安装 openssh-server"
  DEBIAN_FRONTEND=noninteractive apt-get update -qq >> "$LOG" 2>&1
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq openssh-server >> "$LOG" 2>&1 || warn "openssh-server 安装失败（离线环境请预先装好）"
fi
if [ -x /usr/sbin/sshd ] || command -v sshd > /dev/null 2>&1; then
  [ -f /etc/ssh/ssh_host_ed25519_key ] || ssh-keygen -A >> "$LOG" 2>&1
  grep -qE '^PermitRootLogin yes' /etc/ssh/sshd_config 2>/dev/null || echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config
  mkdir -p /run/sshd
  if ! pgrep -x sshd > /dev/null 2>&1; then
    say "启动 sshd"
    /usr/sbin/sshd 2>> "$LOG" 8>&- || warn "sshd 启动失败"
  else
    say "sshd 已在运行"
  fi
  if [ ! -s /root/.ssh/authorized_keys ]; then
    if [ -s "$APP_ROOT/deploy/authorized_keys" ]; then
      mkdir -p /root/.ssh && chmod 700 /root/.ssh
      cp "$APP_ROOT/deploy/authorized_keys" /root/.ssh/authorized_keys
      chmod 600 /root/.ssh/authorized_keys
      say "已从 $APP_ROOT/deploy/authorized_keys 恢复免密公钥"
    else
      warn "注意：/root/.ssh/authorized_keys 为空且没有备份，容器重建后需要重新放公钥才能免密登录"
    fi
  fi
fi

# ---------- 3. nginx ----------
if ! command -v nginx > /dev/null 2>&1; then
  say "未找到 nginx，尝试安装"
  DEBIAN_FRONTEND=noninteractive apt-get update -qq >> "$LOG" 2>&1
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx >> "$LOG" 2>&1 || warn "nginx 安装失败（离线环境请预先装好）"
fi
if command -v nginx > /dev/null 2>&1; then
  if [ ! -f "$NGINX_CONF" ]; then
    if [ -f "$APP_ROOT/deploy/nginx.container.conf" ]; then
      # 优先用项目里留存的真实配置（含 /xqb 等自定义路由）
      say "从 $APP_ROOT/deploy/nginx.container.conf 恢复站点配置"
      cp "$APP_ROOT/deploy/nginx.container.conf" "$NGINX_CONF"
      nginx -t >> "$LOG" 2>&1 || warn "nginx 配置校验失败，请检查 $NGINX_CONF"
    else
    say "写入站点配置 $NGINX_CONF（默认模板，不含自定义路由）"
    cat > "$NGINX_CONF" <<'NGINX'
server {
    listen 8000;
    server_name _;
    absolute_redirect off;

    # 有终：页面 / 静态资源 / API / SSE 都走 /youzhong 前缀，后端 node 监听 10078
    location = /youzhong {
        proxy_pass http://127.0.0.1:10078;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    location /youzhong/ {
        proxy_pass http://127.0.0.1:10078;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 实时通道：关闭缓冲，长连接保持
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 1h;
        proxy_send_timeout 1h;
    }

    location / {
        return 404;
    }
}
NGINX
    nginx -t >> "$LOG" 2>&1 || warn "nginx 配置校验失败，请检查 $NGINX_CONF"
    fi
  else
    say "nginx 站点配置已存在，保持不动"
  fi
  if ! pgrep -x nginx > /dev/null 2>&1; then
    say "启动 nginx"
    nginx 2>> "$LOG" 8>&- || warn "nginx 启动失败"
  else
    say "nginx 已在运行"
    curl -fsS -m 5 "http://127.0.0.1:8000${URL_PREFIX_VAL:-/youzhong}/api/ping" > /dev/null 2>&1 || {
      say "nginx 无响应，重启"
      nginx -s stop > /dev/null 2>&1 || true
      sleep 1
      nginx 2>> "$LOG" 8>&- || warn "nginx 重启失败"
    }
  fi
fi

# ---------- 4. Node 依赖 ----------
if [ -z "$(node_bin)" ]; then
  warn "找不到 node（$NODE_HOME/bin/node 或 PATH），应用无法启动"
fi
if [ ! -d "$APP_ROOT/node_modules" ] && [ -f "$APP_ROOT/package.json" ]; then
  say "node_modules 缺失，执行 npm ci"
  ( cd "$APP_ROOT" && env -u LD_LIBRARY_PATH PATH="$(node_dir):$PATH" npm ci --no-audit --no-fund 8>&- >> "$LOG" 2>&1 ) \
    || warn "npm ci 失败（离线环境需预先带好 node_modules）"
fi

# ---------- 5. 应用守护 ----------
if [ -x "$START_SCRIPT" ]; then
  if "$START_SCRIPT" status > /dev/null 2>&1; then
    say "应用守护已在运行"
  else
    say "拉起应用守护"
    "$START_SCRIPT" ensure >> "$LOG" 2>&1 8>&- || warn "应用守护拉起失败"
  fi
else
  warn "找不到 $START_SCRIPT"
fi

# ---------- 6. 巡检 ----------
if [ -x "$WATCHDOG" ]; then
  wpid="$(cat /var/run/youzhong-watchdog.pid 2>/dev/null)"
  if [ -n "$wpid" ] && kill -0 "$wpid" 2>/dev/null; then
    say "巡检已在运行（PID=$wpid）"
  else
    say "启动巡检"
    setsid nohup "$WATCHDOG" daemon >> /var/log/youzhong-watchdog.log 2>&1 8>&- < /dev/null &
    sleep 1
  fi
fi

say "=== 初始化完成：sshd=$(pgrep -x sshd | wc -l) nginx=$(pgrep -x nginx | wc -l) watchdog=$(pgrep -f 'youzhong-watchdo[g] daemon' | wc -l) app=$(pgrep -f 'import tsx src/index.ts' | wc -l) ==="

if [ "$FOREGROUND" -eq 1 ]; then
  # 作为容器 PID 1 常驻：先关掉锁 fd，避免影响后续手动执行
  exec 8>&-
  say "进入前台常驻（PID 1 模式）"
  exec sleep infinity
fi
