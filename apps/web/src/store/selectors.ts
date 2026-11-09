import { addDays, dateKey, isSameDay, parseDateTime, startOfDay } from '@youzhong/shared';
import type { Task } from '@youzhong/shared';
import type { Filters, SortBy } from './ui';

export type SmartList = 'today' | 'week' | 'inbox' | 'completed' | 'all';

export interface TaskQuery {
  smart?: SmartList;
  projectId?: string;
  query?: string;
  filters: Filters;
  sortBy: SortBy;
}

export function taskDate(task: Task): Date | undefined {
  return parseDateTime(task.dueDate);
}

export function taskDayKey(task: Task): string | undefined {
  const due = taskDate(task);
  return due ? dateKey(due) : undefined;
}

export function compareByTime(a: Task, b: Task): number {
  const aDue = taskDate(a);
  const bDue = taskDate(b);
  if (aDue && bDue) {
    const diff = aDue.getTime() - bDue.getTime();
    if (diff !== 0) return diff;
  } else if (aDue) return -1;
  else if (bDue) return 1;
  if (a.priority !== b.priority) return b.priority - a.priority;
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
}

export function buildDateIndex(tasks: Record<string, Task>): Map<string, Task[]> {
  const index = new Map<string, Task[]>();
  Object.values(tasks).forEach((task) => {
    const key = taskDayKey(task);
    if (!key) return;
    const bucket = index.get(key);
    if (bucket) bucket.push(task);
    else index.set(key, [task]);
  });
  index.forEach((bucket) => bucket.sort(compareByTime));
  return index;
}

export function sortTasks(list: Task[], sortBy: SortBy, now = new Date()): Task[] {
  const sorted = [...list];
  if (sortBy === 'priority') {
    sorted.sort((a, b) => b.priority - a.priority || compareByTime(a, b));
    return sorted;
  }
  if (sortBy === 'due') {
    sorted.sort(compareByTime);
    return sorted;
  }
  if (sortBy === 'created') {
    sorted.sort((a, b) => (b.createdTime ?? '').localeCompare(a.createdTime ?? ''));
    return sorted;
  }
  const today = startOfDay(now).getTime();
  sorted.sort((a, b) => {
    const aDue = taskDate(a);
    const bDue = taskDate(b);
    const aOverdue = Boolean(aDue && aDue.getTime() < today);
    const bOverdue = Boolean(bDue && bDue.getTime() < today);
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return compareByTime(a, b);
  });
  return sorted;
}

export function queryTasks(tasks: Record<string, Task>, options: TaskQuery, now = new Date()): Task[] {
  const { smart, projectId, query, filters, sortBy } = options;
  const today = startOfDay(now);
  const weekEnd = addDays(today, 7);
  const keyword = query?.trim().toLowerCase();

  const result = Object.values(tasks).filter((task) => {
    if (smart === 'completed' && task.status !== 2) return false;
    if (smart !== 'completed' && filters.onlyOpen && task.status === 2) return false;
    if (projectId && task.projectId !== projectId) return false;

    if (smart === 'today') {
      const due = taskDate(task);
      if (!due) {
        // 未设日期的未完成任务常驻「今天」：不改 dueDate、不生成每日重复；完成后自动收起
        return task.status !== 2;
      }
      if (due.getTime() >= today.getTime() + 86_400_000) return false;
    }

    if (smart === 'week') {
      const due = taskDate(task);
      if (!due) return false;
      if (due.getTime() > weekEnd.getTime()) return false;
    }

    if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false;
    if (filters.projectIds.length && !filters.projectIds.includes(task.projectId)) return false;
    if (filters.tags.length && !(task.tags ?? []).some((tag) => filters.tags.includes(tag))) return false;

    if (keyword) {
      const haystack = [task.title, task.content, ...(task.tags ?? []), ...(task.items ?? []).map((item) => item.title)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }

    return true;
  });

  return sortTasks(result, sortBy, now);
}

export interface TaskGroup {
  key: string;
  title: string;
  tasks: Task[];
  tone?: 'danger' | 'brand' | 'muted';
}

export interface TaskGroupOptions {
  /** 「今天」页把未设日期且未完成的任务并入「今天」分组，避免额外出现「未安排」区 */
  undatedInToday?: boolean;
}

export function groupTasks(list: Task[], now = new Date(), options: TaskGroupOptions = {}): TaskGroup[] {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);

  const groups: Record<string, TaskGroup> = {
    overdue: { key: 'overdue', title: '已逾期', tasks: [], tone: 'danger' },
    today: { key: 'today', title: '今天', tasks: [], tone: 'brand' },
    tomorrow: { key: 'tomorrow', title: '明天', tasks: [] },
    week: { key: 'week', title: '接下来 7 天', tasks: [] },
    later: { key: 'later', title: '以后', tasks: [] },
    someday: { key: 'someday', title: '未安排', tasks: [], tone: 'muted' },
    done: { key: 'done', title: '已完成', tasks: [], tone: 'muted' },
  };

  list.forEach((task) => {
    if (task.status === 2) {
      groups.done.tasks.push(task);
      return;
    }
    const due = taskDate(task);
    if (!due) {
      if (options.undatedInToday) groups.today.tasks.push(task);
      else groups.someday.tasks.push(task);
      return;
    }
    if (due.getTime() < today.getTime()) groups.overdue.tasks.push(task);
    else if (isSameDay(due, today)) groups.today.tasks.push(task);
    else if (isSameDay(due, tomorrow)) groups.tomorrow.tasks.push(task);
    else if (due.getTime() <= weekEnd.getTime()) groups.week.tasks.push(task);
    else groups.later.tasks.push(task);
  });

  return ['overdue', 'today', 'tomorrow', 'week', 'later', 'someday', 'done']
    .map((key) => groups[key])
    .filter((group) => group.tasks.length > 0);
}
