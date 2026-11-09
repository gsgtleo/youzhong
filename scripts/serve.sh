#!/usr/bin/env bash
# 生产模式启动 BFF（单端口 10078，托管 apps/web/dist）
# 用法：./scripts/serve.sh            前台运行
#      nohup ./scripts/serve.sh &     后台常驻
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 优先使用 nvm 管理的 Node（系统 node 过旧时跑不了 tsx/Vite）
if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1 || true
  nvm use --silent >/dev/null 2>&1 || nvm use --lts --silent >/dev/null 2>&1 || true
fi

command -v node >/dev/null 2>&1 || { echo "[serve] 未找到 node，请先安装 Node 20+" >&2; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || { echo "[serve] 需要 Node >= 20，当前 $(node -v)" >&2; exit 1; }

# APP_SECRET 用于加密渠道 Webhook，必须与数据库中已有数据一致
export APP_SECRET="${APP_SECRET:-devsecret}"
# 与安卓包保持同一套版本号，设置页里对比更直观
export APP_VERSION="${APP_VERSION:-1.0.202611081807}"
export PORT="${PORT:-10078}"
export HOST="${HOST:-0.0.0.0}"

cd "$ROOT/apps/server"
echo "[serve] 启动于 $(date '+%F %T')  node=$(node -v)  port=$PORT"
exec npx tsx src/index.ts
