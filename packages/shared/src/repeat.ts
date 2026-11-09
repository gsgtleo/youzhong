/** 重复规则：RRULE 片段，如 RRULE:FREQ=WEEKLY;INTERVAL=1 */

export type RepeatFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface RepeatConfig {
  freq: RepeatFreq;
  interval: number;
}

export function buildRepeat(freq: RepeatFreq, interval = 1): string {
  return `RRULE:FREQ=${freq};INTERVAL=${Math.max(1, Math.round(interval))}`;
}

export function parseRepeat(flag?: string | null): RepeatConfig | null {
  if (!flag) return null;
  const freq = /FREQ=(DAILY|WEEKLY|MONTHLY)/.exec(flag)?.[1] as RepeatFreq | undefined;
  if (!freq) return null;
  const interval = Number(/INTERVAL=(\d+)/.exec(flag)?.[1] ?? 1);
  return { freq, interval: Number.isFinite(interval) && interval > 0 ? interval : 1 };
}

export function repeatLabel(flag?: string | null): string {
  const config = parseRepeat(flag);
  if (!config) return '不重复';
  const { freq, interval } = config;
  if (freq === 'DAILY') return interval === 1 ? '每天' : `每 ${interval} 天`;
  if (freq === 'WEEKLY') return interval === 1 ? '每周' : `每 ${interval} 周`;
  return interval === 1 ? '每月' : `每 ${interval} 个月`;
}

/** 计算下一次到期时间：月末对齐（1/31 + 1 月 → 2/28），保留时分与时区 */
export function nextOccurrence(due: Date, flag?: string | null): Date | null {
  const config = parseRepeat(flag);
  if (!config) return null;
  const next = new Date(due);
  if (config.freq === 'DAILY') {
    next.setDate(next.getDate() + config.interval);
    return next;
  }
  if (config.freq === 'WEEKLY') {
    next.setDate(next.getDate() + 7 * config.interval);
    return next;
  }
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + config.interval);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

/**
 * 把重复任务展开成 [from, to] 区间内的所有发生时间（含首次 due 之后的续期）。
 * 用于日历排期预览：重复任务不能只显示首次那一条。
 */
export function occurrencesWithin(
  due: Date,
  flag: string | null | undefined,
  from: Date,
  to: Date,
  limit = 400,
): Date[] {
  const config = parseRepeat(flag);
  if (!config) return [];

  let cursor = new Date(due);
  // 起点远早于可视范围时快进，避免逐日循环
  let guard = 0;
  while (cursor.getTime() < from.getTime() && guard < 5000) {
    const next = nextOccurrence(cursor, flag);
    if (!next) return [];
    cursor = next;
    guard += 1;
  }

  const result: Date[] = [];
  while (cursor.getTime() <= to.getTime() && result.length < limit) {
    if (cursor.getTime() >= from.getTime()) result.push(new Date(cursor));
    const next = nextOccurrence(cursor, flag);
    if (!next) break;
    cursor = next;
  }
  return result;
}

export const REPEAT_PRESETS: { id: string; label: string; flag?: string }[] = [
  { id: 'none', label: '不重复' },
  { id: 'daily', label: '每天', flag: buildRepeat('DAILY', 1) },
  { id: 'weekly', label: '每周', flag: buildRepeat('WEEKLY', 1) },
  { id: 'monthly', label: '每月', flag: buildRepeat('MONTHLY', 1) },
];
