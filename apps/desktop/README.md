# 有终桌面客户端

Electron 外壳，直接复用 `apps/web`（网页端）的构建产物，因此功能与网页版**完全一致**：任务、清单、标签、
重复任务、提醒、日历（月/周/日 + 拖拽改期 + 日程编辑）、四象限、搜索、多用户、主题与密度、通知渠道等。

桌面端在网页版之上补的“本地能力”：

| 能力 | 说明 |
| --- | --- |
| 服务器地址管理 | 首次运行用菜单「文件 → 服务器地址…」填写（也可直接登录页手填），写入 `config.json` 并自动同步到页面 |
| 窗口记忆 | 记住窗口大小 / 位置 / 最大化状态 |
| 单实例 | 重复启动只聚焦已有窗口 |
| 托盘 | 单机启动第二个实例 / 关闭窗口时可最小化到托盘（「视图 → 最小化到托盘」） |
| 开机自启 | 「帮助 → 开机自动启动」（Windows / macOS） |
| 系统通知 | 服务端 SSE 推来的提醒会由主进程弹 **Windows 系统通知**（窗口最小化 / 隐藏到托盘也照弹，点击回到窗口）；首次运行会在开始菜单补一个带 AppUserModelID 的快捷方式，否则 Windows 会丢弃 Toast |
| 外部链接 | 安装包下载、网页版等站外链接交给系统浏览器 |
| 下载 | 跟随系统下载目录，完成后自动打开所在文件夹 |
| 缩放 / 全屏 / 开发者工具 | 视图菜单，F12 打开调试 |

> 桌面端**不注册** Service Worker：本地文件随安装包一起升级，留着 SW 只会把旧外壳缓存住。

## 开发运行

```bash
# 仓库根目录
npm install
npm -w apps/web run build      # 或 VITE_BASE_PATH=/ npm -w apps/web run build
npm run desktop                # = npm -w @youzhong/desktop run start
```

`npm run desktop` 会启动本地静态服务（127.0.0.1 随机端口）并加载 `apps/web/dist`，然后弹出窗口。

## 构建 Windows 包

### 在 Windows 上（推荐，能拿到带图标的安装包）

```bash
npm install
npm run desktop:dist          # nsis 安装包 + portable 单文件
# 产物：apps/desktop/release/youzhong-desktop-<version>-setup.exe
#       apps/desktop/release/youzhong-desktop-<version>-portable.exe
```

### 在 Linux / macOS 上交叉构建（免安装 zip）

```bash
npm run desktop:dist:zip      # = npm -w @youzhong/desktop run dist:zip
# 产物：apps/desktop/release/youzhong-desktop-<version>-x64.zip
```

解压后双击 `Youzhong.exe` 即可运行（免安装）。交叉构建说明：

- `electron-builder` 生成 nsis / portable 需要 wine（生成卸载程序），所以在 Linux 上只出 zip；
- 配置里 `win.signAndEditExecutable=false`，因此交叉构建的 exe 保留 Electron 默认图标 / 版本资源；
  在 Windows 上构建则会自动写入 `resources/icon.png`。

图标由 `resources/icon.png` 提供，可用 `npm -w @youzhong/desktop run icon` 从 `apps/web/public/icon.svg` 重新栅格化。

## 目录结构

```
apps/desktop/
  src/main.cjs             主进程：窗口 / 菜单 / 托盘 / 配置 / 下载 / 冒烟测试
  src/server.cjs           本地静态服务器（SPA 回退、缓存头、目录穿越防护）
  src/config.cjs           config.json 读写（userData 目录）
  src/preload.cjs          主窗口桥接（禁用 SW、暴露只读信息）
  src/settings.html        服务器地址设置窗口
  src/settings-preload.cjs 设置窗口桥接
  resources/icon.png       应用图标
  scripts/make-icon.cjs    SVG → PNG
```

## 自检（冒烟测试）

```bash
# 只验证外壳能渲染
DISPLAY=:0 npx electron . --smoke

# 指定服务器并模拟登录，验证登录后界面与数据
DISPLAY=:0 npx electron . --smoke --server-url=http://127.0.0.1:10078 --login=admin:密码

# 再补一个「快速添加任务 → 确认落库 → 清理」的交互（会真的写库再删掉）
DISPLAY=:0 npx electron . --smoke --server-url=http://127.0.0.1:10078 --login=admin:密码 --interact
```

输出 `SMOKE=PASS` 即通过；`SMOKE_RESULT=` 里带有页面标题、桥接状态、ping 结果、登录后首屏文本等。

## 提醒与通知

- 提醒时刻由服务端调度（`/api/stream` 的 `notification` 事件），桌面端收到后由主进程调
  `new Notification()` 弹系统通知，同时页内还保留一条 toast。
- 窗口最小化 / 隐藏到托盘时 SSE 仍在跑（`backgroundThrottling: false`），通知照常弹；点通知会把窗口拉回前台。
- 想「关掉窗口也能提醒」，请打开「帮助 → 开机自动启动」：自启时带 `--hidden`，只驻留托盘不弹窗。
- Windows 的 Toast 依赖开始菜单快捷方式 + AppUserModelID，首次运行会自动创建；若系统里禁止了通知，
  到「设置 → 系统 → 通知」里给 Youzhong 放行。

## 配置位置

| 平台 | 路径 |
| --- | --- |
| Windows | `%APPDATA%\Youzhong\config.json` |
| macOS | `~/Library/Application Support/Youzhong/config.json` |
| Linux | `~/.config/Youzhong/config.json` |

菜单「文件 → 打开配置文件所在目录」可直接定位。
