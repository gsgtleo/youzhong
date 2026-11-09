# 任务与子任务

## 字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 24 位十六进制，由服务端生成 |
| `projectId` | string | 所属清单；笔记本为账号内固定 id（permission = inbox）|
| `title` | string | 标题 |
| `content` | string? | 备注，按纯文本处理 |
| `priority` | `0 \| 1 \| 3 \| 5` | 无 / 低 / 中 / 高 |
| `status` | `0 \| 2` | 未完成 / 已完成 |
| `dueDate` | string? | `2026-10-26T14:00:00.000+0800` |
| `startDate` | string? | 日历块开始时间 |
| `isAllDay` | boolean | 全天任务：`dueDate` 时间为 `00:00:00` |
| `timeZone` | string? | 任务时区，原样保留、不做有损转换 |
| `reminders` | `{id, trigger}[]` | `trigger` 为绝对时间串或 `TRIGGER:-PT30M` |
| `items` | `Subtask[]` | 子任务，字段 `{id, title, status, sortOrder}` |
| `tags` | string[] | 标签名数组 |
| `repeatFlag` | string? | 重复规则（RRULE 片段），完成后由服务端顺延 |
| `sortOrder` | number | 手动排序值 |
| `etag` / `modifiedTime` | string? | 并发控制预留字段，当前客户端不参与校验 |

## 写接口

全部写操作作用于本服务端自己的 SQLite，不转发到任何外部服务。

```http
POST   /api/tasks          { "task": Task }        // 201，返回落库后的任务
PATCH  /api/tasks/:id      { "task": Task }        // 与已有记录合并，返回合并后的任务
DELETE /api/tasks/:id                              // 204
```

- `PATCH` 只覆盖请求体里出现的字段；`projectId` 会校验归属，不能改到其他账号的清单。
- 删除清单会级联删除其下任务。

## 子任务

子任务不是独立资源，随任务整体提交：把整个 `items` 数组放进任务的请求体即可。

## 完成 / 取消完成

```json
{ "task": { "status": 2, "completedTime": "2026-10-26T14:00:00.000+0800" } }
```

恢复未完成时 `status: 0`，同时清空 `completedTime`。
带 `repeatFlag` 的任务完成时不归档，而是按规则顺延到下一次。

## 本项目的写入策略

1. 前端乐观更新本地 store（`apps/web/src/store/app.ts`）；
2. 调用 BFF `PATCH /api/tasks/:id`，失败则回滚 UI 并把操作推入 IndexedDB 的 `outbox`；
3. `outbox` 按指数退避（最长 60s）重放，连续失败 5 次后丢弃并提示；
4. 页面重新获得焦点 / 网络恢复时额外触发一次 flush。
