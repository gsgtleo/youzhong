import type { ChannelEvent, Task } from '@youzhong/shared';
import { channels, notifications, settings, tasks, users } from '../db/repositories';
import { broadcast } from '../events';
import { decryptSecret } from '../lib/security';
import { sendByType, type PushMessage } from './providers';

/** 把一条通知分发到该用户所有订阅了该事件的渠道 */
export async function dispatch(userId: string, kind: ChannelEvent, message: PushMessage): Promise<void> {
  const list = channels.enabledWithEvent(userId, kind);
  if (!list.length) return;

  const results = await Promise.allSettled(
    list.map(async (channel) => {
      const webhook = decryptSecret(channel.webhook);
      const secret = channel.secret ? decryptSecret(channel.secret) : null;
      await sendByType(channel.type, webhook, secret, message);
      return channel.id;
    }),
  );

  results.forEach((result, index) => {
    const channelId = list[index].id;
    if (result.status === 'fulfilled') channels.markResult(channelId, true);
    else {
      const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.warn(`[notify] 渠道 ${channelId} 推送失败：${error}`);
      channels.markResult(channelId, false, error);
    }
  });
}

/** 60s 扫描的回看范围：覆盖进程重启、事件循环卡顿 */
const CATCHUP_MS = 5 * 60_000;
/**
 * 保存任务时补发更久一些的提醒：
 * 手机时钟可能偏离服务器很多（曾出现慢 59 分钟），按「准时」设的提醒会落在过去，
 * 这里放宽到 90 分钟，保证「设了立刻就该响」的场景不丢。
 */
const FLUSH_MS = 90 * 60_000;

/** `2026-10-28T21:58:00.000+0800` / `...+08:00` 都能解析 */
export function parseTrigger(trigger: string): number {
  return Date.parse(trigger.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
}

/** 写库 + 广播 + 外发渠道；返回是否新建 */
function fire(userId: string, task: Task, reminderId: string, at: number, late: boolean): boolean {
  const created = notifications.insert(userId, {
    taskId: task.id,
    kind: 'due',
    // 去重键带上「这一次的触发时刻」：重复任务顺延后提醒 id/时间会变，不能被上一次记录挡住
    bucket: `r-${reminderId}-${at}`,
    title: `任务提醒：${task.title}`,
    body: task.dueDate ? `截止 ${task.dueDate.slice(11, 16)}` : '到提醒时间了',
  });
  if (!created) return false;
  broadcast(userId, 'notification', {
    title: '⏰ 任务提醒',
    body: late ? `${task.title}（补发：设定时间已过）` : task.title,
    taskId: task.id,
    kind: 'due',
  });
  void dispatch(userId, 'due', {
    title: '⏰ 任务提醒',
    body: `**${task.title}** 到你设置的提醒时间了`,
  });
  return true;
}

/**
 * 任务刚保存时调用：提醒时间已经过去（下次扫描窗口赶不上）就立刻补发，
 * 避免「设了提醒却永远不响」。只看最近 30 分钟，太久远的不打扰。
 */
export function flushTaskReminders(userId: string, task: Task): number {
  const current = Date.now();
  let count = 0;
  (task.reminders ?? []).forEach((reminder) => {
    const at = parseTrigger(reminder.trigger);
    if (!Number.isFinite(at) || at > current + 60_000 || current - at > FLUSH_MS) return;
    if (fire(userId, task, reminder.id, at, at < current)) count += 1;
  });
  return count;
}

/** 60 秒扫描：到期提醒 + 每日汇总；写库去重，避免重复推送 */
export function startScheduler(): void {
  const tick = () => {
    const current = Date.now();
    users
      .list()
      .filter((user) => user.status === 'active')
      .forEach((user) => {
        const config = settings.get(user.id);
        const reminderMinutes = Array.isArray(config.reminderMinutes) ? (config.reminderMinutes as number[]) : [15];

        reminderMinutes.forEach((minutes) => {
          const to = current + minutes * 60_000;
          const from = to - 60_000;
          tasks.dueBetween(user.id, from, to).forEach((task) => {
            const created = notifications.insert(user.id, {
              taskId: task.id,
              kind: 'due',
              // 带上到期时间：重复任务下一次到期是同一条 task，不能沿用上次的去重键
              bucket: `${minutes}@${task.dueDate ?? ''}`,
              title: `任务即将到期：${task.title}`,
              body: `还有约 ${minutes} 分钟到期`,
            });
            if (!created) return;
            broadcast(user.id, 'notification', {
              title: '⏰ 任务即将到期',
              body: `${task.title} 将在 ${minutes} 分钟内到期`,
              taskId: task.id,
              kind: 'due',
            });
            void dispatch(user.id, 'due', {
              title: '⏰ 任务即将到期',
              body: `**${task.title}** 将在 ${minutes} 分钟内到期`,
            });
          });
        });

        // 任务级提醒：详情页「添加提醒」写入的是绝对时间，按分钟粒度触发
        tasks
          .list(user.id)
          .filter((task) => task.status === 0 && (task.reminders?.length ?? 0) > 0)
          .forEach((task) => {
            (task.reminders ?? []).forEach((reminder) => {
              const at = parseTrigger(reminder.trigger);
              // 回看 5 分钟 + 前瞻 60 秒，覆盖 60s 扫描周期与进程重启；靠 bucket 去重
              if (!Number.isFinite(at) || at < current - CATCHUP_MS || at > current + 60_000) return;
              fire(user.id, task, reminder.id, at, at < current - 60_000);
            });
          });

        if (config.dailyDigest) {
          const hour = Number(config.dailyDigestHour ?? 9);
          const localHour = new Date(current).getHours();
          const bucket = `digest-${new Date(current).toISOString().slice(0, 10)}`;
          if (localHour === hour) {
            const open = tasks
              .list(user.id)
              .filter((task) => task.status === 0 && task.dueDate)
              .slice(0, 8);
            const created = notifications.insert(user.id, {
              kind: 'daily',
              bucket,
              title: '今日任务概览',
              body: open.length ? open.map((task) => `- ${task.title}`).join('\n') : '今天没有待办，享受生活',
            });
            if (created) {
              broadcast(user.id, 'notification', {
                title: '📋 今日任务概览',
                body: open.length ? `${open.length} 项待办` : '今天没有待办',
                kind: 'daily',
              });
              void dispatch(user.id, 'daily', {
                title: '📋 今日任务概览',
                body: open.length ? open.map((task) => `- ${task.title}`).join('\n') : '今天没有待办，享受生活',
              });
            }
          }
        }
      });
  };

  setInterval(tick, 60_000);
  console.log('[notify] 调度器已启动（每 60s 扫描，提醒回看 5 分钟）');
}
