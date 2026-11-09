# 仓库文件说明（File Guide）

> 本文件逐一说明仓库中**纳入版本控制的全部 177 个文件（含本文件）**（2026-11-09，`main` 分支）。
> 目录树概览见 [README §2 架构](../README.md)，接口契约见 [API 文档索引](./api/README.md)，数据处理见 [隐私说明](./PRIVACY.md)。
>
> **标记含义**：`配置` 需按部署环境调整 · `模板` 复制后使用 · `生成` 由工具生成、不要手改 · `文档` 说明性文件 · `占位` 仅为保持目录存在 · `源码` 可自由修改。
> 未纳入版本库的文件列在文末，它们的缺失是**故意的**。

## 建议的阅读顺序

1. `README.md` → `packages/shared/src/types.ts`：先知道系统做什么、数据长什么样。
2. `apps/server/src/index.ts` → `src/routes/*`：服务端如何组装、有哪些接口。
3. `apps/web/src/main.tsx` → `store/*` → `sync/*`：网页端如何加载、缓存与同步。
4. `apps/android/app/src/main/java/com/youzhong/app/data/Api.kt` 与同目录的 `LiveStream.kt`：安卓端使用同一套契约。
5. `Dockerfile` + `docker-compose.yml` + `docker/entrypoint.sh`：怎么跑起来。
6. `deploy/`：不用 Docker 时的裸机与容器常驻方案。

---

## 根目录（12）

| 文件 | 作用 | 标记 |
| --- | --- | --- |
| `.dockerignore` | 构建镜像时排除 `node_modules`、`dist`、桌面打包产物与本机数据，避免本地文件进入镜像上下文 | 配置 |
| `.env.example` | 配置模板：端口、反向代理子路径、`APP_SECRET`、数据库与安装包目录、首次启动管理员等，值全为占位 | 模板 → 复制为 `.env` |
| `.gitignore` | 排除凭据、数据库、构建产物、签名密钥、抓包文件、`.codebuddy/` 等，防止公开发布时泄露 | 配置 |
| `.nvmrc` | 指定 Node `22.23.4`，供 nvm 与部署脚本使用 | 配置 |
| `Dockerfile` | 三阶段镜像：`deps`（`npm ci` 并允许编译原生模块）→ `build`（构建网页）→ `runtime`（非 root 运行、健康检查） | 配置 |
| `LICENSE` | MIT 许可证全文，版权归 `Youzhong contributors`；是自由使用、商用与闭源分发的依据 | 法律 |
| `README.md` | 主文档：功能、架构、四种部署方式、配置项、客户端、备份升级、许可与商标声明 | 文档 |
| `THIRD-PARTY-NOTICES.md` | 第三方依赖清单与许可证（MIT / ISC / Apache-2.0 / BSD 等），履行 Apache-2.0 署名与许可保留义务 | 法律 |
| `docker-compose.yml` | 单服务编排：镜像、端口、环境变量、数据卷、健康检查；`APP_SECRET` 与 `ADMIN_PASSWORD` 需覆盖 | 配置 |
| `package-lock.json` | npm 锁定的完整依赖树，`npm ci` 的依据，保证各环境安装结果一致 | 生成 |
| `package.json` | workspace 根：声明 `apps/*` 与 `packages/*`，提供 `typecheck` / `build` / `desktop` 等脚本 | 配置 |
| `tsconfig.base.json` | 共享 TypeScript 编译选项，各子包 `extends` 后只写自己的差异 | 配置 |

---

## `apps/server/` — Node 服务端（25）

Express + SQLite（`better-sqlite3`），单端口同时提供 API、SSE 与网页静态资源。

