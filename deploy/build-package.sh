#!/usr/bin/env bash
# 产出可拷贝到 Ubuntu 的安装包：dist-packages/youzhong-server-<ver>.tar.gz
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('${ROOT}/package.json').version" 2>/dev/null || echo 2.0.0)"
OUT="${ROOT}/dist-packages"
NAME="youzhong-server-${VERSION}"
STAGE="${OUT}/${NAME}"

echo "[build] 构建前端"
cd "${ROOT}"
npm -w apps/web run build

rm -rf "${STAGE}"
mkdir -p "${STAGE}"

echo "[build] 收集服务端与前端产物"
tar -C "${ROOT}" \
  --exclude='apps/web/node_modules' --exclude='apps/android' \
  --exclude='capture/har' --exclude='.data' --exclude='*.log' \
  --exclude='apps/server/.data' \
  --exclude='*.jks' --exclude='*.keystore' --exclude='keystore.properties' \
  --exclude='*.pem' --exclude='*.p12' --exclude='.env' \
  -cf - package.json package-lock.json tsconfig.base.json README.md \
  apps/server apps/web/package.json apps/web/dist packages/shared deploy docs \
  | tar -C "${STAGE}" -xf -

chmod +x "${STAGE}/deploy/"*.sh

cat > "${STAGE}/INSTALL.txt" <<'EOF'
有终（Youzhong）· 多用户服务安装说明
1) 安装 Node.js 20+ 与编译工具：
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs build-essential python3
2) 解压并安装：
   tar -xzf youzhong-server-*.tar.gz && cd youzhong-server-*
   sudo ./deploy/install.sh
3) 浏览器访问 http://<服务器IP>:10078 ，用脚本打印的管理员账号登录
4) 升级：sudo ./deploy/upgrade.sh    卸载：sudo ./deploy/uninstall.sh [--purge]
EOF

cd "${OUT}"
tar -czf "${NAME}.tar.gz" "${NAME}"
echo "[build] 完成：${OUT}/${NAME}.tar.gz ($(du -h "${NAME}.tar.gz" | cut -f1))"
rm -rf "${STAGE}"
