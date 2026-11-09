#!/usr/bin/env bash
# 容器启动入口：准备数据目录 → 检查关键配置 → 启动服务
set -euo pipefail

DB_FILE="${DB_FILE:-/data/youzhong.db}"
APK_DIR="${APK_DIR:-/data/apk}"
PORT="${PORT:-10078}"

mkdir -p "$(dirname "$DB_FILE")" "$APK_DIR"

# 宿主机挂载目录可能是 root 所有，尽量确保当前用户可写
if [ ! -w "$(dirname "$DB_FILE")" ]; then
  echo "[entrypoint] 警告：$(dirname "$DB_FILE") 不可写，数据库将启动失败" >&2
fi

if [ -z "${APP_SECRET:-}" ] || [ "${APP_SECRET}" = "change-me-to-a-long-random-string" ]; then
  echo "[entrypoint] 警告：APP_SECRET 仍是默认值，渠道密钥加密强度不足，请修改 compose 里的 APP_SECRET" >&2
fi

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "[entrypoint] 未设置 ADMIN_PASSWORD，首次启动的随机密码会打印在下方日志中" >&2
fi

echo "[entrypoint] 数据库=${DB_FILE} 安装包目录=${APK_DIR} 端口=${PORT} 子路径=${URL_PREFIX:-/}"
exec "$@"
