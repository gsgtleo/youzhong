# 第三方组件许可声明（Third-Party Notices）

本项目自身代码以仓库根目录 `LICENSE` 中的许可证发布。
下列第三方组件随本项目使用或随发行包分发，其版权归各自作者所有，遵循各自的许可证。

## 服务端 / 网页端（npm 依赖）

全部依赖均为宽松许可（MIT / ISC / Apache-2.0 / BSD / 0BSD / BlueOak-1.0.0），不含 GPL / AGPL / SSPL 等 copyleft 许可。

| 组件 | 许可证 | 用途 |
| --- | --- | --- |
| express | MIT | HTTP 服务 |
| better-sqlite3 | MIT | SQLite 绑定 |
| tsx / typescript | MIT / Apache-2.0 | 运行时与类型检查 |
| react / react-dom / react-router-dom | MIT | 网页端 UI |
| zustand | MIT | 状态管理 |
| dexie | Apache-2.0 | IndexedDB 封装 |
| @dnd-kit/* | MIT | 拖拽 |
| tailwindcss / tailwind-merge / tailwindcss-animate | MIT | 样式 |
| clsx | MIT | 类名拼接 |
| lucide-react | ISC | 图标 |
| vite / @vitejs/plugin-react / vite-plugin-pwa | MIT | 构建 |
| workbox-* | MIT | PWA 缓存 |

完整依赖树与版本见 `package-lock.json`；安装后可通过 `npx license-checker --summary` 复核。

## 安卓客户端（Gradle 依赖）

| 组件 | 许可证 | 用途 |
| --- | --- | --- |
| AndroidX（core-ktx / activity-compose / lifecycle / navigation / datastore / work-runtime） | Apache-2.0 | 基础框架 |
| Jetpack Compose（ui / material3 / material-icons-extended） | Apache-2.0 | UI 与图标 |
| OkHttp / logging-interceptor | Apache-2.0 | HTTP |
| Retrofit / retrofit2-kotlinx-serialization-converter | Apache-2.0 | 接口层 |
| kotlinx.serialization | Apache-2.0 | JSON |

Apache-2.0 组件分发时需保留其许可证与 NOTICE。本仓库的 `apps/android/app/src/main/assets/third-party-notices.txt`
会随 APK 一起打包，供终端用户查阅。

## 桌面端（Electron）

| 组件 | 许可证 | 用途 |
| --- | --- | --- |
| Electron 33 | MIT | 桌面运行时 |
| electron-builder | MIT | 打包与产物生成 |
| cross-env | MIT | 构建脚本环境变量 |

Electron 发行包内含 Chromium 及其第三方组件，相关许可证文本随安装包一起分发：
安装目录下的 `LICENSE.electron.txt` 与 `LICENSES.chromium.html`。
Chromium 内置的 ffmpeg 包含 H.264 / AAC 等编解码实现，涉及第三方专利许可，使用者应自行评估分发范围。

本项目自身的 `LICENSE` 与 `THIRD-PARTY-NOTICES.md` 也会被打进桌面安装包的 `resources/` 目录。

## 图标与素材

- 网页端 `apps/web/public/icon.svg`、`icon-maskable.svg` 与安卓端 `ic_launcher.xml` 均为本项目自绘，未使用第三方图形素材。
- 界面图标来自 lucide（ISC）与 Material Icons（Apache-2.0），按各自许可证使用。
- 未内置任何第三方字体文件，使用系统字体。
