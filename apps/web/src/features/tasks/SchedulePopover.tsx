import { useState } from 'react';
import { Bell, CalendarClock, ChevronRight, X } from 'lucide-react';
import { addDays, addMinutes, dateKey, formatHHmm, parseDateTime, startOfDay, toDateTime } from '@youzhong/shared';
import type { Task, TaskPatch } from '@youzhong/shared';
import { Popover } from '@/components/ui/overlay';
import { patchTask } from '@/api/mutations';
import { useApp } from '@/store/app';
import { cn } from '@/lib/utils';

const REMINDER_OPTIONS = [
  { label: '准时', minutes: 0 },
  { label: '提前 5 分', minutes: 5 },
  { label: '提前 30 分', minutes: 30 },
  { label: '提前 1 小时', minutes: 60 },
];

/**
 * 笔记本里的「安排」入口：给临时记录补上日期 / 时间 / 提醒，或者直接转去别的清单。
 * 设好日期后，任务会自然出现在「今天」、最近 7 天与日历里（分组由 dueDate 决定）。
 */
export function SchedulePopover({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const projects = useApp((state) => state.projects);
  const due = parseDateTime(task.dueDate);
  const reminder = task.reminders?.[0];

  const apply = (patch: TaskPatch) => {
    void patchTask(task.id, patch);
    setOpen(false);
  };

  const setDay = (offset: number) => {
    const day = addDays(startOfDay(new Date()), offset);
    const next = due ?? day;
    const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), next.getHours(), next.getMinutes(), 0, 0);
    apply({ dueDate: toDateTime(date, task.isAllDay || !due), isAllDay: task.isAllDay || !due });
  };

  const setDate = (value: string) => {
    if (!value) {
      apply({ dueDate: undefined, reminders: [] });
      return;
    }
    const [y, m, d] = value.split('-').map(Number);
    const base = due ?? new Date();
    const next = new Date(y, m - 1, d, base.getHours(), base.getMinutes(), 0, 0);
    apply({ dueDate: toDateTime(next, task.isAllDay) });
  };

  const setTime = (value: string) => {
    if (!value) return;
    const [h, mi] = value.split(':').map(Number);
    const next = new Date(due ?? Date.now());
    next.setHours(h, mi, 0, 0);
    apply({ dueDate: toDateTime(next), isAllDay: false });
  };

  const applyReminder = (minutes: number) => {
    if (!due) return;
    apply({ reminders: [{ id: `${Date.now()}`, trigger: toDateTime(addMinutes(due, -minutes)) }] });
  };

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={`安排 ${task.title}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-colors',
          open ? 'bg-brand-50 text-brand' : 'text-faint hover:bg-subtle hover:text-brand',
        )}
      >
        <CalendarClock size={13} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="end" className="w-[262px] p-2.5">
        <p className="px-1 pb-1.5 text-2xs font-medium text-faint">安排到</p>
        <div className="mb-2 flex items-center gap-1 px-0.5">
          {[
            { label: '今天', offset: 0 },
            { label: '明天', offset: 1 },
            { label: '下周', offset: 7 },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setDay(item.offset)}
              className="h-7 flex-1 cursor-pointer rounded-lg border border-line text-xs text-muted transition-colors hover:border-brand/40 hover:bg-brand-50 hover:text-brand"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 px-0.5">
          <input
            type="date"
            value={due ? dateKey(due) : ''}
            onChange={(event) => setDate(event.target.value)}
            aria-label="日期"
            className="h-7 min-w-0 flex-1 cursor-pointer rounded-lg border border-line px-1.5 text-xs text-ink"
          />
          <input
            type="time"
            value={due && !task.isAllDay ? formatHHmm(due) : ''}
            step={60}
            disabled={!due}
            onChange={(event) => setTime(event.target.value)}
            aria-label="时间"
            className="h-7 w-[74px] cursor-pointer rounded-lg border border-line px-1.5 text-xs text-ink disabled:cursor-not-allowed disabled:opacity-45"
          />
          {due ? (
            <button
              type="button"
              aria-label="清除日期"
              onClick={() => apply({ dueDate: undefined, reminders: [] })}
              className="cursor-pointer rounded-md p-1 text-faint transition-colors hover:text-red-500"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>

        <div className="mt-2.5 px-0.5">
          <p className="mb-1 flex items-center gap-1 text-2xs font-medium text-faint">
            <Bell size={10} /> 提醒
            {reminder ? <span className="text-brand">· {formatHHmm(parseDateTime(reminder.trigger) ?? new Date())}</span> : null}
          </p>
          <div className="flex flex-wrap gap-1">
            {REMINDER_OPTIONS.map((option) => (
              <button
                key={option.minutes}
                type="button"
                disabled={!due}
                onClick={() => applyReminder(option.minutes)}
                className="h-6 cursor-pointer rounded-md border border-line px-1.5 text-2xs text-muted transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
              >
                {option.label}
              </button>
            ))}
          </div>
          {!due ? <p className="mt-1 text-2xs text-faint">先选个日期，才能设置提醒</p> : null}
        </div>

        <div className="mt-2.5 border-t border-line pt-2">
          <p className="mb-1 px-1 text-2xs font-medium text-faint">转移到清单</p>
          <div className="max-h-40 overflow-y-auto">
            {projects
              .filter((project) => project.id !== task.projectId)
              .map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => apply({ projectId: project.id })}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink transition-colors hover:bg-subtle"
                >
                  <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: project.color ?? '#0E9F8A' }} />
                  <span className="flex-1 truncate">{project.name}</span>
                  <ChevronRight size={11} className="text-faint" />
                </button>
              ))}
          </div>
        </div>

        <p className="mt-1.5 px-1 text-2xs leading-relaxed text-faint">设好日期后会出现在「今天」和日历里；换个清单就归到对应分类。</p>
      </Popover>
    </div>
  );
}
