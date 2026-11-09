import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Priority } from '@youzhong/shared';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function hexToRgba(hex: string | undefined, alpha: number): string {
  const fallback = `rgb(var(--brand-rgb) / ${alpha})`;
  if (!hex) return fallback;
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return fallback;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 任务 id 统一为 24 位十六进制，客户端本地新建时与服务端生成规则保持一致 */
export function newId(): string {
  let out = '';
  for (let i = 0; i < 24; i += 1) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

export const PRIORITY_COLOR: Record<Priority, string> = {
  5: '#E5484D',
  3: '#F5A623',
  1: '#3B82F6',
  0: '#C4CBD6',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  5: '高',
  3: '中',
  1: '低',
  0: '无',
};

export function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || 'T';
}

export function pluralTasks(count: number): string {
  return `${count} 项任务`;
}

export function sortedEntries<T>(record: Record<string, T>, compare: (a: T, b: T) => number): T[] {
  return Object.values(record).sort(compare);
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}
