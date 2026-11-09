
import type { Task } from '@youzhong/shared';
import { api } from '@/api/client';
import { db } from '@/db/dexie';
import { toast } from '@/components/ui/toast';

const MAX_ATTEMPTS = 5;

let flushing = false;
let scheduled: number | undefined;
let drainHandler: (() => void) | undefined;

export function setDrainHandler(handler: () => void): void {
  drainHandler = handler;
}

/** 同一任务只保留最后一次待重放的写入，避免多次离线编辑把旧内容重复打到服务端 */
async function dropPendingSaves(taskId: string): Promise<void> {
  const pending = await db.outbox.where('taskId').equals(taskId).toArray();
  const ids = pending.filter((item) => item.kind === 'save' && item.id).map((item) => item.id as number);
  if (ids.length) await db.outbox.bulkDelete(ids);
}

export async function enqueueSave(task: Task): Promise<void> {
  await dropPendingSaves(task.id);
  await db.outbox.add({
    kind: 'save',
    taskId: task.id,
    projectId: task.projectId,
    payload: JSON.stringify(task),
    attempts: 0,
    createdAt: Date.now(),
    lastAttemptAt: undefined,
  });
  scheduleFlush();
}

export async function enqueueDelete(taskId: string, projectId: string): Promise<void> {
  await dropPendingSaves(taskId);
  await db.outbox.add({ kind: 'delete', taskId, projectId, attempts: 0, createdAt: Date.now(), lastAttemptAt: Date.now() });
  scheduleFlush();
}

export function scheduleFlush(delay = 2500): void {
  if (scheduled) window.clearTimeout(scheduled);
  scheduled = window.setTimeout(() => {
    void flushOutbox();
  }, delay);
}

/** 指数退避重放离线写队列：成功即删除，连续失败 5 次丢弃并提示 */
export async function flushOutbox(): Promise<void> {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  let changed = false;
  let dropped = 0;
  try {
    const items = await db.outbox.orderBy('createdAt').toArray();

    for (const item of items) {
      // 退避从「上次尝试」算，而不是从入队时刻算，否则同一批会立刻被反复重试
      const last = item.lastAttemptAt ?? item.createdAt;
      const waitMs = Math.min(60_000, 1000 * 2 ** item.attempts);
      if (item.attempts > 0 && Date.now() - last < waitMs) continue;

      try {
        if (item.kind === 'save' && item.payload) {
          await api.updateTask(JSON.parse(item.payload) as Task);
        } else if (item.kind === 'delete') {
          await api.deleteTask(item.taskId, item.projectId);
        }
        if (item.id) await db.outbox.delete(item.id);
        changed = true;
      } catch (error) {
        const attempts = item.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          if (item.id) await db.outbox.delete(item.id);
          dropped += 1;
        } else if (item.id) {
          await db.outbox.update(item.id, { attempts, lastError: (error as Error).message, lastAttemptAt: Date.now() });
        }
      }
    }
  } finally {
    // 任何异常都不能把 flushing 卡在 true，否则队列永久停摆
    flushing = false;
  }

  if (dropped > 0) toast(`${dropped} 条离线修改重试失败已丢弃`, 'error');
  if (changed) drainHandler?.();
}

export async function pendingCount(): Promise<number> {
  return db.outbox.count();
}
