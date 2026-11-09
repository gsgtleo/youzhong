#!/usr/bin/env bash
# 把 dist-packages 下的发布产物传到服务器（链路慢时自动分片 + 重试 + md5 校验）
#
# 用法：
#   HOST=your-server DEST=/srv/youzhong/dist-packages \
#     ./scripts/upload-release.sh youzhong-client-1.0.0.apk youzhong-desktop-1.0.0-x64.zip
#
# 环境变量：HOST（SSH 别名或 user@host，必填）、DEST（远端目录，必填）、CHUNK_MB（默认 18）
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${SRC:-${ROOT}/dist-packages}"
HOST="${HOST:-}"
DEST="${DEST:-}"
CHUNK_MB="${CHUNK_MB:-18}"
RETRIES="${RETRIES:-4}"

log() { printf '[upload %s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
fail() { log "失败：$*"; exit 1; }

[ -n "${HOST}" ] || fail "请用 HOST=... 指定服务器（SSH 别名或 user@host）"
[ -n "${DEST}" ] || fail "请用 DEST=... 指定远端目录"
[ "$#" -ge 1 ] || fail "请指定要上传的文件名（位于 ${SRC}）"

for name in "$@"; do
  src="${SRC}/${name}"
  [ -f "${src}" ] || fail "文件不存在：${src}"
  size=$(stat -c %s "${src}")
  local_md5=$(md5sum "${src}" | awk '{print $1}')
  log "开始 ${name}（$((size / 1024 / 1024)) MB, md5 ${local_md5}）"

  if [ "${size}" -le $((CHUNK_MB * 1024 * 1024)) ]; then
    for i in $(seq 1 "${RETRIES}"); do
      if scp -o ConnectTimeout=15 "${src}" "${HOST}:${DEST}/${name}"; then break; fi
      log "第 ${i} 次失败，重试…"
      sleep 3
      [ "${i}" = "${RETRIES}" ] && fail "${name} 上传失败"
    done
  else
    tmp="$(mktemp -d)"
    split -b "${CHUNK_MB}M" -d -a 3 "${src}" "${tmp}/part."
    total=$(ls "${tmp}" | wc -l)
    n=0
    for part in "${tmp}"/part.*; do
      n=$((n + 1))
      base=$(basename "${part}")
      for i in $(seq 1 "${RETRIES}"); do
        if scp -o ConnectTimeout=15 "${part}" "${HOST}:/tmp/youzhong_${base}"; then break; fi
        log "分片 ${n}/${total} 第 ${i} 次失败，重试…"
        sleep 3
        [ "${i}" = "${RETRIES}" ] && fail "分片 ${base} 上传失败"
      done
      log "分片 ${n}/${total} 完成"
    done
    log "合并分片…"
    ssh "${HOST}" "cat /tmp/youzhong_part.* > '${DEST}/${name}' && rm -f /tmp/youzhong_part.*" || fail "远端合并失败"
    rm -rf "${tmp}"
  fi

  remote_md5=$(ssh "${HOST}" "md5sum '${DEST}/${name}' | awk '{print \$1}'")
  if [ "${remote_md5}" = "${local_md5}" ]; then
    log "${name} 校验通过"
  else
    fail "${name} md5 不一致：本地 ${local_md5} / 远端 ${remote_md5}"
  fi
done

log "全部完成"
