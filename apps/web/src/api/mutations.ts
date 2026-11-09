import type { CalendarEvent, Project, Quadrant, Task, TaskPatch } from '@youzhong/shared';
import { QUADRANT_RULES } from '@youzhong/shared';
import { toast } from '@/components/ui/toast';
import { newId } from '@/lib/utils';
import { useApp } from '@/store/app';
import { useUi } from '@/store/ui';
import { enqueueDelete, enqueueSave } from '@/sync/queue';
import { ApiClientError, api } from './client';

function stamp(): string {
  return new Date().toISOString();
}

export function buildNewTask(input: Partial<Task> & { projectId: string; title: string }): Task {
  return {
    id: newId(),
    projectId: input.projectId,
    title: input.title,
    content: input.content,
    priority: input.priority ?? 0,
    status: 0,
    dueDate: input.dueDate,
    startDate: input.startDate,
    isAllDay: input.isAllDay ?? false,
    tags: input.tags ?? [],
    items: input.items ?? [],
    reminders: input.reminders ?? [],
    sortOrder: Math.floor(Date.now() / 1000) % 100_000,
    createdTime: stamp(),
    modifiedTime: stamp(),
  };
}

export async function createTask(input: Partial<Task> & { projectId: string; title: string }): Promise<Task> {
  const task = buildNewTask(input);
  useApp.getState().upsertTask(task);
  try {
    const saved = await api.createTask(task);
    if (saved?.id) {
      if (saved.id !== task.id) useApp.getState().removeTask(task.id);
      useApp.getState().upsertTask({ ...task, ...saved });
    }
    return task;
  } catch (error) {
    useApp.getState().removeTask(task.id);
    toast(`新增任务失败：${(error as Error).message}`, 'error');
    return task;
  }
}

/**
 * 生成 PATCH 请求体：
 * JSON.stringify 会丢掉值为 undefined 的键，导致「清除日期 / 清除备注」这类操作被服务端当成「没改」。
 * 因此把 patch 里显式置空的字段改成 null，让服务端能区分「不改」与「清空」。
 */
function patchPayload(next: Task, patch: TaskPatch): Task {
  const payload: Record<string, unknown> = { ...next };
  (Object.keys(patch) as (keyof TaskPatch)[]).forEach((key) => {
    if (patch[key] === undefined) payload[key as string] = null;
  });
  return payload as unknown as Task;
}

export async function patchTask(id: string, patch: TaskPatch): Promise<void> {
  const before = useApp.getState().tasks[id];
  if (!before) return;

  const next: Task = {
    ...before,
    ...patch,
    modifiedTime: stamp(),
    completedTime: patch.status === 2 ? stamp() : patch.status === 0 ? undefined : before.completedTime,
  };
  useApp.getState().upsertTask(next);

  try {
    const saved = await api.updateTask(patchPayload(next, patch));
    // 重复任务完成后服务端会顺延到下一次，用返回结果覆盖本地乐观值
    if (saved && (saved.status !== next.status || saved.dueDate !== next.dueDate)) {
      useApp.getState().upsertTask(saved);
      if (saved.dueDate && saved.dueDate !== next.dueDate) toast('重复任务已顺延到下一次', 'success');
    }
  } catch (error) {
    const offline = error instanceof ApiClientError && (error.status === 0 || error.retryable);
    if (offline) {
      // 网络问题不回滚：保留本地修改，交给重试队列
      await enqueueSave(next);
      toast('网络不稳定，已先保存在本地，恢复后自动重试', 'info');
      return;
    }
    useApp.getState().upsertTask(before);
    toast(`保存失败，已回滚：${(error as Error).message}`, 'error');
  }
}

export function toggleTask(id: string): void {
  const task = useApp.getState().tasks[id];
  if (!task) return;
  void patchTask(id, { status: task.status === 2 ? 0 : 2 });
}

export async function deleteTask(id: string): Promise<void> {
  const task = useApp.getState().tasks[id];
  if (!task) return;
  useApp.getState().removeTask(id);
  if (useUi.getState().selectedTaskId === id) useUi.getState().closeDetail();
  try {
    await api.deleteTask(id, task.projectId);
    toast('任务已删除', 'success');
  } catch (error) {
    useApp.getState().upsertTask(task);
    toast(`删除失败：${(error as Error).message}`, 'error');
    await enqueueDelete(id, task.projectId);
  }
}

/** 四象限拖拽：按当前规则产出 patch，复用同一条写回链路 */
export function moveTaskToQuadrant(id: string, target: Quadrant): void {
  const task = useApp.getState().tasks[id];
  if (!task) return;
  const rule = QUADRANT_RULES[useUi.getState().ruleId];
  void patchTask(id, rule.applyDrag(task, target, new Date()));
}

export async function createProject(name: string, color = '#0E9F8A'): Promise<void> {
  try {
    const project = await api.createProject(name, color);
    useApp.getState().addProject(project);
    toast(`清单「${name}」已创建`, 'success');
  } catch (error) {
    toast(`创建清单失败：${(error as Error).message}`, 'error');
  }
}

export async function renameProject(id: string, name: string): Promise<void> {
  const before = useApp.getState().projects.find((project) => project.id === id);
  if (!before) return;
  useApp.getState().patchProject(id, { name });
  try {
    await api.updateProject(id, { name });
  } catch (error) {
    useApp.getState().patchProject(id, { name: before.name });
    toast(`重命名失败：${(error as Error).message}`, 'error');
  }
}

export async function deleteProject(id: string): Promise<void> {
  const before = useApp.getState().projects;
  const project = before.find((item) => item.id === id);
  if (!project || project.permission === 'inbox') return;
  useApp.getState().removeProject(id);
  try {
    await api.deleteProject(id);
    toast(`清单「${project.name}」已删除`, 'success');
  } catch (error) {
    useApp.getState().addProject(project);
    toast(`删除失败：${(error as Error).message}`, 'error');
  }
}

export async function createEvent(event: Omit<CalendarEvent, 'id'> & { id?: string }): Promise<void> {
  const payload: CalendarEvent = { id: event.id ?? newId(), ...event } as CalendarEvent;
  useApp.getState().upsertEvent(payload);
  try {
    const saved = await api.createEvent(payload);
    if (saved) useApp.getState().upsertEvent(saved);
  } catch (error) {
    useApp.getState().removeEvent(payload.id);
    toast(`新建日程失败：${(error as Error).message}`, 'error');
  }
}

export async function updateEvent(event: CalendarEvent): Promise<void> {
  useApp.getState().upsertEvent(event);
  try {
    await api.updateEvent(event);
  } catch (error) {
    toast(`日程保存失败：${(error as Error).message}`, 'error');
  }
}

export async function deleteEvent(id: string): Promise<void> {
  const before = useApp.getState().events.find((event) => event.id === id);
  if (!before) return;
  useApp.getState().removeEvent(id);
  try {
    await api.deleteEvent(id);
  } catch (error) {
    useApp.getState().upsertEvent(before);
    toast(`删除日程失败：${(error as Error).message}`, 'error');
  }
}

export function projectColor(projects: Project[], projectId: string): string {
  return projects.find((project) => project.id === projectId)?.color ?? '#0E9F8A';
}
