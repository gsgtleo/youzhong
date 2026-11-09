# 日历与日程

## 数据来源

日历视图混排两类数据，共享同一份 store，不做影子数据：

| 类型 | 来源 | 判定 |
| --- | --- | --- |
| 任务 | `Task.dueDate` | 有 `dueDate` 的任务才会落格 |
| 日程 | `CalendarEvent.startDate` | 独立资源，带颜色与地点 |

## 端点

日程数据随 `GET /api/snapshot` 一次性下发（与任务、清单、标签同一个快照），不单独提供列表查询接口。

写入：

```http
POST   /api/events        { "event": CalendarEvent }   // 201
PATCH  /api/events/:id    { "event": CalendarEvent }
DELETE /api/events/:id                                  // 204
```

写成功后服务端通过 SSE 广播 `snapshot-changed`，各终端重新拉取快照。

## 字段

| 字段 | 说明 |
| --- | --- |
| `id` | 日程 id |
| `summary` | 标题 |
| `startDate` / `endDate` | 时间串；缺 `endDate` 时前端按 1 小时兜底 |
| `isAllDay` | 全天日程，进入日历顶部「全天」行 |
| `color` | 日程颜色，日历块描边使用 |
| `calendarId` | 所属日历标识，本地字段，预留 |
| `description` / `location` | 备注与地点 |

## 视图行为

- **月视图**：6×7 网格，跨天任务只落在开始日；每格最多 2 条，超出显示「还有 N 项」；拖拽任务到另一天 = 改 `dueDate`（保留原时分，全天任务落到 09:00）。
- **周/日视图**：`06:00 - 24:00`，每小时 48px；重叠日程自动分列（`layoutDay`）；拖动色块按 15 分钟对齐改时间；双击空白按 30 分钟对齐新建任务。
- **全天行**：`isAllDay` 的任务与日程进入顶部独立行。
- **时区**：原样保存服务端字符串，展示时按同一格式解析，不做时区换算。
