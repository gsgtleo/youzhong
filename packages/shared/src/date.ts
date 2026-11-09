/**
 * 无第三方依赖的日期工具，保证前后端解析结果一致。
 * 项目内部统一的时间格式：2026-10-26T14:00:00.000+0800（无冒号的时区偏移）
 */

const PAD = (n: number) => String(n).padStart(2, '0');

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export function pad2(n: number): string {
  return PAD(n);
}

/** yyyy-MM-dd */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}`;
}

/** 解析 "2026-10-26T14:00:00.000+0800" / "2026-10-26T14:00:00+08:00" / "2026-10-26" */
export function parseDateTime(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [y, m, d] = normalized.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const withColon = normalized.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const parsed = new Date(withColon);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function offsetString(d: Date): string {
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${sign}${PAD(Math.floor(abs / 60))}${PAD(abs % 60)}`;
}

/** 序列化成接口使用的无冒号时区格式 */
export function toDateTime(d: Date, isAllDay = false): string {
  const day = `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
  if (isAllDay) return `${day}T00:00:00.000${offsetString(d)}`;
  const time = `${PAD(d.getHours())}:${PAD(d.getMinutes())}:00.000`;
  return `${day}T${time}${offsetString(d)}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function addDays(d: Date, amount: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMinutes(d: Date, amount: number): Date {
  return new Date(d.getTime() + amount * 60_000);
}

/** weekStartsOn: 1 = 周一，0 = 周日 */
export function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 1): Date {
  const base = startOfDay(d);
  const diff = (base.getDay() - weekStartsOn + 7) % 7;
  return addDays(base, -diff);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** 6 × 7 = 42 格的月视图矩阵 */
export function monthMatrix(anchor: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const first = startOfWeek(startOfMonth(anchor), weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function weekDays(anchor: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const first = startOfWeek(anchor, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function formatHHmm(d: Date): string {
  return `${PAD(d.getHours())}:${PAD(d.getMinutes())}`;
}

export function formatMonthDay(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatFull(d: Date): string {
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${weekday}`;
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

/** 15 分钟对齐 */
export function roundToStep(minutes: number, step = 15): number {
  return Math.round(minutes / step) * step;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 相对日期标签：今天 / 明天 / 昨天 / 10月28日 */
export function relativeDayLabel(d: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === 2) return '后天';
  if (diff === -1) return '昨天';
  if (d.getFullYear() !== now.getFullYear()) return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return formatMonthDay(d);
}

export function isOverdue(dueDate: string | undefined, now = new Date()): boolean {
  const due = parseDateTime(dueDate);
  if (!due) return false;
  return due.getTime() < startOfDay(now).getTime();
}
