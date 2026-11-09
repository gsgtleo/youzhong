# 有终 · 自托管任务管理器

<p align="left">
  <img src="docs/logo.svg" width="88" height="88" alt="有终" />
</p>

**靡不有初，鲜克有终。**

出自《诗经·大雅·荡》——凡事都有个开端，却很少有人能坚持到最后。项目取名「有终」，取的就是这句话里「把事情做完」的意思。

一个可自己部署的任务管理服务：网页端 + 安卓客户端 + 服务端（BFF）。数据存在自己的 SQLite 里，多端实时同步，提醒时间由服务端统一决定。

> 完全独立实现，数据保存在你部署的服务器上。仅建议个人 / 小团队自托管使用。
>
> 本项目是**非商业性开源项目**：不提供付费或商业服务，不做商业宣传与推广，项目名称与标识仅用于标识本仓库及你自行部署的实例。
>
> 仓库名建议用 `youzhong`；GitHub 等平台若已被占用，加前后缀或次级段即可（如 `youzhong-tasks`、`youzhong-app`、`youzhong-self-hosted`），代码与配置无需跟着改。

---

## 1. 主要功能

### 任务
- 清单（笔记本 / 自定义清单 / 颜色）、任务、子任务、标签、优先级（无 / 低 / 中 / 高）
- 截止日期与时间、全天任务、提醒（准时 / 提前 5·15·30·60 分钟）
- 自然语言快速添加：`明天 10:00 提交周报 !高`、`周五 复盘会议`、`今晚 20点 打电话`
- 完成 / 取消完成、重复任务（每天 / 每周 / 每月，完成后自动顺延）
- 搜索、按清单 / 今天 / 最近 7 天 / 已完成筛选、多种排序

### 日历
- 月 / 周 / 日三种视图，PC 与手机自适应
- 任务与日程（事件）混排，全天事件单独一栏
- 点击日程打开编辑弹窗：改标题、日期、起止时间、全天、颜色，或删除（网页与安卓一致）
- 双击时间轴空白处新建日程；双击已有条目不会再误创建
- 拖拽改期：月视图拖到某天、时间轴里上下拖动改时间
- 重叠日程自动分列显示；每天超过 2 条时「还有 N 项」可点开当天

### 四象限
- 艾森豪威尔矩阵四格，任务卡片可拖到任意象限
- 两套规则可切换：
  - **按优先级**：高中低无 ↔ 四个象限（拖拽会同步改任务优先级）
  - **优先级 + 时间**：重要＝优先级，紧急＝是否临近到期
- 与日历、任务列表共用同一份数据，不存在影子数据

### 多端同步与提醒
- **服务端 SSE 实时通道**：任一终端修改，其他终端立即刷新，无需手动刷新页面
- **提醒由服务端调度**：到点由服务端生成通知并通过 SSE 推送，客户端只负责展示，避免设备时钟不准导致漏提醒
- 安卓端额外机制：
  - 前台常驻服务维持长连接，通知栏常驻一条低优先级提示
  - App 被系统回收时，由本地闹钟兜底（触发点用「服务器时间 − 设备时间」的差值换算，设备时钟偏差不影响）
  - 开机自启；提供「允许后台常驻」入口跳系统电池白名单
- 通知渠道：钉钉 / 飞书群机器人 Webhook（到期提醒、每日汇总）
- 每日汇总：可配置小时，推送当天待办概览

### 其他
- 多用户（默认上限 10 人），管理员可创建 / 重置 / 停用成员
- 外观：淡色 / 深色 / 系统色三档主题；青玉、苔绿、紫棠、绯桃、赭石 5 套主题色（默认青玉，已去掉与商业产品过于接近的蓝色）
- 列表密度、每周起始日
- **WebDAV 云备份**：填自己的 WebDAV（坚果云 / Nextcloud / NAS）即可一键备份，换服务器后登录新服务器直接恢复
- PWA：手机浏览器可「添加到主屏幕」，离线可浏览缓存快照
- 安卓安装包下载页：`/apk`
- 安卓「同步到手机日历」：每天定时把未来 N 天的未完成任务写入你指定的系统日历
- 版本自查：设置页显示客户端 / 服务端 / 最新安装包版本，可一键检查更新

