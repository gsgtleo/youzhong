# API 文档索引

本项目服务端自建的 REST + SSE 接口，基址为 `<服务器地址>/api`。
以下文档只描述**本项目自有接口与数据模型**，不涉及任何第三方服务的接口、协议或数据结构。

| 文档 | 内容 |
| --- | --- |
| [server-api.md](./server-api.md) | 鉴权、连通性、账号、数据快照、设置、通知渠道、成员管理 |
| [tasks.md](./tasks.md) | 任务与子任务：字段、写接口、写入策略 |
| [calendar.md](./calendar.md) | 日历与日程：数据来源、视图行为 |
| [quadrant.md](./quadrant.md) | 四象限：两套派生规则 |

## 通用约定

- **认证**：`Authorization: Bearer <token>`（安卓端与跨域网页）；同源网页使用 httpOnly 会话 Cookie。
- **时间格式**：`yyyy-MM-ddTHH:mm:ss.000+0800`（无冒号时区偏移），前后端统一由 `packages/shared/src/date.ts` 解析与序列化。
- **错误格式**：`{ "error": { "code": string, "message": string, "retryable": boolean } }`。
- **数据同步**：任何写操作成功后，服务端通过 SSE（`/api/stream`）广播 `snapshot-changed`，各终端重新拉取一次 `/api/snapshot` 完成对账；不维护增量补丁协议。
- **时间基准**：任务提醒时间由服务端调度器判定（60s 轮询），客户端只上报提醒的绝对时间。