| 文件 | 作用 | 标记 |
| --- | --- | --- |
| `package.json` | 服务端依赖与 `start` / `typecheck` 脚本，包名 `@youzhong/server` | 配置 |
| `reset-password.ts` | 本地应急脚本：忘记密码时命令行重置指定账号的密码 | 源码 |
| `src/index.ts` | 应用入口：加载 `.env`、装配中间件与全部路由、托管 `apps/web/dist`、处理 `URL_PREFIX` 子路径 | 源码 |
| `src/lib/env.ts` | 极简 `.env` 读取（无第三方依赖），必须是入口的第一条 import，确保后续模块读到最终环境变量 | 源码 |
| `src/lib/errors.ts` | 统一错误类型与错误中间件：只返回结构化错误，不把 Cookie 等敏感信息带进响应 | 源码 |
| `src/lib/security.ts` | 密码 scrypt 加盐哈希、会话 token、`APP_SECRET` 派生密钥、渠道密钥 AES-256-GCM 加解密 | 源码 |
| `src/middleware/auth.ts` | 从 Cookie / Authorization 取会话令牌并校验；兼容新旧两种 Cookie 名 | 源码 |
| `src/db/index.ts` | 打开 SQLite、按 `user_version` 顺序执行迁移；新版库名找不到时自动沿用旧版数据文件 | 源码 |
| `src/db/schema.sql` | 表结构：用户、清单、任务、日程、标签、设置、通知、渠道、会话等 | 源码 |
| `src/db/repositories.ts` | 所有 SQL 的集合，按 `users` / `tasks` / `projects` / `events` 等分组，路由只调这里 | 源码 |
| `src/events.ts` | SSE 实时通道：数据变更广播 `snapshot-changed`，通知事件广播 `notification`，并统计连接数 | 源码 |
| `src/services/bootstrap.ts` | 首次启动创建管理员（未设密码则打印随机密码）、新账号种子数据与示例任务 | 源码 |
| `src/routes/ping.ts` | `/api/ping` 与 `/api/version`，免鉴权，供各端「测试连接」与版本对比 | 源码 |
| `src/routes/auth.ts` | 登录 / 登出 / 当前用户；签发会话 Cookie，登出同时清理新旧 Cookie 名 | 源码 |
| `src/routes/data.ts` | `GET /api/snapshot`：一次返回该用户全部清单、任务、日程、标签与设置 | 源码 |
| `src/routes/write.ts` | 任务 / 清单 / 日程 / 标签的增改删，写成功后触发 SSE 广播与提醒重算 | 源码 |
| `src/routes/settings.ts` | 用户个性化设置的读取与保存 | 源码 |
| `src/routes/admin.ts` | 管理员专享：成员列表、创建 / 停用账号、重置密码 | 源码 |
| `src/routes/channels.ts` | 通知渠道（钉钉 / 飞书 Webhook）的增删改查与测试发送 | 源码 |
| `src/routes/notifications.ts` | 通知列表与已读标记，安卓后台按 `since` 增量拉取 | 源码 |
| `src/routes/backup.ts` | 全量 JSON 导出 / 导入恢复，以及 WebDAV 云备份相关接口 | 源码 |
| `src/routes/apk.ts` | `/apk` 下载页：从 `APK_DIR` 列出最新安装包，跟随主服务端口 | 源码 |
| `src/notify/dispatcher.ts` | 定时扫描到期提醒，把一条通知分发到该用户订阅的全部渠道 | 源码 |
| `src/notify/providers.ts` | 钉钉加签 markdown、飞书可选签名文本消息的具体发送实现 | 源码 |
| `tsconfig.json` | 服务端 TypeScript 配置，继承根 `tsconfig.base.json` | 配置 |

---

## `apps/web/` — 网页端 / PWA（62）

React + Vite + Tailwind + Zustand + Dexie，构建产物由服务端直接托管。

