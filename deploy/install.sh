#!/usr/bin/env bash
# 有终 · 多用户服务 Ubuntu 安装脚本
set -euo pipefail

APP_USER="youzhong"
APP_DIR="/opt/youzhong"
DATA_DIR="/var/lib/youzhong"
ENV_DIR="/etc/youzhong"
ENV_FILE="${ENV_DIR}/youzhong.env"
SERVICE="/etc/systemd/system/youzhong.service"
PORT="${PORT:-10078}"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

info() { printf '\033[34m[youzhong]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[youzhong]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "请使用 sudo 运行：sudo ./deploy/install.sh"

command -v node >/dev/null 2>&1 || fail "未找到 node，请先安装 Node.js 20+：curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "${NODE_MAJOR}" -ge 20 ] || fail "需要 Node.js >= 20，当前 $(node -v)"
command -v npm >/dev/null 2>&1 || fail "未找到 npm"

if ! id "${APP_USER}" >/dev/null 2>&1; then
  info "创建系统用户 ${APP_USER}"
  useradd --system --home "${DATA_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

info "准备目录：${APP_DIR} / ${DATA_DIR} / ${ENV_DIR}"
mkdir -p "${APP_DIR}" "${DATA_DIR}" "${ENV_DIR}"

info "复制程序文件到 ${APP_DIR}"
if [ "${SRC_DIR}" != "${APP_DIR}" ]; then
  tar -C "${SRC_DIR}" \
    --exclude=node_modules --exclude=.data --exclude=apps/android \
    --exclude=capture/har --exclude='*.log' \
    -cf - . | tar -C "${APP_DIR}" -xf -
fi

if [ ! -f "${ENV_FILE}" ]; then
  APP_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")"
  ADMIN_PASSWORD="$(node -e "console.log(require('crypto').randomBytes(6).toString('base64url'))")"
  cat > "${ENV_FILE}" <<EOF
PORT=${PORT}
HOST=0.0.0.0
NODE_ENV=production
DB_FILE=${DATA_DIR}/youzhong.db
APP_SECRET=${APP_SECRET}
SERVER_NAME=有终 · 家庭服务器
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${ADMIN_PASSWORD}
MAX_USERS=10
# TRUST_PROXY=true
# ALLOWED_ORIGINS=http://localhost:5173
EOF
  chmod 600 "${ENV_FILE}"
  info "已生成配置文件 ${ENV_FILE}"
else
  info "检测到已有配置，保留 ${ENV_FILE}"
fi

info "安装依赖（可能触发 better-sqlite3 编译，需 build-essential/python3）"
cd "${APP_DIR}"
if npm ci --omit=dev --no-audit --no-fund; then
  info "依赖安装完成"
else
  fail "依赖安装失败：请先执行 sudo apt install -y build-essential python3 后重试"
fi

chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" "${DATA_DIR}"

info "注册 systemd 服务"
install -m 644 "${APP_DIR}/deploy/youzhong.service" "${SERVICE}"
systemctl daemon-reload
systemctl enable youzhong >/dev/null 2>&1 || true
systemctl restart youzhong

sleep 2
if systemctl is-active --quiet youzhong; then
  IP="$(hostname -I | awk '{print $1}')"
  ADMIN_PASSWORD_SHOW="$(grep '^ADMIN_PASSWORD=' "${ENV_FILE}" | cut -d= -f2-)"
  echo
  echo "=========================================================="
  echo " 部署完成"
  echo " 访问地址：http://${IP}:${PORT}"
  echo " 管理员账号：$(grep '^ADMIN_USERNAME=' "${ENV_FILE}" | cut -d= -f2-)"
  echo " 初始密码：${ADMIN_PASSWORD_SHOW}（首次登录后请修改）"
  echo " 数据库：${DATA_DIR}/youzhong.db"
  echo " 配置：${ENV_FILE}"
  echo " 日志：journalctl -u youzhong -f"
  echo "=========================================================="
else
  fail "服务启动失败，请查看：journalctl -u youzhong -n 50 --no-pager"
fi
