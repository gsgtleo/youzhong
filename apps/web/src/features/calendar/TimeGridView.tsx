import { useMemo, useRef, useState } from 'react';
import type { CalendarEvent, Task } from '@youzhong/shared';
import {
  addDays,
  dateKey,
  formatHHmm,
  isSameDay,
  minutesFromMidnight,
  occurrencesWithin,
  parseDateTime,
  roundToStep,
  startOfDay,
  toDateTime,
  weekDays,
} from '@youzhong/shared';
import { useApp } from '@/store/app';
import { useUi } from '@/store/ui';
import { patchTask, updateEvent } from '@/api/mutations';
import { cn, hexToRgba } from '@/lib/utils';

const HOUR_HEIGHT = 48;
const START_HOUR = 6;
const END_HOUR = 24;

interface TimeGridViewProps {
  anchor: Date;
  mode: 'week' | 'day';
  projectFilter: string[];
  onOpenTask: (id: string) => void;
  onOpenEvent: (id: string) => void;
  /** 双击空白：在指定日期的指定时刻新建日程 */
  onCreateEventAt: (date: Date, time?: string) => void;
}

/** 重叠日程简单分列，避免同一时段互相遮挡 */
function layoutDay<T extends { start: Date; end: Date }>(items: T[]): (T & { col: number; cols: number })[] {
  const result: (T & { col: number; cols: number })[] = [];
  let cluster: T[] = [];
  let clusterEnd = 0;

  const flush = () => {
    if (!cluster.length) return;
    cluster.forEach((item, index) => result.push({ ...item, col: index, cols: cluster.length }));
    cluster = [];
    clusterEnd = 0;
  };

  items.forEach((item) => {
    if (cluster.length && item.start.getTime() >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end.getTime());
  });
  flush();
  return result;
}

interface DragState {
  kind: 'task' | 'event';
  id: string;
  dayIndex: number;
  deltaMinutes: number;
  startY: number;
  origin: Date;
}