| 文件 | 作用 | 标记 |
| --- | --- | --- |
| `index.html` | HTML 骨架：标题、描述、主题色、PWA 相关 meta，挂载 `#root` | 配置 |
| `package.json` | 网页端依赖与 `build` / `dev` / `typecheck` 脚本，包名 `@youzhong/web` | 配置 |
| `vite.config.ts` | Vite 构建、开发代理、子路径 `VITE_BASE_PATH`、PWA manifest 与 Service Worker 配置 | 配置 |
| `tailwind.config.ts` | Tailwind 主题：主色走 CSS 变量，保证整套品牌色可切换 | 配置 |
| `postcss.config.js` | 启用 Tailwind 与 autoprefixer | 配置 |
| `tsconfig.json` | 网页端 TS 配置（JSX、DOM 类型、路径别名 `@/`） | 配置 |
| `public/icon.svg` | PWA 图标：米色底 + 朱红印章 +「终」字 | 素材 |
| `public/icon-maskable.svg` | PWA maskable 图标，印章收进安全区避免被系统裁切 | 素材 |
| `src/index.css` | 全局样式、深浅色与品牌色 CSS 变量兜底、滚动条与动画 | 源码 |
| `src/env.d.ts` | Vite 环境类型声明与构建时间戳类型，便于排查缓存 | 配置 |
| `src/main.tsx` | 入口：迁移旧版本本地存储与 IndexedDB、注册 Service Worker 自更新、挂载 React | 源码 |
| `src/App.tsx` | 路由、登录态分流、主题初始化与全局弹层 | 源码 |
| `src/api/http.ts` | 统一请求封装：服务器地址持久化、token、超时、错误归一化、子路径拼接 | 源码 |
| `src/api/client.ts` | 快照拉取与通用 API 调用入口，并处理 401 跳登录 | 源码 |
| `src/api/adapters.ts` | 把服务端返回的数据归一化成共享类型，字段缺失/类型漂移都在此收敛 | 源码 |
| `src/api/auth.ts` | 登录、当前用户、设置、成员管理等鉴权相关请求 | 源码 |
| `src/api/backup.ts` | 备份导出 / 恢复与 WebDAV 配置的请求封装 | 源码 |
| `src/api/mutations.ts` | 新建任务等写操作的请求构造与乐观更新入口 | 源码 |
| `src/api/stream.ts` | SSE 客户端：收到 `snapshot-changed` 静默刷新，收到 `notification` 直接提示 | 源码 |
| `src/db/dexie.ts` | IndexedDB：缓存快照与离线待重放队列；含旧库 `dida` → `youzhong` 数据迁移 | 源码 |
| `src/store/app.ts` | 核心数据状态：清单、任务、日程、标签及快照写入 | 源码 |
| `src/store/auth.ts` | 登录态、token、用户信息的持久化 | 源码 |
| `src/store/ui.ts` | 界面偏好：主题、排序、视图、四象限规则等，localStorage 持久化 | 源码 |
| `src/store/selectors.ts` | 派生选择器：今天 / 最近 7 天 / 收件箱 / 已完成等智能清单与筛选排序 | 源码 |
| `src/sync/queue.ts` | 离线写队列：同一任务只保留最后一次写入，指数退避重放 | 源码 |
| `src/sync/useSync.ts` | 同步编排：拉取快照、重放队列、对外暴露 `triggerSync()` | 源码 |
| `src/components/BrandMark.tsx` | 品牌标识组件（「终」字已转 path，避免字体差异） | 源码 |
| `src/components/ui/primitives.tsx` | 通用基础组件：Button / Input / Segmented / Textarea 等 | 源码 |
| `src/components/ui/overlay.tsx` | Popover / Modal 等浮层组件 | 源码 |
| `src/components/ui/toast.tsx` | 全局轻提示（info / success / error） | 源码 |
| `src/layouts/DesktopShell.tsx` | 桌面宽屏布局：侧边栏 + 主区 | 源码 |
| `src/layouts/MobileShell.tsx` | 移动窄屏布局：底部导航 + 单栏 | 源码 |
| `src/layouts/Sidebar.tsx` | 侧边栏：智能清单、项目树、搜索、同步与退出入口 | 源码 |
| `src/hooks/useBreakpoint.ts` | 响应式断点判断（移动端 768px、平板 1120px） | 源码 |
| `src/lib/theme.ts` | 品牌色预设与明暗主题计算，写入 CSS 变量 | 源码 |
| `src/lib/utils.ts` | 通用工具：className 合并、颜色转换、24 位十六进制任务 id 生成 | 源码 |
| `src/lib/version.ts` | 把 `1.0.202611081807` 格式化成可读版本与构建时间 | 源码 |
| `src/pages/LoginPage.tsx` | 登录页：服务器地址、账号密码、测试连接 | 源码 |
| `src/pages/TaskViewPage.tsx` | 任务视图页：今天 / 最近 7 天 / 笔记本 / 已完成等，按路由切换 | 源码 |
| `src/pages/CalendarPage.tsx` | 日历页：月视图与时间网格视图切换 | 源码 |
| `src/pages/QuadrantPage.tsx` | 四象限页：规则选择、拖拽分格 | 源码 |
| `src/pages/SettingsPage.tsx` | 设置页：外观、通知、备份、成员管理、版本与更新 | 源码 |
| `src/features/auth/ServerAddressField.tsx` | 服务器地址输入与「测试连接」状态反馈 | 源码 |
| `src/features/calendar/EventEditor.tsx` | 日程新建 / 编辑表单 | 源码 |
| `src/features/calendar/MiniCalendar.tsx` | 日期选择用的小日历浮层 | 源码 |
| `src/features/calendar/MonthView.tsx` | 月视图：按天铺任务与日程 | 源码 |
| `src/features/calendar/TimeGridView.tsx` | 时间网格视图：按小时排布，双击空白新建日程、重叠分列 | 源码 |
| `src/features/projects/ProjectTree.tsx` | 清单树：新建、重命名、删除与切换 | 源码 |
| `src/features/quadrant/QuadrantBoard.tsx` | 四象限看板：按规则计算落格并支持拖拽 | 源码 |
| `src/features/quadrant/QuadrantCard.tsx` | 象限内任务卡片与拖拽封装 | 源码 |
| `src/features/search/SearchPanel.tsx` | 全局搜索面板 | 源码 |
| `src/features/settings/BackupPanel.tsx` | 数据导出 / 恢复与 WebDAV 备份配置 | 源码 |
| `src/features/settings/ChannelDialog.tsx` | 钉钉 / 飞书通知渠道的添加与编辑弹窗 | 源码 |
| `src/features/settings/NotificationPanel.tsx` | 通知渠道列表与测试发送 | 源码 |
| `src/features/settings/UserManager.tsx` | 成员管理：创建、停用、重置密码 | 源码 |
| `src/features/tasks/QuickAdd.tsx` | 顶部快速添加输入框 | 源码 |
| `src/features/tasks/quickParse.ts` | 自然语言解析：今天/明天/周三、时间、`!高`、优先级等，仅做本地预填 | 源码 |
| `src/features/tasks/TaskList.tsx` | 任务列表与智能分组（今天、最近 7 天、笔记本等） | 源码 |
| `src/features/tasks/TaskRow.tsx` | 单条任务行：完成勾选、优先级、日期、「安排」入口 | 源码 |
| `src/features/tasks/TaskDetail.tsx` | 任务详情抽屉：标题、备注、子任务、标签、提醒、重复 | 源码 |
| `src/features/tasks/PropertyRows.tsx` | 详情里的属性行（优先级、日期、清单、标签等） | 源码 |
| `src/features/tasks/SchedulePopover.tsx` | 「安排」浮层：给临时记录补日期 / 提醒 / 转清单 | 源码 |

