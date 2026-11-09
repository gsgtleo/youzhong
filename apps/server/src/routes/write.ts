import { Router } from 'express';
import type { CalendarEvent, Project, Task } from '@youzhong/shared';
import { events, projects, tags, tasks } from '../db/repositories';
import { broadcast } from '../events';
import { flushTaskReminders, parseTrigger } from '../notify/dispatcher';
import { newId } from '../lib/security';
import { badRequest, handle } from '../lib/errors';
import { requireAuth } from '../middleware/auth';

export const writeRouter = Router();
writeRouter.use(requireAuth);

/** 任何写操作成功后，通知该用户的其它终端刷新（SSE 实时通道） */
writeRouter.use((req, res, next) => {
  res.on('finish', () => {
    if (req.user && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && res.statusCode < 400) {
      broadcast(req.user.id, 'snapshot-changed', { path: req.path });
    }
  });
  next();
});

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 取出日期串自带的时区偏移（分钟），没有就用服务器本地偏移兜底 */
function parseOffsetMinutes(value: string, fallback: number): number {
  const matched = /([+-])(\d{2})(\d{2})$/.exec(value);
  if (!matched) return fallback;
  const sign = matched[1] === '-' ? -1 : 1;
  return sign * (Number(matched[2]) * 60 + Number(matched[3]));
}

function parseStamp(value: string): Date {
  return new Date(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
}

/** 按指定偏移序列化：保证「墙上时间」不被服务器时区改写 */
function toStamp(date: Date, offsetMinutes: number): string {
  const wall = new Date(date.getTime() + offsetMinutes * 60_000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  return `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}T${pad(wall.getUTCHours())}:${pad(
    wall.getUTCMinutes(),
  )}:${pad(wall.getUTCSeconds())}.${String(wall.getUTCMilliseconds()).padStart(3, '0')}${sign}${pad(
    Math.floor(abs / 60),
  )}${pad(abs % 60)}`;
}

/**
 * 重复任务顺延：RRULE 的 DAILY/WEEKLY/MONTHLY，月末自动对齐。
 * 顺延按「原任务自带的时区偏移」算，避免服务器在 UTC 容器里把 +0800 的任务挪成别的钟点。
 */
function nextRepeatDue(dueDate: string, flag: string): string | null {
  const freq = /FREQ=(DAILY|WEEKLY|MONTHLY)/.exec(flag)?.[1];
  if (!freq) return null;
  const interval = Math.max(1, Number(/INTERVAL=(\d+)/.exec(flag)?.[1] ?? 1));
  const due = parseStamp(dueDate);
  if (Number.isNaN(due.getTime())) return null;

  const offsetMinutes = parseOffsetMinutes(dueDate, -new Date().getTimezoneOffset());
  // wall 用 UTC 字段表示当地时间，加减都用 UTC API，避免 DST / 服务器时区干扰
  const wall = new Date(due.getTime() + offsetMinutes * 60_000);
  if (freq === 'DAILY') wall.setUTCDate(wall.getUTCDate() + interval);
  else if (freq === 'WEEKLY') wall.setUTCDate(wall.getUTCDate() + 7 * interval);
  else {
    const day = wall.getUTCDate();
    wall.setUTCDate(1);
    wall.setUTCMonth(wall.getUTCMonth() + interval);
    const lastDay = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth() + 1, 0)).getUTCDate();
    wall.setUTCDate(Math.min(day, lastDay));
  }

  return toStamp(new Date(wall.getTime() - offsetMinutes * 60_000), offsetMinutes);
}

/**
 * 重复任务顺延后，提醒时间要跟着整体平移，否则下一次到期没有提醒（旧提醒还在过去）。
 * 同时换新的 reminder id：通知去重键里带 id，不换的话下一次永远被判定为「已提醒过」。
 */
function shiftReminders(fromDue: string, toDue: string, reminders: Task['reminders']): Task['reminders'] {
  const from = parseStamp(fromDue).getTime();
  const to = parseStamp(toDue).getTime();
  const delta = to - from;
  const offsetMinutes = parseOffsetMinutes(toDue, -new Date().getTimezoneOffset());
  return (reminders ?? []).map((reminder) => {
    const at = parseTrigger(reminder.trigger);
    if (!Number.isFinite(at)) return { ...reminder, id: newId() };
    return { id: newId(), trigger: toStamp(new Date(at + delta), offsetMinutes) };
  });
}

/* ------------------------------- 任务 ------------------------------- */

