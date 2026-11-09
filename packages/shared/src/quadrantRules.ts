import type { Priority, Quadrant, QuadrantRule, Task, TaskPatch } from './types';
import { addDays, parseDateTime, startOfDay, toDateTime } from './date';

export interface QuadrantMeta {
  id: Quadrant;
  title: string;
  subtitle: string;
  action: string;
  color: string;
  soft: string;
  ring: string;
}

export const QUADRANT_ORDER: Quadrant[] = ['q1', 'q2', 'q3', 'q4'];

export const QUADRANT_META: Record<Quadrant, QuadrantMeta> = {
  q1: {
    id: 'q1',
    title: '重要且紧急',
    subtitle: '立即执行',
    action: '马上做',
    color: '#E5484D',
    soft: 'rgba(229, 72, 77, 0.10)',
    ring: 'rgba(229, 72, 77, 0.35)',
  },
  q2: {
    id: 'q2',
    title: '重要不紧急',
    subtitle: '计划推进',
    action: '安排时间',
    color: '#3B82F6',
    soft: 'rgba(59, 130, 246, 0.10)',
    ring: 'rgba(59, 130, 246, 0.35)',
  },
  q3: {
    id: 'q3',
    title: '紧急不重要',
    subtitle: '尽快处理',
    action: '委托或快速清掉',
    color: '#F5A623',
    soft: 'rgba(245, 166, 35, 0.12)',
    ring: 'rgba(245, 166, 35, 0.35)',
  },
  q4: {
    id: 'q4',
    title: '不重要不紧急',
    subtitle: '有空再说',
    action: '限制时间',
    color: '#8B95A7',
    soft: 'rgba(139, 149, 167, 0.12)',
    ring: 'rgba(139, 149, 167, 0.35)',
  },
};

/** 规则组合 1：象限 ↔ 优先级（默认规则） */
export function priorityToQuadrant(priority: Priority): Quadrant {
  if (priority === 5) return 'q1';
  if (priority === 3) return 'q2';
  if (priority === 1) return 'q3';
  return 'q4';
}

export function quadrantToPriority(quadrant: Quadrant): Priority {
  if (quadrant === 'q1') return 5;
  if (quadrant === 'q2') return 3;
  if (quadrant === 'q3') return 1;
  return 0;
}

function atTime(base: Date, hour: number, minute = 0): Date {
  const d = startOfDay(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** 规则组合 2 的紧急判定：已逾期或 48 小时内到期 */
export function isUrgent(task: Task, now: Date): boolean {
  const due = parseDateTime(task.dueDate);
  if (!due) return false;
  const horizon = now.getTime() + 48 * 3_600_000;
  return due.getTime() <= horizon;
}

export function isImportant(task: Task): boolean {
  return task.priority >= 3;
}

const priorityRule: QuadrantRule = {
  id: 'priority',
  name: '象限对应优先级',
  description: '四个象限分别对应 高 / 中 / 低 / 无 四种优先级，拖动任务即修改优先级。',
  quadrantOf(task) {
    return priorityToQuadrant(task.priority);
  },
  applyDrag(_task, target) {
    return { priority: quadrantToPriority(target) };
  },
};

const urgencyRule: QuadrantRule = {
  id: 'urgency',
  name: '重要看优先级，紧急看时间',
  description: '优先级代表重要程度，截止时间代表紧急程度；拖动任务会同时调整两者。',
  quadrantOf(task, now) {
    const important = isImportant(task);
    const urgent = isUrgent(task, now);
    if (important && urgent) return 'q1';
    if (important) return 'q2';
    if (urgent) return 'q3';
    return 'q4';
  },
  applyDrag(_task, target, now): TaskPatch {
    const today = startOfDay(now);
    if (target === 'q1') {
      const due = atTime(today, 18, 0);
      return { priority: 5, dueDate: toDateTime(due), isAllDay: false };
    }
    if (target === 'q2') {
      const due = atTime(addDays(today, 3), 18, 0);
      return { priority: 5, dueDate: toDateTime(due), isAllDay: false };
    }
    if (target === 'q3') {
      const due = atTime(today, 18, 0);
      return { priority: 1, dueDate: toDateTime(due), isAllDay: false };
    }
    const due = atTime(addDays(today, 7), 18, 0);
    return { priority: 0, dueDate: toDateTime(due), isAllDay: false };
  },
};

export const QUADRANT_RULES: Record<QuadrantRule['id'], QuadrantRule> = {
  priority: priorityRule,
  urgency: urgencyRule,
};

export const DEFAULT_RULE_ID: QuadrantRule['id'] = 'priority';

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  5: { label: '高优先级', color: '#E5484D' },
  3: { label: '中优先级', color: '#F5A623' },
  1: { label: '低优先级', color: '#3B82F6' },
  0: { label: '无优先级', color: '#C4CBD6' },
};