---

## `apps/android/` — 安卓客户端（36）

原生 Kotlin + Jetpack Compose，不使用 WebView，只通过 `/api` 与服务端通信。

| 文件 | 作用 | 标记 |
| --- | --- | --- |
| `README.md` | 安卓端说明：构建、签名、包名、安装与功能清单 | 文档 |
| `build.gradle.kts` | 顶层 Gradle 构建配置与插件版本 | 配置 |
| `settings.gradle.kts` | 仓库与模块声明，含国内 Maven 镜像 | 配置 |
| `gradle.properties` | Gradle / AndroidX / Kotlin 编译参数 | 配置 |
| `gradle/wrapper/gradle-wrapper.jar` | Gradle Wrapper 引导程序（二进制） | 生成 |
| `gradle/wrapper/gradle-wrapper.properties` | 指定 Gradle 发行版与下载地址 | 配置 |
| `gradlew` | Linux/macOS 的 Gradle Wrapper 启动脚本 | 生成 |
| `gradlew.bat` | Windows 的 Gradle Wrapper 启动脚本 | 生成 |
| `app/build.gradle.kts` | 应用模块：`applicationId`、SDK 版本、依赖、签名配置与打包排除项 | 配置 |
| `app/src/main/AndroidManifest.xml` | 权限（网络、通知、精确闹钟、前台服务、开机自启、系统日历等）与组件声明 | 配置 |
| `app/src/main/assets/third-party-notices.txt` | 随 APK 打包的第三方组件许可清单，满足 Apache-2.0 署名义务 | 法律 |
| `app/src/main/res/drawable/ic_launcher.xml` | 启动图标：米色底 + 朱红印章 +「终」字（字形转 path） | 素材 |
| `app/src/main/res/values/strings.xml` | 应用名与界面字符串 | 资源 |
| `app/src/main/res/values/themes.xml` | 启动主题与状态栏样式 | 资源 |
| `app/src/main/java/com/youzhong/app/MainActivity.kt` | 唯一 Activity：权限申请、主题应用、Compose 入口 | 源码 |
| `app/src/main/java/com/youzhong/app/YouzhongApp.kt` | `Application` 子类：初始化通知渠道、前台服务与后台任务 | 源码 |
| `app/src/main/java/com/youzhong/app/data/Api.kt` | Retrofit/OkHttp 请求封装、服务器地址与 token 持久化、401 统一处理 | 源码 |
| `app/src/main/java/com/youzhong/app/data/Models.kt` | 与共享类型对应的 Kotlin 数据类（kotlinx.serialization） | 源码 |
| `app/src/main/java/com/youzhong/app/data/LiveStream.kt` | SSE 客户端与全局刷新事件总线 | 源码 |
| `app/src/main/java/com/youzhong/app/service/LiveService.kt` | 常驻前台服务，持有 SSE 长连接，提醒由服务端准点推送 | 源码 |
| `app/src/main/java/com/youzhong/app/notify/Notifier.kt` | 通知渠道创建与通知展示 | 源码 |
| `app/src/main/java/com/youzhong/app/notify/ReminderAlarm.kt` | AlarmManager 精确调度提醒，含「设备与服务器时钟偏差」计算 | 源码 |
| `app/src/main/java/com/youzhong/app/work/DueCheckWorker.kt` | 后台兜底：增量拉取通知、检查到期任务并触发提醒 | 源码 |
| `app/src/main/java/com/youzhong/app/work/CalendarExportWorker.kt` | 每日把未来 N 天未完成任务写入用户指定的系统日历，只删自己写入的条目 | 源码 |
| `app/src/main/java/com/youzhong/app/calendar/SystemCalendar.kt` | 系统日历 ContentProvider 读写封装与权限检查 | 源码 |
| `app/src/main/java/com/youzhong/app/calendar/CalendarSyncStore.kt` | 「同步到手机日历」开关与上次同步结果的本地持久化 | 源码 |
| `app/src/main/java/com/youzhong/app/ui/Brand.kt` | Compose 版品牌标识，与网页端 / 图标视觉一致 | 源码 |
| `app/src/main/java/com/youzhong/app/ui/Common.kt` | 通用组件与主题调色板 | 源码 |
| `app/src/main/java/com/youzhong/app/ui/ThemeState.kt` | 主题偏好（跟随系统 / 浅色 / 深色）持久化 | 源码 |
| `app/src/main/java/com/youzhong/app/ui/LoginScreen.kt` | 登录页：服务器地址、账号密码、测试连接 | 源码 |
| `app/src/main/java/com/youzhong/app/ui/MainScreen.kt` | 主框架：底部导航与各页面容器 | 源码 |
| `app/src/main/java/com/youzhong/app/ui/CalendarScreen.kt` | 日历视图 | 源码 |
| `app/src/main/java/com/youzhong/app/ui/QuadrantScreen.kt` | 四象限视图 | 源码 |
| `app/src/main/java/com/youzhong/app/ui/TaskDetailScreen.kt` | 任务详情编辑 | 源码 |
| `app/src/main/java/com/youzhong/app/ui/SettingsScreen.kt` | 设置页：服务器、主题、通知、日历同步、版本与电池优化 | 源码 |
| `app/src/main/java/com/youzhong/app/ui/QuickParse.kt` | 与网页端行为一致的自然语言快速添加解析 | 源码 |

