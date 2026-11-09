# 服务端 API（v3 · 多用户）

所有客户端（Web / PWA / Android）只依赖本文件描述的 HTTP 契约。基址为 `<服务器地址>/api`。

## 鉴权

| 方式 | 说明 |
| --- | --- |
| `Authorization: Bearer <token>` | 登录返回；Android 与跨域网页使用 |
| Cookie `youzhong_session=<token>` | 同源网页自动携带（httpOnly、SameSite=Lax、30 天） |

失败统一返回：

```json
{ "error": { "code": "not_authenticated", "message": "请先登录", "retryable": false } }
```

常见 code：`not_authenticated` `invalid_credentials` `account_disabled` `too_many_attempts` `weak_password` `not_found` `forbidden`。

## 连通性

### GET /api/ping（免鉴权）

```json
{ "ok": true, "name": "有终 · 家庭服务器", "version": "2.0.0", "apiVersion": 3,
  "serverTime": "2026-10-27T02:10:00.000Z", "requiresAuth": true,
  "features": ["tasks","calendar","quadrant","notifications","channels","backup"], "userCount": 3 }
```

两端登录页的「测试连接」都调用它；拿到 `userCount` 可以确认连的是自己的服务器。

## 账号

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/auth/login` | `{username, password}` → `{user, token, expiresAt}`；同 IP+用户名 5 次/分钟限流 |
| POST | `/auth/logout` | 删除会话并清 Cookie |
| GET | `/auth/me` | 当前用户 |
| POST | `/auth/password` | `{currentPassword, newPassword}`，新密码 ≥ 8 位 |

## 数据

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/snapshot` | 一次拿齐 `projects/tags/tasks/events`，全部按会话用户过滤 |
| POST | `/tasks` | 新建任务 `{task}` |
| PATCH | `/tasks/:id` | 更新任务 `{task}`；项目归属会校验，不能写到别人的清单 |
| DELETE | `/tasks/:id` | 删除 |
| POST/PATCH/DELETE | `/projects`、`/projects/:id` | 清单 |
| POST/PATCH/DELETE | `/events`、`/events/:id` | 日程 |

越权访问其他用户资源统一返回 `404 not_found`（不泄露存在性）。

### 重复任务

`repeatFlag` 存 RRULE 片段：`RRULE:FREQ=DAILY|WEEKLY|MONTHLY;INTERVAL=n`。

- 任务被标记完成（`status: 2`）时，服务端若发现 `repeatFlag` 且存在 `dueDate`，会把到期时间顺延一个周期并保持未完成，响应里直接返回顺延后的任务；
- 月末对齐：1/31 + 1 月 → 2/28；
- 前端在详情页提供「不重复 / 每天 / 每周 / 每月 / 每隔 N 天」。

### 任务级提醒

任务的 `reminders[].trigger` 支持绝对时间串。调度器每 60s 扫描一次，命中窗口为 `[now-90s, now+60s]`（覆盖定时器抖动），
用 `bucket = r-<reminderId>` 去重，因此同一个提醒只会推送一次；通知会同时写入站内通知（安卓轮询）与已启用的钉钉/飞书渠道。

## 设置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/settings` | `{settings, user}` |
| PUT | `/settings` | 合并保存 `{weekStartsOn, ruleId, reminderMinutes, dailyDigest, dailyDigestHour, timezone}` |

## 通知

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/notifications?since=<ms>` | 增量拉取，Android WorkManager 使用 |
| POST | `/notifications/read` | 全部标记已读 |
| GET | `/channels` | 渠道列表（Webhook/密钥不回传） |
| POST | `/channels` | `{type, name, webhook, secret, events, enabled}` |
| PATCH | `/channels/:id` | 局部更新，`secret` 传空表示不修改 |
| DELETE | `/channels/:id` | 删除 |
| POST | `/channels/:id/test` | 立即发送测试消息，失败返回 502 与上游原始错误 |

`events` 取值：`due`（到期）、`daily`（每日汇总）、`completed`（完成）。

## 备份与恢复

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/backup/export` | 导出当前账号的完整数据包（`format: youzhong-backup`） |
| POST | `/backup/restore` | `{data, mode}`，`mode` 为 `merge`（默认）或 `replace` |
| POST | `/backup/webdav` | `{action, config, file?}`，由服务端代发 WebDAV 请求（规避浏览器 CORS） |

备份包结构：

```json
{ "format": "youzhong-backup", "version": 1, "exportedAt": "2026-11-06T13:00:00.000Z",
  "user": { "username": "admin", "displayName": "管理员", "timezone": "Asia/Shanghai" },
  "settings": {}, "projects": [], "tags": [], "tasks": [], "events": [] }
```

- 恢复时清单 / 任务 / 日程都会**重新分配 id**，所以可以在任意服务器上恢复，不会与已有数据主键冲突；
  任务会按备份里的 `projectId` 映射到新建的清单，找不到时落到笔记本。
- `merge`：保留现有数据，同名清单复用（避免出现「工作 / 工作」两份）；`replace`：先清空当前账号的任务、清单、日程、标签。
- WebDAV `action` 取值：`test`（连接测试，目录不存在会自动创建）、`upload`、`list`、`download`、`delete`。
  `config = {url, username, password, dir}`，只随单次请求传输，服务端不落库、不记日志。

## 管理（仅 admin）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/admin/users` | 用户列表与上限 |
| POST | `/admin/users` | `{username, displayName, password, role}`，超上限返回 400 |
| POST | `/admin/users/:id/password` | 重置密码 |
| POST | `/admin/users/:id/status` | `{status: active｜disabled}`，不能停用自己 |

## 实时通道（SSE）

`GET /api/stream?token=<登录 token>`（EventSource 无法带请求头，故用查询参数鉴权）

| 事件 | 数据 | 客户端行为 |
| --- | --- | --- |
| `ready` | `{serverTime}` | 标记已连接 |
| `snapshot-changed` | `{path}` | 静默拉一次 `/snapshot` |
| `notification` | `{title, body, taskId, kind}` | 直接弹本地通知 |

- 每 25s 发送 `: ping` 心跳；nginx 需 `proxy_buffering off`（已返回 `X-Accel-Buffering: no`）。
- 通知的时间点由服务端决定，客户端只负责展示，**不再依赖设备时钟**。

## 通知调度

服务端每 60 秒扫描一次：

1. 按每个用户的 `reminderMinutes`（如 15 分钟）查 `tasks.due_at ∈ [now+15m-1m, now+15m]`；
2. 写 `notifications`（唯一索引 `user_id+task_id+kind+bucket` 去重）；
3. 分发到订阅 `due` 的钉钉/飞书渠道，失败记录 `last_error` 并指数退避；
4. `dailyDigest` 在用户时区的设定小时发送一次当日概览。
