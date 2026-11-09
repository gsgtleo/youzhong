# 四象限

## 结论

四象限在本项目里是**前端派生视图**，没有独立的「象限」字段：任务落在哪一格，由「四象限规则」计算得出。
因此不产生任何影子数据，四象限与列表、日历共用同一份任务。

## 两套内置规则

### 规则组合 1：象限 ↔ 优先级（默认）

| 象限 | 语义 | 优先级 |
| --- | --- | --- |
| Q1 | 重要且紧急 | `5` 高 |
| Q2 | 重要不紧急 | `3` 中 |
| Q3 | 紧急不重要 | `1` 低 |
| Q4 | 不重要不紧急 | `0` 无 |

拖拽任务到另一格 = 把任务优先级改成该格对应的值，一次写成。

### 规则组合 2：重要 = 优先级，紧急 = 时间

- 重要：`priority >= 3`
- 紧急：`dueDate` 已逾期，或距离当前时间 ≤ 48 小时

拖拽时同时改写两个维度（`applyDrag` 产出 patch）：

| 目标 | 优先级 | 截止时间 |
| --- | --- | --- |
| Q1 | 5 | 今天 18:00 |
| Q2 | 5 | 3 天后 18:00 |
| Q3 | 1 | 今天 18:00 |
| Q4 | 0 | 7 天后 18:00 |

## 实现

```ts
// packages/shared/src/quadrantRules.ts
export const QUADRANT_RULES: Record<'priority' | 'urgency', QuadrantRule>

interface QuadrantRule {
  quadrantOf(task: Task, now: Date): Quadrant;
  applyDrag(task: Task, target: Quadrant, now: Date): TaskPatch;
}
```

拖拽只调用 `applyDrag` 拿到 patch，然后复用同一条写回链路（`patchTask`）：
乐观更新 → `PATCH /api/tasks/:id` → 失败回滚 + 进重试队列。

## 规则是否落库？

不落服务端数据库：象限规则是纯展示偏好，保存在浏览器本地
（`zustand` persist → `youzhong-ui` / `ruleId`），换设备后需要重新选择，不影响任务数据本身。