---

## 2. 架构

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ 网页 (PWA)    │   │ 安卓客户端    │   │ 其它终端      │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │ HTTPS/HTTP       │ SSE + REST        │
       └──────────────────┼───────────────────┘
                          ▼
              ┌────────────────────────┐
              │  服务端 BFF (Node 22)   │
              │  Express + TypeScript  │
              │  · REST /api/*         │
              │  · SSE /api/stream     │
              │  · 通知调度器 (60s)     │
              │  · 静态托管 web/dist    │
              └───────────┬────────────┘
                          ▼
                 ┌─────────────────┐
                 │ SQLite (WAL)     │
                 │ /data/youzhong.db    │
                 └─────────────────┘
```

**技术栈**

| 层 | 选型 |
| --- | --- |
| 前端 | React 18 + TypeScript + Vite + Tailwind + Zustand + Dexie(IndexedDB) + dnd-kit |
| 服务端 | Node 22 + Express + TypeScript(tsx) + better-sqlite3 |
| 安卓 | Kotlin + Jetpack Compose + OkHttp |
| 共享 | `packages/shared` 提供任务模型、日期工具、四象限规则 |

**关键设计**

- 单端口部署：服务端同时提供 API 与前端静态资源，`/apk` 提供安装包下载。
- 前端先写本地（IndexedDB 快照 + 离线写队列），再与服务器对账，弱网可用。
- 四象限与日历都是 `tasks` 的派生视图，只通过 selector 计算，不复制数据。
- 提醒时间以服务端为准：客户端只上报「提醒的绝对时间」，何时触发由服务端判定。
- 所有写操作成功后，服务端通过 SSE 广播 `snapshot-changed`，其他终端静默拉取一次快照；生成通知时广播 `notification`，客户端直接弹出。

**目录结构**

```
apps/
  server/      Node 服务端（API、SSE、调度器、静态托管）
  web/         React 网页端（PWA）
  desktop/     桌面客户端（Electron，复用 web 构建产物）
  android/     Android 客户端（Kotlin + Compose）
packages/
  shared/      前后端共享类型与日期工具
deploy/        systemd / nginx / 安装与升级脚本
docker/        容器入口脚本与国内构建兜底
docs/api/      服务端接口说明
docs/PRIVACY.md 隐私说明
docs/logo.svg  项目图标（SVG 源文件）
scripts/       本地启动、发布产物上传
```

**仓库内容（哪些进版本库）**

公开仓库只放源码、文档、配置模板与图标（约 170 个文件、1.2 MB），其余一律由 `.gitignore` 排除。

| 纳入 | 说明 |
| --- | --- |
| `apps/`、`packages/` | 全部源码（网页、服务端、安卓、桌面、共享包） |
| `deploy/`、`docker/`、`Dockerfile`、`docker-compose.yml` | 部署与镜像构建 |
| `docs/` | 接口文档、隐私说明、图标源文件 |
| `scripts/` | 本地启动、发布产物上传 |
| `package.json`、`package-lock.json`、`tsconfig.base.json`、`.nvmrc` | 工程配置 |
| `.env.example` | 配置模板（只有占位值） |
| `LICENSE`、`THIRD-PARTY-NOTICES.md`、`README.md` | 许可与说明 |

| 不纳入 | 原因 | 怎么生成 |
| --- | --- | --- |
| `.env`、`.env.*` | 本机凭据 | `cp .env.example .env` 后填写 |
| `node_modules/` | 依赖 | `npm ci` |
| `apps/web/dist/`、`apps/web/dev-dist/` | 前端构建产物 | `npm run build` |
| `apps/desktop/release/` | 桌面打包产物（数百 MB） | `npm run desktop:dist` |
| `apps/android/app/build/`、`.gradle/`、`.kotlin/` | Gradle 产物与缓存 | `./gradlew assembleRelease` |
| `apps/android/local.properties` | 本机 SDK 路径 | Android Studio 自动生成 |
| `apps/android/keystore.properties`、`*.jks` | 签名密钥 | 用 `keytool` 自行生成 |
| `apps/server/.data/`、`.data/` | SQLite 数据与运行日志 | 首次启动自动创建 |
| `dist-packages/`（`.gitkeep` 除外） | APK / 桌面包 / 源码包 | 构建后放入 |
| `.codebuddy/` | 本地协作记录 | — |
| `capture/`、`*.har`、`*.log` | 调试产物 | — |

> `dist-packages/.gitkeep` 只是占位，保证目录存在；放进去的安装包不会被提交。

---

## 3. 快速开始

### 3.0 用源码包部署（离线分发 / 无内网仓库时）

发布包：`youzhong-<版本>-src.tar.gz`（不含 node_modules、数据库、任何本机凭据）。

```bash
mkdir -p /opt/youzhong && tar -xzf youzhong-<版本>-src.tar.gz -C /opt/youzhong
cd /opt/youzhong
cp .env.example .env        # 至少修改 APP_SECRET、ADMIN_PASSWORD
npm ci                      # Node ≥ 20
npm run build               # 构建网页到 apps/web/dist
npm start                   # 默认 http://0.0.0.0:10078
```

也可以直接在该目录构建镜像（`docker compose up -d --build`），见下节。

### 3.1 Docker 快速开始（推荐有镜像仓库时）

```bash
docker build -t youzhong:1.0.202611081807 .
docker run -d --name youzhong -p 10078:10078 -v youzhong-data:/data \
  -e APP_SECRET='32 位以上随机串' -e ADMIN_PASSWORD='初始密码' \
  youzhong:1.0.202611081807
```

**离线分发（导出 tar.gz）**

```bash
# 导出（单架构：等于构建机 / 你指定的架构）
docker save youzhong:1.0.202611081807 | gzip > youzhong-1.0.202611081807-linux-amd64.tar.gz

# 目标机
docker load < youzhong-1.0.202611081807-linux-amd64.tar.gz
```

> ⚠️ **`docker save` 的包是单架构的，x86 与 ARM 不能通用。**
> 镜像里包含 Node 二进制和 `better-sqlite3` 的原生模块，架构是编译时固定的；
> 把 amd64 的包 `docker load` 到 ARM 机器上能导入，但 `docker run` 会报 `exec format error`，反之亦然。
>
> 镜像 tar 也不是 `deploy/build-package.sh` 产出的——那个脚本打的是**源码包**（纯 JS/TS，
> 目标机 `npm ci` 时按自身架构编译，所以源码包本身就是跨架构通用的）。

按架构构建并导出（推荐）：

```bash
./deploy/build-docker.sh --arch amd64   # → dist-packages/youzhong-image-<ver>-linux-amd64.tar.gz
./deploy/build-docker.sh --arch arm64   # → dist-packages/youzhong-image-<ver>-linux-arm64.tar.gz
./deploy/build-docker.sh --arch both    # 两个都导出
```

ARM 交叉构建需要 QEMU（只需注册一次）：

```bash
docker run --privileged --rm tonistiigi/binfmt --install arm64
docker buildx inspect --bootstrap        # 确认 Platforms 里出现 linux/arm64
```

在线分发用多架构 manifest（`docker pull` 时自动选架构）：

```bash
./deploy/build-docker.sh --push --arch both --image registry.example.com/youzhong
```

**国内网络构建**：官方 `node:22-bookworm-slim` 拉取很慢时，用
`docker build -f docker/Dockerfile.cn -t youzhong:1.0.202611081807 .`
（Node 从 npmmirror 下载、apt 走阿里云源；可用 `--build-arg BASE_IMAGE=...` 换基础镜像）。

### 3.2 直接运行

```bash
# 拉取或自行构建镜像
docker build -t youzhong:1.0.202611081807 .

docker run -d --name youzhong \
  --restart unless-stopped \
  -p 10078:10078 \
  -e APP_SECRET='请换成32位以上随机串' \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD='你的初始密码' \
  -v youzhong-data:/data \
  youzhong:1.0.202611081807
```

打开 `http://服务器IP:10078/`，用上面的管理员账号登录。

### 3.3 用 docker compose（推荐）

```bash
cp .env.example .env        # 可选：compose 会读取同名变量
# 至少修改 APP_SECRET 与 ADMIN_PASSWORD
docker compose up -d --build
docker compose logs -f youzhong   # 查看日志（首次会打印初始化信息）
```

`docker-compose.yml` 里已设置 `restart: unless-stopped`，Docker 启动即自动拉起。

**开机自启（systemd，二选一）**

- 已装 systemd 的 Linux：`restart: unless-stopped` 通常已足够；
- 想显式托管，或机器上 Docker 由 systemd 管理：

```bash
sudo cp deploy/youzhong-docker.service /etc/systemd/system/
sudo sed -i 's#/opt/youzhong#/你的项目路径#' /etc/systemd/system/youzhong-docker.service
sudo systemctl daemon-reload
sudo systemctl enable --now youzhong-docker
sudo systemctl status youzhong-docker
```

### 3.4 数据与安装包

容器把数据放在 `/data`：

- `/data/youzhong.db` — SQLite 数据库（WAL 模式，同目录会有 `-wal` / `-shm`）
- `/data/apk/` — 安卓安装包，放到这里后 `/apk` 页面会自动列出最新包

```bash
# 放入新的 APK
docker cp dist-packages/youzhong-client-1.0.202611081807.apk youzhong:/data/apk/

# 备份数据库
docker exec youzhong sh -c 'sqlite3 /data/youzhong.db ".backup /data/backup.db"' \
  || docker cp youzhong:/data/youzhong.db ./youzhong-backup.db
```

### 3.5 反向代理（可选，走域名 / HTTPS）

nginx 示例（子路径部署时给服务端加 `URL_PREFIX=/youzhong`）：

```nginx
location / {
    proxy_pass http://127.0.0.1:10078;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # SSE 实时通道必须关闭缓冲
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
}
```

> 只要代理不缓冲、`proxy_read_timeout` 足够长，实时同步就能正常工作。

---

## 4. 裸机部署（不用 Docker）

需要 Node.js ≥ 20（推荐 22）。

```bash
npm install
cp .env.example .env         # 修改 APP_SECRET、ADMIN_PASSWORD
npm run build                # 构建前端到 apps/web/dist
npm start                    # 启动服务端（默认 10078）
```

生产环境建议用 systemd：

```bash
sudo cp deploy/youzhong.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now youzhong
```

`deploy/` 目录另有 `install.sh` / `upgrade.sh` / `uninstall.sh` / `nginx.conf.example` 可参考。

开发模式（前后端分离，5173 热更新）：

```bash
npm run dev     # BFF 10078 + Vite 5173
```

---

## 5. 配置项

复制 `.env.example` 为 `.env`，或用同名环境变量（Docker 用 `environment`）。**已存在的环境变量优先，`.env` 不会覆盖。**

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `10078` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `URL_PREFIX` | 空 | 反代子路径，如 `/youzhong`；根路径留空 |
| `TRUST_PROXY` | `false` | 在反向代理后面时设 `true` |
| `ALLOWED_ORIGINS` | 空 | 额外允许的跨域来源，逗号分隔 |
| `APP_VERSION` | `1.0.202611081807` | 设置页与 `/api/version` 显示的版本 |
| `APP_SECRET` | 无 | 渠道 Webhook 加密密钥，**必改** |
| `DB_FILE` | `.data/youzhong.db` | SQLite 路径，容器内为 `/data/youzhong.db` |
| `APK_DIR` | `../../dist-packages` | 安装包目录，容器内为 `/data/apk` |
| `ADMIN_USERNAME` | `admin` | 首次启动创建的管理员用户名 |
| `ADMIN_PASSWORD` | 随机 | 不填则日志打印一次随机密码 |
| `ADMIN_DISPLAY_NAME` | `管理员` | 管理员显示名 |
| `SEED_DEMO` | `false` | 是否为新账号生成 3 条示例任务 |
| `SERVER_NAME` | 内置名称 | App「测试连接」时显示的服务器名 |
| `MAX_USERS` | `10` | 账号数量上限 |

首次登录后请立刻到 **设置 → 账号** 修改密码。

> **版本号规则**：`1.0.YYYYMMDDHHmm`，即「主版本.次版本 + 构建日期时间（到分）」，例如 `1.0.202611081807` 表示 2026-11-07 09:29 构建；界面（网页设置页、安卓设置页、`/api/version`）统一显示为 `1.0 · 2026-11-07 09:29`。

---

## 6. 接口概览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/ping` | 连通性探测（免鉴权） |
| `GET` | `/api/version` | 版本信息与最新安装包（免鉴权） |
| `POST` | `/api/auth/login` | 登录，返回 Bearer token |
| `GET` | `/api/snapshot` | 全量快照（任务 / 清单 / 事件 / 标签 / 设置 / 服务器时间） |
| `POST` | `/api/tasks` `PATCH /api/tasks/:id` `DELETE /api/tasks/:id` | 任务增改删 |
| `GET` | `/api/stream?token=` | **SSE 实时通道**：`snapshot-changed` / `notification` |
| `GET` | `/api/backup/export` | 导出当前账号的完整备份（JSON） |
| `POST` | `/api/backup/restore` | 恢复备份（`merge` 合并 / `replace` 覆盖） |
| `POST` | `/api/backup/webdav` | 服务端代发 WebDAV 备份 / 列表 / 下载 / 删除 |
| `GET` | `/api/apk` | 安装包下载页 |

详细字段见 `docs/api/`。

---

## 7. 安卓客户端

- 安装包：`/apk` 页面下载，或 `dist-packages/youzhong-client-<version>.apk`
- 首次打开填写服务器地址（如 `http://192.168.1.10:10078`），点「测试连接」再登录
- 首页四个 Tab：任务 / 日历 / 四象限 / 我的
- 首次使用建议在「我的」里点：
  1. **允许后台常驻**（跳系统电池白名单，华为还需在「应用启动管理」里允许自启动、关联启动、后台活动）
  2. **发送测试通知**（确认通知权限正常）

自行编译：

```bash
cd apps/android
./gradlew assembleRelease     # 产物：app/build/outputs/apk/release/
```

> 客户端不内置任何服务器地址，部署到哪台机器就填哪台。

---

## 7.1 桌面客户端（Windows / macOS / Linux）

Electron 外壳，直接跑网页端构建产物，功能与网页版一致；额外提供窗口记忆、托盘、开机自启、系统通知、
站外链接走系统浏览器、下载跟随系统等本地能力。

- 免安装包：`dist-packages/youzhong-desktop-<version>-x64.zip`，解压双击 `Youzhong.exe`
- 下载入口：网页端「设置 → 版本与更新 → Windows 客户端」直接下载（服务端 `dist-packages/` 里放 zip 即可）
- 首次运行用菜单「文件 → 服务器地址…」填服务端地址（如 `http://192.168.1.10:10078` 或 `https://域名/youzhong`），保存后自动重载
- **系统通知**：服务端 SSE 推来的提醒会弹 Windows 通知，窗口最小化到托盘也能弹，点击回到窗口；
  配合「开机自动启动」（自启时只驻留托盘）即可常驻提醒
- 菜单里可开关「最小化到托盘」「开机自动启动」，`F12` 打开调试

自行构建：

```bash
npm install
npm run desktop              # 开发运行（本地静态服务 + 窗口）
npm run desktop:dist         # Windows 上出 nsis 安装包 + portable 单文件
npm run desktop:dist:zip     # Linux/macOS 上交叉构建免安装 zip
```

细节见 [`apps/desktop/README.md`](apps/desktop/README.md)。

---

### 同步到手机系统日历（安卓）

「我的 → 同步到手机日历」：

- 打开开关会先申请日历读写权限，然后列出系统里可写的日历（Google / 华为 / 本地账户），选一个即可
- 每天 **03:00** 自动执行；夜里关机的话，开机后补跑一次（全量重建，幂等）
- 范围可选 3 / 7 / 14 / 30 天（默认 7 天）
- 只导出「未完成 + 有截止时间」的任务：全天任务写全天事件，定时任务按 30 分钟
- **全量重建**：先删掉上次由有终写入的条目（描述前缀 `[有终]`），再按最新任务重写；任务改名、改期、完成后都会同步反映
- 你手工创建的系统日程不会被删除，其它日历也不会被动到
- 「立即同步」可随时手动触发，卡片下方显示上次同步时间、写入条数与错误信息

## 8. 备份与升级

**网页端 WebDAV 备份（推荐个人用户）**

设置 → 数据与缓存 → WebDAV 备份，填入自己的 WebDAV（坚果云、Nextcloud、群晖 / 威联通 NAS 等）与目录后：

- 「立即备份」：把当前账号的清单、任务（含子任务 / 提醒 / 重复规则）、日程、标签、设置打包成 JSON 上传；
- 「备份列表 / 恢复」：换服务器后在新服务器登录，填同一份 WebDAV 即可挑一个备份恢复；
  恢复方式可选 **合并**（保留现有数据、同名清单复用）或 **覆盖**（先清空当前账号数据）；
- 页面同时提供「导出到本地 / 从文件恢复」，没有 WebDAV 也能手动搬家；
- 账号密码只保存在本机浏览器，上传请求由服务端转发（浏览器直连 WebDAV 会被 CORS 拦住）。

> 服务端需要能访问你的 WebDAV 地址；如果 WebDAV 在公网、服务器在家庭内网，请确认出网正常。

**数据库级备份**：定期复制 `youzhong.db`（连同 `-wal`），或在容器里用 SQLite 在线备份：

```bash
docker exec youzhong node -e "const D=require('/app/node_modules/better-sqlite3');new D('/data/youzhong.db').backup('/data/backup-'+Date.now()+'.db').then(()=>console.log('ok'))"
```

**升级**：

```bash
git pull
docker compose up -d --build      # 或 npm install && npm run build && 重启服务
```

数据库结构变更由启动时的 schema 迁移自动完成，升级前建议先备份。

---

## 9. 常见问题

**页面能打开但数据不刷新**
浏览器按 `Ctrl+Shift+R` 强刷；或检查 `/api/health` 里 `streams` 是否 ≥ 1。

**提醒到点没响**
1. 看服务端日志是否有 `[task~]` 记录，确认提醒时间正确写入；
2. 手机设置页看「设备比服务器慢/快 N 分钟」——设备时钟偏差过大时会偏移，建议开启自动设置时间；
3. 确认 App 通知权限、电池白名单。

**子路径 /youzhong 部署**
设 `URL_PREFIX=/youzhong`，nginx 原样透传前缀即可，服务端会自动剥离。

**多用户**
管理员在 设置 → 成员管理 创建账号，上限由 `MAX_USERS` 控制。

---

## 10. 许可与声明

本项目以 [MIT](./LICENSE) 许可证开源，可自由使用、修改与分发（保留版权与许可声明）。第三方组件的许可证见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)，数据处理方式见 [隐私说明](./docs/PRIVACY.md)。

本项目为独立实现，与任何第三方商业产品、其运营方均无关联，也未获得其授权或背书；项目代码、界面元素与数据结构均为自行编写，不包含任何第三方的源代码、素材或商标。请勿将本项目名称、标识用于暗示与第三方产品存在关联。

### 商标与名称声明

[MIT](./LICENSE) 许可证仅覆盖本项目的代码与文档，**不授予「有终」「Youzhong」名称、Logo、图标及其他品牌标识的任何使用权**：

- 你可以自由使用、修改、分发本项目代码，包括闭源二次开发、销售或提供 SaaS 服务；但不得使用本项目名称、Logo 或近似标识来命名、包装、宣传你的产品或服务，也不得明示或暗示与本项目、本项目作者存在授权、背书、官方或关联关系。
- 基于本项目再分发时请自行取名并使用自有标识；作说明性、事实性引用（如「基于有终 Youzhong 构建」）不受限制，但不得造成来源混淆。
- 任何人基于本项目开展的商业行为，其产品责任、合规义务与宣传内容均由该行为人自行承担，与本项目作者无关。
- 本项目目前未就名称申请注册商标，也不以该名称对外提供商品或服务；名称仅用于标识代码仓库。未注册不代表放弃在《反不正当竞争法》等法律下对名称、标识及商品/服务来源享有的权益。

如你是权利人并认为本项目存在问题，请通过 Issue 联系，我们会及时处理。
