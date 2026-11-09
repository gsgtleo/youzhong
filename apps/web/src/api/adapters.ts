import type { CalendarEvent, Priority, Project, Snapshot, Subtask, Task } from '@youzhong/shared';

/** 私有接口字段兜底：任何缺失/类型漂移都在这一层收敛 */

function toPriority(value: unknown): Priority {
  const num = Number(value);
  if (num === 5 || num === 3 || num === 1) return num;
  return 0;
}

function toStatus(value: unknown): 0 | 2 {
  return Number(value) === 2 ? 2 : 0;
}

function toSubtasks(input: unknown): Subtask[] {
  if (!Array.isArray(input)) return [];
  return input.map((raw, index) => {
    const item = raw as Partial<Subtask> & { id?: string };
    return {
      id: item.id ?? `sub_${index}`,
      title: item.title ?? '',
      status: toStatus(item.status),
      sortOrder: item.sortOrder ?? index,
    };
  });
}

export function normalizeTask(raw: Partial<Task> & { id: string; projectId?: string }): Task {
  return {
    id: raw.id,
    projectId: raw.projectId ?? 'inbox',
    title: raw.title ?? '未命名任务',
    content: raw.content ?? undefined,
    priority: toPriority(raw.priority),
    status: toStatus(raw.status),
    dueDate: raw.dueDate ?? undefined,
    startDate: raw.startDate ?? undefined,
    isAllDay: Boolean(raw.isAllDay),
    timeZone: raw.timeZone,
    reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === 'string') : [],
    items: toSubtasks(raw.items).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    repeatFlag: raw.repeatFlag,
    sortOrder: Number(raw.sortOrder ?? 0),
    parentId: raw.parentId,
    etag: raw.etag,
    createdTime: raw.createdTime,
    modifiedTime: raw.modifiedTime,
    completedTime: raw.completedTime,
  };
}

export function normalizeProject(raw: Partial<Project> & { id: string }): Project {
  return {
    id: raw.id,
    name: raw.name ?? '未命名清单',
    color: raw.color ?? '#0E9F8A',
    sortOrder: Number(raw.sortOrder ?? 0),
    groupId: raw.groupId,
    closed: raw.closed,
    viewMode: raw.viewMode,
    permission: raw.permission,
    kind: raw.kind,
  };
}

export function normalizeEvent(raw: Partial<CalendarEvent> & { id: string; startDate: string }): CalendarEvent {
  return {
    id: raw.id,
    summary: raw.summary ?? '未命名日程',
    startDate: raw.startDate,
    endDate: raw.endDate,
    isAllDay: Boolean(raw.isAllDay),
    color: raw.color ?? '#0E9F8A',
    calendarId: raw.calendarId,
    description: raw.description,
    location: raw.location,
  };
}

export function normalizeSnapshot(raw: Snapshot): Snapshot {
  return {
    projects: (raw.projects ?? []).map((p) => normalizeProject(p as Project)),
    projectGroups: (raw.projectGroups ?? []).map((g, i) => ({ id: g.id ?? `g_${i}`, name: g.name ?? '未命名分组', sortOrder: g.sortOrder ?? i })),
    tags: (raw.tags ?? []).map((t, i) => ({ name: t.name, label: t.label ?? t.name, color: t.color, sortOrder: t.sortOrder ?? i })),
    tasks: (raw.tasks ?? []).map((t) => normalizeTask(t as Task)),
    events: (raw.events ?? []).map((e) => normalizeEvent(e as CalendarEvent)),
    serverTime: raw.serverTime ?? new Date().toISOString(),
    mode: raw.mode ?? 'mock',
  };
}