writeRouter.post(
  '/tasks',
  handle(async (req, res) => {
    const { task } = (req.body ?? {}) as { task?: Task };
    if (!task?.title?.trim()) throw badRequest('任务标题不能为空');
    const userId = req.user!.id;
    // 客户端生成的 id 必须是 24 位十六进制，否则入库后取回会是 null（500）
    const taskId = typeof task.id === 'string' ? task.id.trim() : '';
    if (!/^[0-9a-f]{24}$/i.test(taskId)) throw badRequest('任务 id 必须是 24 位十六进制字符串');
    // projectId 为必填且必须属于当前账号，避免 NOT NULL 约束报 500 / 写到别人的清单
    const projectId = typeof task.projectId === 'string' ? task.projectId.trim() : '';
    if (!projectId) throw badRequest('缺少所属清单（projectId）');
    if (!projects.list(userId).some((project) => project.id === projectId)) throw badRequest('清单不存在或不属于当前账号');
    const saved = tasks.upsert(userId, { ...task, id: taskId, projectId, status: task.status ?? 0, title: task.title.trim() });
    if (task.tags?.length) tags.ensure(userId, task.tags);
    console.log(`[task+] ${saved.title} due=${saved.dueDate ?? '-'} rem=${JSON.stringify(saved.reminders ?? [])}`);
    flushTaskReminders(userId, saved); // 提醒时间已过就立刻补发，避免「设了不响」
    res.status(201).json(saved);
  }),
);

writeRouter.patch(
  '/tasks/:id',
  handle(async (req, res) => {
    const { task } = (req.body ?? {}) as { task?: Task };
    if (!task) throw badRequest('缺少任务内容');
    const userId = req.user!.id;
    const existing = tasks.get(userId, req.params.id);
    if (!existing) {
      res.status(404).json({ error: { code: 'not_found', message: '任务不存在', retryable: false } });
      return;
    }
    // 归属校验：不允许把任务改到别人的清单
    const ownedProjects = new Set(projects.list(userId).map((project) => project.id));
    const projectId = task.projectId && ownedProjects.has(task.projectId) ? task.projectId : existing.projectId;
    const saved = tasks.upsert(userId, { ...existing, ...task, id: req.params.id, projectId });
    if (task.tags?.length) tags.ensure(userId, task.tags);

    // 重复任务：完成后不归档，直接顺延到下一次
    if (saved.status === 2 && saved.repeatFlag && saved.dueDate) {
      const nextDue = nextRepeatDue(saved.dueDate, saved.repeatFlag);
      if (nextDue) {
        const advanced = tasks.upsert(userId, {
          ...saved,
          status: 0,
          dueDate: nextDue,
          completedTime: undefined,
          reminders: shiftReminders(saved.dueDate, nextDue, saved.reminders),
        });
        res.json(advanced);
        return;
      }
    }
    console.log(`[task~] ${saved.title} due=${saved.dueDate ?? '-'} rem=${JSON.stringify(saved.reminders ?? [])}`);
    flushTaskReminders(userId, saved);
    res.json(saved);
  }),
);

writeRouter.delete('/tasks/:id', (req, res) => {
  tasks.remove(req.user!.id, req.params.id);
  res.status(204).end();
});

/* ------------------------------- 清单 ------------------------------- */

writeRouter.post(
  '/projects',
  handle(async (req, res) => {
    const { name, color } = (req.body ?? {}) as { name?: string; color?: string };
    if (!name?.trim()) throw badRequest('清单名称不能为空');
    const project: Project = projects.create(req.user!.id, { name: name.trim(), color });
    res.status(201).json(project);
  }),
);

writeRouter.patch(
  '/projects/:id',
  handle(async (req, res) => {
    const patch = (req.body?.project ?? {}) as Partial<Project>;
    const updated = projects.update(req.user!.id, req.params.id, { name: patch.name, color: patch.color });
    if (!updated) {
      res.status(404).json({ error: { code: 'not_found', message: '清单不存在', retryable: false } });
      return;
    }
    res.json(updated);
  }),
);

writeRouter.delete('/projects/:id', (req, res) => {
  projects.remove(req.user!.id, req.params.id);
  res.status(204).end();
});

/* ------------------------------- 日程 ------------------------------- */

writeRouter.post(
  '/events',
  handle(async (req, res) => {
    const event = (req.body?.event ?? {}) as CalendarEvent;
    if (!event.summary?.trim()) throw badRequest('日程标题不能为空');
    res.status(201).json(events.upsert(req.user!.id, event));
  }),
);

writeRouter.patch(
  '/events/:id',
  handle(async (req, res) => {
    const event = (req.body?.event ?? {}) as CalendarEvent;
    res.json(events.upsert(req.user!.id, { ...event, id: req.params.id }));
  }),
);

writeRouter.delete('/events/:id', (req, res) => {
  events.remove(req.user!.id, req.params.id);
  res.status(204).end();
});