> 安卓源码统一位于 `app/src/main/java/com/youzhong/app/`，下表已写全路径。

---

## `apps/desktop/` — Electron 桌面客户端（10）

复用 `apps/web/dist`，用本地静态服务托管，不改动业务逻辑。

| 文件 | 作用 | 标记 |
| --- | --- | --- |
| `README.md` | 桌面端说明：开发运行、打包、菜单与服务器地址配置 | 文档 |
| `package.json` | Electron / electron-builder 依赖、`dist` 系列脚本与应用元信息 | 配置 |
| `resources/icon.png` | 打包用的 512×512 图标源文件 | 素材 |
| `scripts/make-icon.cjs` | 用 Electron 自带 Chromium 把网页端 SVG 栅格化为 PNG，供生成 ico / icns | 生成 |
| `src/main.cjs` | 主进程：窗口、托盘、开机自启、菜单、系统通知、站外链接走系统浏览器 | 源码 |
| `src/server.cjs` | 本地静态服务器，以 `http://127.0.0.1:随机端口` 提供打包进来的网页端 | 源码 |
| `src/preload.cjs` | 主窗口预加载：只暴露只读信息、通知与「打开服务器设置」，不放开文件/网络能力 | 源码 |
| `src/settings-preload.cjs` | 设置窗口预加载：服务器地址的读取与保存 | 源码 |
| `src/config.cjs` | 用户数据目录下的 `config.json` 读写（服务器地址、窗口状态等） | 源码 |
| `src/settings.html` | 「服务器地址」设置窗口页面 | 源码 |

