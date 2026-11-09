
# ---------- 1. 依赖 ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 若没有预编译包，需要在镜像内编译
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund

# ---------- 2. 构建前端 ----------
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm -w apps/web run build

# ---------- 3. 运行 ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=10078 \
    HOST=0.0.0.0 \
    DB_FILE=/data/youzhong.db \
    APK_DIR=/data/apk \
    URL_PREFIX= \
    APP_VERSION=1.0.202611081807

# 运行期只需要已安装的依赖 + 源码 + 前端产物
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p /data/apk \
    && (getent group youzhong >/dev/null || groupadd -r youzhong) \
    && (getent passwd youzhong >/dev/null || useradd -r -g youzhong -d /app -s /usr/sbin/nologin youzhong) \
    && chown -R youzhong:youzhong /data /app

USER youzhong
VOLUME ["/data"]
EXPOSE 10078

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||10078)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node_modules/.bin/tsx", "apps/server/src/index.ts"]
