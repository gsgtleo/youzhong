import { addDays, startOfDay, toDateTime } from '@youzhong/shared';
import type { Priority } from '@youzhong/shared';

export interface QuickParseResult {
  title: string;
  dueDate?: string;
  priority: Priority;
  isAllDay: boolean;
}

const WEEKDAY_MAP: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };

/**
 * 极简自然语言解析：今天/明天/后天/周三、10:30/10点、!高 / !中 / !低 / p1-p4
 * 仅做本地预填，不追求完整语义，落库前仍会走标准字段。
 */
export function parseQuickInput(input: string, now = new Date()): QuickParseResult {
  let text = ` ${input} `;
  let baseDate: Date | undefined;
  let hasTime = false;
  let hour = 9;
  let minute = 0;
  let priority: Priority = 0;

  const relative = text.match(/(今天|明天|后天|大后天)/);
  if (relative) {
    const offset = { 今天: 0, 明天: 1, 后天: 2, 大后天: 3 }[relative[1] as '今天'];
    baseDate = addDays(startOfDay(now), offset);
    text = text.replace(relative[0], ' ');
  }

  if (!baseDate) {
    const weekday = text.match(/(?:周|星期)([一二三四五六日天])/);
    if (weekday) {
      const target = WEEKDAY_MAP[weekday[1]];
      const today = startOfDay(now);
      let diff = (target - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      baseDate = addDays(today, diff);
      text = text.replace(weekday[0], ' ');
    }
  }

  const monthDay = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
  if (!baseDate && monthDay) {
    const year = now.getFullYear();
    baseDate = new Date(year, Number(monthDay[1]) - 1, Number(monthDay[2]));
    text = text.replace(monthDay[0], ' ');
  }

  const timeMatch = text.match(/(\d{1,2})[:：](\d{2})/) ?? text.match(/(\d{1,2})\s*[点時时]/);
  if (timeMatch) {
    hour = Math.min(23, Number(timeMatch[1]));
    minute = timeMatch[2] ? Math.min(59, Number(timeMatch[2])) : 0;
    hasTime = true;
    text = text.replace(timeMatch[0], ' ');
    if (!baseDate) baseDate = startOfDay(now);
  }

  const priorityMatch = text.match(/[!！]\s*(高|中|低)/) ?? text.match(/\bp([1-4])\b/i);
  if (priorityMatch) {
    const raw = priorityMatch[1];
    priority = raw === '高' || raw === '1' ? 5 : raw === '中' || raw === '2' ? 3 : raw === '低' || raw === '3' ? 1 : 0;
    text = text.replace(priorityMatch[0], ' ');
  }

  let dueDate: string | undefined;
  if (baseDate) {
    const due = new Date(baseDate);
    if (hasTime) due.setHours(hour, minute, 0, 0);
    else due.setHours(9, 0, 0, 0);
    dueDate = toDateTime(due, !hasTime);
  }

  return {
    title: text.replace(/\s+/g, ' ').trim(),
    dueDate,
    priority,
    isAllDay: Boolean(baseDate) && !hasTime,
  };
}

export const QUICK_HINTS = ['明天 10:00 提交周报 !高', '今晚 20点 给妈妈打电话', '周五 复盘会议'];
