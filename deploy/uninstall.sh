#!/usr/bin/env bash
# 卸载：默认保留数据库，加 --purge 才删除数据（不可恢复）
set -euo pipefail
APP_DIR="/opt/youzhong"
DATA_DIR="/var/lib/youzhong"
ENV_DIR="/etc/youzhong"
PURGE="false"
[ "${1:-}" = "--purge" ] && PURGE="true"

[ "$(id -u)" -eq 0 ] || { echo "请使用 sudo 运行" >&2; exit 1; }

systemctl stop youzhong 2>/dev/null || true
systemctl disable youzhong 2>/dev/null || true
rm -f /etc/systemd/system/youzhong.service
systemctl daemon-reload
rm -rf "${APP_DIR}" "${ENV_DIR}"
echo "[youzhong] 程序与配置已删除，数据库保留在 ${DATA_DIR}"

if [ "${PURGE}" = "true" ]; then
  read -r -p "确认删除全部数据（数据库不可恢复）？输入 DELETE: " answer
  if [ "${answer}" = "DELETE" ]; then
    rm -rf "${DATA_DIR}"
    id youzhong >/dev/null 2>&1 && userdel youzhong 2>/dev/null || true
    echo "[youzhong] 数据已删除"
  else
    echo "[youzhong] 已取消删除数据"
  fi
fi
