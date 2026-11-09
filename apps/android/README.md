# 安卓客户端（原生 Kotlin / Compose）

原生 Kotlin + Jetpack Compose 实现，不依赖 WebView，只通过 `/api` 与服务端通信。

## 已实现

| 页面 | 能力 |
| --- | --- |
| 登录 | 服务器地址输入 + 「测试连接」（展示服务器名/版本/用户数）+ 用户名密码登录 |
| 任务列表 | 今日/全部任务、优先级色条、勾选完成（写回服务端）、下拉刷新 |
| 设置 | 当前服务器与账号、退出登录、通知渠道列表（新建/测试/删除） |
| 通知 | 系统通知渠道「任务提醒」；每 15 分钟 WorkManager 同步并检查 30 分钟内到期任务；点击通知可回到 App |
| 存储 | DataStore 保存 `serverUrl` / `token` / 显示名，换服务器只需在登录页改地址 |

因为服务端同时提供钉钉/飞书推送，安卓端只负责本地提醒与渠道配置，配置与网页端共用同一份（存在服务端 SQLite）。

## 目录

```
app/src/main/java/com/youzhong/app/
├── MainActivity.kt        # Compose 宿主：Login / Tasks / Settings
├── YouzhongApp.kt        # 单例容器（TokenStore、YouzhongApi）+ WorkManager 注册
├── data/
│   ├── Models.kt          # 与 packages/shared 对齐的 DTO
│   └── Api.kt             # TokenStore(DataStore) + OkHttp 封装 + 全部接口
├── ui/
│   ├── LoginScreen.kt     # 服务器地址 + 测试连接 + 登录
│   ├── TaskListScreen.kt  # 任务列表
│   └── SettingsScreen.kt  # 设置 + 渠道对话框
├── work/DueCheckWorker.kt # 周期同步与本地到期检查
└── notify/Notifier.kt     # 通知渠道与点击跳转
```

## 构建

需要 JDK 17、Android SDK（`platform-tools`、`platforms;android-34`、`build-tools;34.0.0`）与 Gradle 8.9+。
签名密钥放在 `apps/android/youzhong-release.jks`（别名 youzhong，口令在 `keystore.properties`），两个文件都已在 `.gitignore`，不会提交。

```bash
export JAVA_HOME=/path/to/jdk-17
export ANDROID_HOME=/path/to/Android/Sdk
export PATH=$JAVA_HOME/bin:$PATH
cd apps/android

./gradlew :app:assembleDebug        # 调试包
./gradlew :app:assembleRelease      # 签名发布包
```

产物：

- `app/build/outputs/apk/release/app-release.apk` → 已归档到 `dist-packages/youzhong-client-1.0.202611081807.apk`（12 MB，已签名）
- `app/build/outputs/apk/debug/app-debug.apk` → `app/build/outputs/apk/debug/`
- 包名 `com.youzhong.app`，minSdk 26（Android 8.0+），targetSdk 34

安装：`adb install -r dist-packages/youzhong-client-1.0.202611081807.apk`，或把 APK 发到手机点击安装（需允许「未知来源」）。

## 首次使用

1. 手机与服务器同一局域网；
2. 打开 App → 「服务器地址」默认留空，填写你自己服务器的地址（如 `http://你的IP:10078`）→ 点「测试连接」；
3. 看到「连接成功：有终 · 家庭服务器 · 1.0 · 2026-11-07 09:29 · N 位用户」后，输入账号密码登录；
4. 首次启动会请求通知权限，建议允许。

## 已知事项

- `usesCleartextTraffic=true`：允许 http:// 局域网地址（上 TLS 后可关闭）。
- 尚未在真机/模拟器上运行验证（本机无 KVM 与设备），签名与打包已校验通过。
- 任务编辑（改标题/优先级/日期/重复）暂未做，当前聚焦「登录 + 看任务 + 勾完成 + 收提醒 + 配渠道」。
- 修改服务器地址：退出登录后会回到登录页，可重新填写。