---

## `packages/shared/` — 前后端共享领域模型（6）

服务端、网页端、安卓端（Kotlin 侧手工对齐）共同依赖的字段与规则定义。

| 文件 | 作用 | 标记 |
| --- | --- | --- |
| `package.json` | 包名 `@youzhong/shared`，声明 MIT 与 ESM 导出 | 配置 |
| `src/index.ts` | 统一导出入口，其他包只从这里引用 | 源码 |
| `src/types.ts` | 领域模型唯一真源：Task / Project / CalendarEvent / Tag / User / Settings / Snapshot 等 | 源码 |
| `src/date.ts` | 无第三方依赖的日期解析与格式化，统一 `2026-11-02T19:00:00.000+0800` 格式 | 源码 |
| `src/quadrantRules.ts` | 两套内置四象限规则（象限↔优先级、象限↔紧急度）与象限元数据 | 源码 |
| `src/repeat.ts` | RRULE 片段解析与「下一次到期时间」计算，含月末对齐 | 源码 |

---

## `deploy/` — 部署与运维脚本（13）

裸机 systemd 部署、源码包构建、Docker 镜像导出，以及无 systemd 容器内的常驻守护方案。

| 文件 | 作用 | 标记 |
| --- | --- | --- |
| `README.md` | Ubuntu 部署手册：安装目录、配置项、systemd、备份、容器内常驻与故障排查 | 文档 |
| `install.sh` | 裸机安装：创建系统用户、复制程序、生成随机 `APP_SECRET` 与管理员密码、注册 systemd 服务 | 脚本·需 root |
| `upgrade.sh` | 升级：先备份数据库，停服务、替换程序文件、重建依赖后启动 | 脚本·需 root |
| `uninstall.sh` | 卸载：默认保留数据库，加 `--purge` 才删除数据（不可恢复） | 脚本·需 root |
| `youzhong.service` | systemd 单元：以系统用户运行 Node 服务端 | 配置 |
| `youzhong-docker.service` | systemd 单元：开机拉起 `docker compose up -d` | 配置 |
| `nginx.conf.example` | 反向代理示例：根路径与子路径 `/youzhong` 两种写法，含 SSE 透传设置 | 模板 |
| `build-package.sh` | 打包**源码包** `dist-packages/youzhong-server-<版本>.tar.gz`（纯 JS/TS，跨 CPU 架构通用） | 脚本 |
| `build-docker.sh` | 按架构构建并导出**镜像包**（`--arch amd64` / `arm64` / `both` / `--push` 多架构 manifest） | 脚本 |
| `start-dida.sh` | 应用守护：崩溃重启（指数退避）、卡死自愈、单实例锁、日志轮转；文件名是旧名残留，容器内常复制为 `scripts/start-dida.sh` | 脚本 |
| `youzhong-init.sh` | 容器重建后的幂等初始化：补齐 `.env`、sshd、nginx、依赖、应用与巡检 | 脚本·含环境路径 |
| `youzhong-bootstrap.sh` | 容器启动一键拉起 sshd + nginx + 应用守护 + 巡检（供 `.bashrc` / `@reboot` 调用） | 脚本 |
| `youzhong-watchdog.sh` | 每 30 秒巡检 sshd / nginx / 应用，掉线自动拉起 | 脚本 |

