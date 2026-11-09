#!/usr/bin/env bash
# 构建并导出可离线分发的 Docker 镜像。
#
# 注意：docker save 导出的是「单架构」镜像，镜像里含 Node 二进制与 better-sqlite3 原生模块，
# amd64 的包无法在 arm64 上运行（反之亦然）。需要哪个架构就构建哪个。
#
# 用法：
#   ./deploy/build-docker.sh --arch amd64          # 导出 dist-packages/youzhong-image-<ver>-linux-amd64.tar.gz
#   ./deploy/build-docker.sh --arch arm64          # 需要 QEMU（见 --help）
#   ./deploy/build-docker.sh --arch both           # 两个架构各导出一个 tar
#   ./deploy/build-docker.sh --push                # 构建多架构 manifest 并推送到镜像仓库（在线分发）
#
# 可选：--image 名称、--no-cache、--dockerfile 路径
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('${ROOT}/package.json').version" 2>/dev/null || echo 0.0.0)"
IMAGE="${IMAGE:-youzhong}"
OUT="${ROOT}/dist-packages"
DOCKERFILE="Dockerfile"
ARCH="amd64"
PUSH=0
NO_CACHE=0

usage() {
  cat <<'EOF'
用法: ./deploy/build-docker.sh [选项]

  --arch amd64|arm64|both   目标架构（默认 amd64）
  --image NAME              镜像名（默认 youzhong）
  --dockerfile PATH         使用指定 Dockerfile（如 docker/Dockerfile.cn）
  --push                    多架构构建并推送到镜像仓库（不导出 tar）
  --no-cache                禁用构建缓存
  -h, --help                显示帮助

ARM 构建前需要注册 QEMU：
  docker run --privileged --rm tonistiigi/binfmt --install arm64
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --arch) ARCH="${2:?缺少架构}"; shift 2 ;;
    --arch=*) ARCH="${1#*=}"; shift ;;
    --image) IMAGE="${2:?缺少镜像名}"; shift 2 ;;
    --dockerfile) DOCKERFILE="${2:?缺少路径}"; shift 2 ;;
    --push) PUSH=1; shift ;;
    --no-cache) NO_CACHE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数：$1" >&2; usage; exit 1 ;;
  esac
done

case "${ARCH}" in
  amd64|arm64|both) ;;
  *) echo "--arch 只能是 amd64 / arm64 / both" >&2; exit 1 ;;
esac

cd "${ROOT}"

if [ "${PUSH}" = "1" ]; then
  case "${ARCH}" in
    both) PLATFORMS="linux/amd64,linux/arm64" ;;
    *) PLATFORMS="linux/${ARCH}" ;;
  esac
  echo "[docker] buildx 多架构构建并推送：${IMAGE}:${VERSION} (${PLATFORMS})"
  docker buildx build --platform "${PLATFORMS}" -t "${IMAGE}:${VERSION}" -f "${DOCKERFILE}" --push .
  echo "[docker] 完成。目标机直接 docker pull ${IMAGE}:${VERSION} 即可，Docker 会自动选架构。"
  exit 0
fi

if ! docker buildx version >/dev/null 2>&1; then
  echo "需要 docker buildx（Docker 19.03+ 自带）" >&2
  exit 1
fi

mkdir -p "${OUT}"

build_and_save() {
  local arch="$1"
  local tag="${IMAGE}:${VERSION}-${arch}"
  local file="${OUT}/${IMAGE//\//_}-image-${VERSION}-linux-${arch}.tar.gz"

  echo "[docker] 构建 linux/${arch} → ${tag}"
  local args=(buildx build --platform "linux/${arch}" -t "${tag}" -f "${DOCKERFILE}" --load .)
  [ "${NO_CACHE}" = "1" ] && args+=(--no-cache)
  docker "${args[@]}"

  echo "[docker] 导出 ${file}"
  docker save "${tag}" | gzip > "${file}"
  ls -lh "${file}"
}

if [ "${ARCH}" = "both" ]; then
  build_and_save amd64
  build_and_save arm64
else
  build_and_save "${ARCH}"
fi

echo "[docker] 全部完成，产物在 ${OUT}/"
echo "[docker] 目标机导入：docker load < xxx.tar.gz"
