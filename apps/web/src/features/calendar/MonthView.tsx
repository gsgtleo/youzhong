import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { CalendarEvent, Task } from '@youzhong/shared';
import {
  WEEKDAY_LABELS,
  addDays,
  dateKey,
  formatHHmm,
  isSameDay,
  monthMatrix,
  occurrencesWithin,
  parseDateTime,
  startOfDay,
  toDateTime,
} from '@youzhong/shared';
import { useApp } from '@/store/app';
import { useUi } from '@/store/ui';
import { createTask, patchTask } from '@/api/mutations';
import { hexToRgba } from '@/lib/utils';
import { cn } from '@/lib/utils';

const MAX_ITEMS = 2;

interface MonthViewProps {
  anchor: Date;
  selected: Date;
  projectFilter: string[];
  onSelectDate: (date: Date) => void;
  onSwitchDay: (date: Date) => void;
  onOpenEvent: (id: string) => void;
}

function buildIndexes(
  tasks: Record<string, Task>,
  events: CalendarEvent[],
  projectFilter: string[],
  rangeStart: Date,
  rangeEnd: Date,
) {
  const taskIndex = new Map<string, Task[]>();
  const eventIndex = new Map<string, CalendarEvent[]>();

  Object.values(tasks).forEach((task) => {
    if (projectFilter.length && !projectFilter.includes(task.projectId)) return;
    if (task.status === 2) return;
    const due = parseDateTime(task.dueDate);
    if (!due) return;
    // 重复任务展开成区间内所有发生日，避免日历只显示首次
    const dates = task.repeatFlag
      ? occurrencesWithin(due, task.repeatFlag, rangeStart, rangeEnd)
      : due >= rangeStart && due < rangeEnd
        ? [due]
        : [];
    dates.forEach((occurrence) => {
      const key = dateKey(occurrence);
      const bucket = taskIndex.get(key);
      if (bucket) bucket.push(task);
      else taskIndex.set(key, [task]);
    });
  });

  events.forEach((event) => {
    const start = parseDateTime(event.startDate);
    if (!start) return;
    const key = dateKey(start);
    const bucket = eventIndex.get(key);
    if (bucket) bucket.push(event);
    else eventIndex.set(key, [event]);
  });

  taskIndex.forEach((bucket) => bucket.sort((a, b) => (a.isAllDay === b.isAllDay ? 0 : a.isAllDay ? -1 : 1)));
  eventIndex.forEach((bucket) => bucket.sort((a, b) => a.startDate.localeCompare(b.startDate)));
  return { taskIndex, eventIndex };
}