> `youzhong-init.sh`、`youzhong-bootstrap.sh`、`youzhong-watchdog.sh`、`start-dida.sh` 里的 `/n3_storage/...` 是示例部署路径，可用 `APP_ROOT` / `NODE_HOME` 覆盖；它们不是凭据，但公开仓库会暴露部署拓扑。

---

## `docker/` — 容器辅助（2）

| 文件 | 作用 | 标记 |
| --- | --- | --- |
| `Dockerfile.cn` | 国内网络兜底构建：不依赖 Docker Hub 的 Node 官方镜像，Node 从 npmmirror 下载、apt 走阿里云源 | 配置 |
| `entrypoint.sh` | 容器入口：准备数据目录、检查 `APP_SECRET` / `ADMIN_PASSWORD`、兼容旧版数据库文件名，然后 `exec` 启动命令 | 脚本 |

---

## `docs/` — 文档与素材（8）

| 文件 | 作用 | 标记 |
| --- | --- | --- |
| `PRIVACY.md` | 隐私说明：收集哪些数据、存在哪里、不上传什么、用户如何导出与删除 | 文档 |
| `docs/FILE-GUIDE.md` | 本文件：仓库全部文件的逐条说明 | 文档 |
| `logo.svg` | 项目图标源文件（米色底 + 朱红印章 +「终」字），README 与各端图标都由此派生 | 素材 |
| `api/README.md` | 自有 API 文档索引与通用约定（鉴权、时间格式、错误结构） | 文档 |
| `api/server-api.md` | 服务端接口清单（v3 多用户）：鉴权、快照、写接口、备份、管理 | 文档 |
| `api/tasks.md` | 任务字段、子任务、完成/取消完成与写接口说明 | 文档 |
| `api/calendar.md` | 日程字段、数据来源与写接口说明 | 文档 |
| `api/quadrant.md` | 四象限是前端派生视图的结论与两套内置规则 | 文档 |

---

## `scripts/` — 本地脚本（2）

| 文件 | 作用 | 标记 |
| --- | --- | --- |
| `serve.sh` | 本地 / 裸机前台启动服务端（自动选 nvm 的 Node、设置默认 `APP_SECRET` 与端口） | 脚本 |
| `upload-release.sh` | 把 `dist-packages/` 下的安装包上传到服务器，链路慢时自动分片、重试与 md5 校验 | 脚本 |

---

## `dist-packages/`（1）

| 文件 | 作用 | 标记 |
| --- | --- | --- |
| `.gitkeep` | 仅保持目录存在；APK、桌面 zip、源码包等构建产物由 `.gitignore` 排除，不会入库 | 占位 |

---

## 未纳入版本库的文件（故意缺失）

| 路径 | 为什么不放进仓库 | 怎么得到 |
| --- | --- | --- |
| `.env` / `.env.*` | 本机凭据（`APP_SECRET`、管理员密码等） | `cp .env.example .env` 后填写 |
| `node_modules/` | 第三方依赖 | `npm ci` |
| `apps/web/dist/`、`apps/web/dev-dist/` | 前端构建产物 | `npm run build` |
| `apps/desktop/release/` | 桌面打包产物（数百 MB） | `npm run desktop:dist` |
| `apps/android/app/build/`、`.gradle/`、`.kotlin/` | Gradle 产物与缓存 | `./gradlew assembleRelease` |
| `apps/android/local.properties` | 本机 Android SDK 路径 | Android Studio 自动生成 |
| `apps/android/keystore.properties`、`*.jks` | 应用签名密钥（泄露即可冒名签包） | `keytool` 自行生成 |
| `apps/server/.data/`、`.data/` | SQLite 数据库与运行日志 | 首次启动自动创建 |
| `dist-packages/*`（`.gitkeep` 除外） | APK / 桌面包 / 源码包 | 构建后放入 |
| `deploy/authorized_keys`、`deploy/nginx.container.conf` | 部署现场的 SSH 公钥与真实 nginx 配置 | 部署时自行放置 |
| `.codebuddy/`、`capture/`、`*.har`、`*.log` | 本地协作记录与调试产物 | — |

---

## 维护提示

- 新增文件时请在本文件补一行，并按目录归到对应表格；删除文件同样同步。
- 公开仓库新增任何文件前，先确认不属于上表「未纳入」清单。
- 安卓与桌面端各自有 `README.md`，详见其中的构建与签名说明。