export function TimeGridView({ anchor, mode, projectFilter, onOpenTask, onOpenEvent, onCreateEventAt }: TimeGridViewProps) {
  const tasks = useApp((state) => state.tasks);
  const events = useApp((state) => state.events);
  const projects = useApp((state) => state.projects);
  const weekStartsOn = useUi((state) => state.weekStartsOn);
  const [drag, setDrag] = useState<DragState>();

  const days = useMemo(
    () => (mode === 'week' ? weekDays(anchor, weekStartsOn) : [startOfDay(anchor)]),
    [anchor, mode, weekStartsOn],
  );

  const projectColor = (id: string) => projects.find((project) => project.id === id)?.color ?? '#0E9F8A';

  const { timed, allDay } = useMemo(() => {
    const timedMap: Record<string, { task?: Task; event?: CalendarEvent; start: Date; end: Date; color: string; title: string; id: string; kind: 'task' | 'event' }[]> = {};
    const allDayMap: Record<string, { title: string; color: string; id: string; kind: 'task' | 'event' }[]> = {};
    const push = (key: string, item: (typeof timedMap)[string][number]) => {
      if (!timedMap[key]) timedMap[key] = [];
      timedMap[key].push(item);
    };

    const rangeStart = startOfDay(days[0]);
    const rangeEnd = addDays(startOfDay(days[days.length - 1]), 1);

    Object.values(tasks).forEach((task) => {
      if (task.status === 2) return;
      if (projectFilter.length && !projectFilter.includes(task.projectId)) return;
      const due = parseDateTime(task.dueDate);
      if (!due) return;
      const color = projectColor(task.projectId);
      // 重复任务展开成视图范围内的所有发生日
      const occurrences = task.repeatFlag
        ? occurrencesWithin(due, task.repeatFlag, rangeStart, rangeEnd)
        : due >= rangeStart && due < rangeEnd
          ? [due]
          : [];

      occurrences.forEach((start) => {
        const key = dateKey(start);
        if (task.isAllDay) {
          if (!allDayMap[key]) allDayMap[key] = [];
          allDayMap[key].push({ title: task.title, color, id: task.id, kind: 'task' });
          return;
        }
        push(key, { task, start, end: new Date(start.getTime() + 30 * 60_000), color, title: task.title, id: task.id, kind: 'task' });
      });
    });

    events.forEach((event) => {
      const start = parseDateTime(event.startDate);
      if (!start) return;
      const key = dateKey(start);
      if (event.isAllDay) {
        if (!allDayMap[key]) allDayMap[key] = [];
        allDayMap[key].push({ title: event.summary, color: event.color ?? '#0E9F8A', id: event.id, kind: 'event' });
        return;
      }
      const end = parseDateTime(event.endDate) ?? new Date(start.getTime() + 60 * 60_000);
      push(key, { event, start, end, color: event.color ?? '#0E9F8A', title: event.summary, id: event.id, kind: 'event' });
    });

    Object.values(timedMap).forEach((list) => list.sort((a, b) => a.start.getTime() - b.start.getTime()));
    return { timed: timedMap, allDay: allDayMap };
  }, [tasks, events, projectFilter, projects, days]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const nowTop = ((minutesFromMidnight(now) - START_HOUR * 60) / 60) * HOUR_HEIGHT;

  const startDrag = (event: React.PointerEvent, item: { id: string; kind: 'task' | 'event'; start: Date }, dayIndex: number) => {
    event.stopPropagation();
    const startY = event.clientY;
    setDrag({ kind: item.kind, id: item.id, dayIndex, deltaMinutes: 0, startY, origin: item.start });
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    const deltaY = event.clientY - drag.startY;
    const deltaMinutes = Math.round((deltaY / HOUR_HEIGHT) * 60 / 15) * 15;
    if (deltaMinutes !== drag.deltaMinutes) setDrag({ ...drag, deltaMinutes });
  };

  const finishDrag = () => {
    if (!drag) return;
    const { kind, id, origin, deltaMinutes } = drag;
    setDrag(undefined);
    if (deltaMinutes === 0) return;
    const next = new Date(origin.getTime() + deltaMinutes * 60_000);
    if (kind === 'task') {
      const task = useApp.getState().tasks[id];
      if (task) void patchTask(id, { dueDate: toDateTime(next), isAllDay: false });
    } else {
      const item = useApp.getState().events.find((row) => row.id === id);
      if (item) {
        const end = parseDateTime(item.endDate);
        const duration = end ? end.getTime() - origin.getTime() : 3_600_000;
        void updateEvent({ ...item, startDate: toDateTime(next), endDate: toDateTime(new Date(next.getTime() + duration)) });
      }
    }
  };

  /** 把点击位置换算成 HH:mm（按 30 分钟取整，限制在可视范围内） */
  const timeAt = (offsetY: number): string => {
    const raw = roundToStep((offsetY / HOUR_HEIGHT) * 60 + START_HOUR * 60, 30);
    const minutes = Math.min(Math.max(raw, START_HOUR * 60), 23 * 60 + 30);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex border-b border-line bg-subtle/40">
        <div className="w-14 shrink-0" />
        {days.map((day) => {
          const today = isSameDay(day, new Date());
          return (
            <div key={dateKey(day)} className="flex flex-1 flex-col items-center gap-0.5 border-l border-line/60 py-2">
              <span className="text-2xs text-faint">
                周{['日', '一', '二', '三', '四', '五', '六'][day.getDay()]}
              </span>
              <span
                className={cn(
                  'flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[13px] font-semibold tabular-nums',
                  today ? 'bg-brand text-white' : 'text-ink',
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex border-b border-line bg-panel">
        <div className="flex w-14 shrink-0 items-center justify-end pr-1.5 text-2xs text-faint">全天</div>
        {days.map((day) => {
          const key = dateKey(day);
          const chips = allDay[key] ?? [];
          return (
            <div key={key} className="flex min-h-9 flex-1 flex-col gap-0.5 border-l border-line/60 p-1">
              {chips.slice(0, 2).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => (chip.kind === 'task' ? onOpenTask(chip.id) : onOpenEvent(chip.id))}
                  onDoubleClick={(event) => event.stopPropagation()}
                  style={{ backgroundColor: hexToRgba(chip.color, 0.14), color: chip.color }}
                  className="truncate rounded px-1.5 py-0.5 text-left text-2xs font-medium"
                >
                  {chip.title}
                </button>
              ))}
              {chips.length > 2 ? <span className="px-1 text-2xs text-faint">+{chips.length - 2}</span> : null}
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
          <div className="relative w-14 shrink-0">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-1.5 text-2xs tabular-nums text-faint"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT + 2 }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {days.map((day, dayIndex) => {
            const key = dateKey(day);
            const list = timed[key] ?? [];
            const today = isSameDay(day, now);
            return (
              <div
                key={key}
                className="relative flex-1 border-l border-line/60"
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${HOUR_HEIGHT}px)`,
                }}
                onDoubleClick={(event) => {
                  // 只有双击真正的空白处才新建，避免在已有色块上双击重复创建
                  if (event.target !== event.currentTarget) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  onCreateEventAt(day, timeAt(event.clientY - rect.top));
                }}
              >
                {today && nowTop > 0 ? (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                    <div className="relative h-0 border-t border-red-500">
                      <span className="absolute -left-1 -top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                    </div>
                  </div>
                ) : null}

                {layoutDay(list).map((item) => {
                  const startMinutes = minutesFromMidnight(item.start);
                  const durationMinutes = Math.max(30, (item.end.getTime() - item.start.getTime()) / 60_000);
                  const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                  const height = Math.max(22, (durationMinutes / 60) * HOUR_HEIGHT - 2);
                  const isDragging = drag?.id === item.id && drag.dayIndex === dayIndex;
                  const offset = isDragging ? (drag.deltaMinutes / 60) * HOUR_HEIGHT : 0;
                  if (top < 0) return null;

                  return (
                    <button
                      key={`${item.kind}_${item.id}`}
                      type="button"
                      onPointerDown={(event) => startDrag(event, item, dayIndex)}
                      onPointerMove={onPointerMove}
                      onPointerUp={finishDrag}
                      onPointerCancel={finishDrag}
                      onClick={() => (item.kind === 'task' ? onOpenTask(item.id) : onOpenEvent(item.id))}
                      onDoubleClick={(event) => event.stopPropagation()}
                      style={{
                        top,
                        height,
                        left: `calc(${(item.col / item.cols) * 100}% + 4px)`,
                        width: `calc(${100 / item.cols}% - 8px)`,
                        transform: `translateY(${offset}px)`,
                        backgroundColor: item.kind === 'task' ? hexToRgba(item.color, 0.14) : 'var(--panel)',
                        borderColor: hexToRgba(item.color, 0.45),
                        color: item.color,
                        zIndex: isDragging ? 30 : 10,
                      }}
                      className={cn(
                        'absolute cursor-grab overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left transition-shadow active:cursor-grabbing',
                        isDragging && 'shadow-drag',
                      )}
                    >
                      <span className="block truncate text-2xs font-semibold leading-4">{item.title}</span>
                      <span className="block text-2xs tabular-nums opacity-75">
                        {formatHHmm(item.start)}
                        {durationMinutes >= 30 ? ` - ${formatHHmm(item.end)}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line px-3 py-2 text-2xs text-faint">
        <span>拖动色块调整时间 · 双击空白处新建日程</span>
        <span className="hidden items-center gap-2 md:flex">
          <span className="h-2 w-2 rounded-sm bg-brand/20 ring-1 ring-brand/40" /> 任务
          <span className="ml-2 h-2 w-2 rounded-sm border border-brand/50" /> 日程
        </span>
      </div>
    </div>
  );
}