export function MonthView({ anchor, selected, projectFilter, onSelectDate, onSwitchDay, onOpenEvent }: MonthViewProps) {
  const tasks = useApp((state) => state.tasks);
  const events = useApp((state) => state.events);
  const projects = useApp((state) => state.projects);
  const weekStartsOn = useUi((state) => state.weekStartsOn);
  const selectTask = useUi((state) => state.selectTask);
  const [dragOver, setDragOver] = useState<string>();

  const days = useMemo(() => monthMatrix(anchor, weekStartsOn), [anchor, weekStartsOn]);
  const { taskIndex, eventIndex } = useMemo(
    () =>
      buildIndexes(
        tasks,
        events,
        projectFilter,
        startOfDay(days[0]),
        addDays(startOfDay(days[days.length - 1]), 1),
      ),
    [tasks, events, projectFilter, days],
  );
  const projectColor = (id: string) => projects.find((project) => project.id === id)?.color ?? '#0E9F8A';

  const weekdays = weekStartsOn === 1 ? WEEKDAY_LABELS : ['日', ...WEEKDAY_LABELS.slice(0, 6)];

  const handleDrop = (event: React.DragEvent, day: Date) => {
    event.preventDefault();
    setDragOver(undefined);
    const taskId = event.dataTransfer.getData('text/task-id');
    const task = tasks[taskId];
    if (!task) return;
    const source = parseDateTime(task.dueDate);
    const next = new Date(day);
    if (source && !task.isAllDay) next.setHours(source.getHours(), source.getMinutes(), 0, 0);
    else next.setHours(9, 0, 0, 0);
    void patchTask(taskId, { dueDate: toDateTime(next, task.isAllDay) });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="grid grid-cols-7 border-b border-line bg-subtle/50">
        {weekdays.map((label) => (
          <div key={label} className="py-2 text-center text-2xs font-semibold uppercase tracking-wider text-faint">
            周{label}
          </div>
        ))}
      </div>

      <div className="grid flex-1 auto-rows-[minmax(96px,auto)] grid-cols-7 overflow-y-auto md:auto-rows-[minmax(0,1fr)] md:overflow-hidden">
        {days.map((day, index) => {
          const key = dateKey(day);
          const inMonth = day.getMonth() === anchor.getMonth();
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selected);
          const dayTasks = taskIndex.get(key) ?? [];
          const dayEvents = eventIndex.get(key) ?? [];
          const items: { id: string; type: 'task' | 'event'; label: string; color: string; time?: string; allDay?: boolean }[] = [
            ...dayEvents.map((event) => ({
              id: event.id,
              type: 'event' as const,
              label: event.summary,
              color: event.color ?? '#0E9F8A',
              time: event.isAllDay ? undefined : formatHHmm(parseDateTime(event.startDate) ?? day),
              allDay: event.isAllDay,
            })),
            ...dayTasks.map((task) => ({
              id: task.id,
              type: 'task' as const,
              label: task.title,
              color: projectColor(task.projectId),
              time: task.isAllDay ? undefined : formatHHmm(parseDateTime(task.dueDate) ?? day),
              allDay: task.isAllDay,
            })),
          ];
          const visible = items.slice(0, MAX_ITEMS);
          const overflow = items.length - visible.length;

          return (
            <div
              key={key}
              onClick={() => onSelectDate(day)}
              onDoubleClick={() => onSwitchDay(day)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(key);
              }}
              onDragLeave={() => setDragOver((current) => (current === key ? undefined : current))}
              onDrop={(event) => handleDrop(event, day)}
              className={cn(
                'group relative flex min-h-[96px] cursor-pointer flex-col gap-1 overflow-hidden border-b border-r border-line/70 p-1.5 transition-colors md:min-h-0',
                index % 7 === 6 && 'border-r-0',
                !inMonth && 'bg-subtle/30',
                isSelected && 'bg-brand-50/40',
                dragOver === key && 'bg-brand-50 ring-2 ring-inset ring-brand/40',
              )}
            >
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={cn(
                    'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums transition-colors',
                    isToday ? 'bg-brand text-white' : inMonth ? 'text-ink' : 'text-faint',
                  )}
                >
                  {day.getDate()}
                </span>
                <button
                  type="button"
                  aria-label="新建任务"
                  onClick={(event) => {
                    event.stopPropagation();
                    void createTask({
                      projectId: projectFilter[0] ?? 'inbox',
                      title: '新任务',
                      dueDate: toDateTime(day),
                      isAllDay: true,
                    }).then((task) => selectTask(task.id));
                  }}
                  className="hidden h-5 w-5 cursor-pointer items-center justify-center rounded text-faint hover:bg-panel hover:text-brand group-hover:flex"
                >
                  <Plus size={12} />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {visible.map((item) => (
                  <button
                    key={`${item.type}_${item.id}`}
                    type="button"
                    draggable={item.type === 'task'}
                    onDragStart={(event) => {
                      if (item.type !== 'task') return;
                      event.dataTransfer.setData('text/task-id', item.id);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (item.type === 'task') selectTask(item.id);
                      else onOpenEvent(item.id);
                    }}
                    style={
                      item.type === 'task'
                        ? { backgroundColor: hexToRgba(item.color, 0.12), color: item.color }
                        : { borderColor: hexToRgba(item.color, 0.5), color: item.color }
                    }
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-2xs font-medium transition-transform hover:scale-[1.01]',
                      item.type === 'event' && 'border bg-transparent',
                    )}
                    title={item.label}
                  >
                    {item.time ? <span className="shrink-0 tabular-nums opacity-80">{item.time}</span> : null}
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
                {overflow > 0 ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSwitchDay(day);
                    }}
                    className="cursor-pointer px-1.5 text-left text-2xs text-faint transition-colors hover:text-brand"
                  >
                    还有 {overflow} 项
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function monthLabel(anchor: Date): string {
  return `${anchor.getFullYear()} 年 ${anchor.getMonth() + 1} 月`;
}

export function shiftMonth(anchor: Date, delta: number): Date {
  return startOfDay(addDays(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1), 0));
}
