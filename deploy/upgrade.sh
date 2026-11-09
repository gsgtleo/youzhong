#!/usr/bin/env bash
# 升级：保留数据库与配置，仅替换程序文件后重启
set -euo pipefail
APP_DIR="/opt/youzhong"
DATA_DIR="/var/lib/youzhong"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "请使用 sudo 运行" >&2; exit 1; }

STAMP="$(date +%Y%m%d%H%M%S)"
if [ -f "${DATA_DIR}/youzhong.db" ]; then
  echo "[youzhong] 备份数据库到 ${DATA_DIR}/backup/youzhong-${STAMP}.db"
  mkdir -p "${DATA_DIR}/backup"
  sqlite3 "${DATA_DIR}/youzhong.db" ".backup '${DATA_DIR}/backup/youzhong-${STAMP}.db'" 2>/dev/null \
    || cp "${DATA_DIR}/youzhong.db" "${DATA_DIR}/backup/youzhong-${STAMP}.db"
fi

echo "[youzhong] 停止服务"
systemctl stop youzhong || true

if [ "${SRC_DIR}" != "${APP_DIR}" ]; then
  tar -C "${SRC_DIR}" --exclude=node_modules --exclude=.data --exclude=apps/android --exclude=capture/har -cf - . \
    | tar -C "${APP_DIR}" -xf -
fi

cd "${APP_DIR}"
npm ci --omit=dev --no-audit --no-fund
chown -R youzhong:youzhong "${APP_DIR}" "${DATA_DIR}"
install -m 644 "${APP_DIR}/deploy/youzhong.service" /etc/systemd/system/youzhong.service
systemctl daemon-reload
systemctl start youzhong
sleep 2
systemctl is-active --quiet youzhong && echo "[youzhong] 升级完成" || { journalctl -u youzhong -n 30 --no-pager; exit 1; }
