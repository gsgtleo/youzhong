import { useState } from 'react';
import { Bell, CalendarDays, ChevronDown, Clock, Flag, FolderDot, Repeat, Tag, X } from 'lucide-react';
import type { Priority, Task, TaskPatch } from '@youzhong/shared';
import { REPEAT_PRESETS, addMinutes, buildRepeat, dateKey, formatHHmm, parseDateTime, repeatLabel, toDateTime } from '@youzhong/shared';
import { Popover } from '@/components/ui/overlay';
import { PRIORITY_COLOR, PRIORITY_LABEL, cn } from '@/lib/utils';
import { useApp } from '@/store/app';

const PRIORITIES: Priority[] = [5, 3, 1, 0];

const REMINDER_OPTIONS = [
  { label: '准时提醒', minutes: 0 },
  { label: '提前 5 分钟', minutes: 5 },
  { label: '提前 30 分钟', minutes: 30 },
  { label: '提前 1 小时', minutes: 60 },
  { label: '提前 1 天', minutes: 1440 },
];

function Row({ icon, children, label }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-subtle/60">
      <span className="flex w-20 shrink-0 items-center gap-1.5 text-xs text-faint">
        {icon}
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

export function PropertyRows({ task, onChange }: { task: Task; onChange: (patch: TaskPatch) => void }) {
  const projects = useApp((state) => state.projects);
  const tags = useApp((state) => state.tags);
  const [projectOpen, setProjectOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [everyDays, setEveryDays] = useState(3);

  const due = parseDateTime(task.dueDate);
  const project = projects.find((item) => item.id === task.projectId);
  const activeTags = task.tags ?? [];
  const reminder = task.reminders?.[0];
  const reminderAt = reminder ? parseDateTime(reminder.trigger) : null;
  const reminderExpired = Boolean(reminderAt && reminderAt.getTime() < Date.now());

  /** 改截止时间时按相同偏移平移已有提醒，避免提醒留在旧时间变成过去时刻（设了却永远不响） */
  const shiftReminders = (from: Date | undefined, to: Date): Partial<TaskPatch> => {
    if (!task.reminders?.length || !from) return {};
    const delta = to.getTime() - from.getTime();
    if (!delta) return {};
    return {
      reminders: task.reminders.map((item) => {
        const at = parseDateTime(item.trigger);
        return at ? { ...item, trigger: toDateTime(new Date(at.getTime() + delta)) } : item;
      }),
    };
  };

  const setDate = (value: string) => {
    if (!value) {
      onChange({ dueDate: undefined, reminders: [] });
      return;
    }
    const [y, m, d] = value.split('-').map(Number);
    const base = due ?? new Date();
    const next = new Date(y, m - 1, d, base.getHours(), base.getMinutes(), 0, 0);
    onChange({ dueDate: toDateTime(next, task.isAllDay), ...shiftReminders(due, next) });
  };

  const setTime = (value: string) => {
    if (!value) return;
    const [h, mi] = value.split(':').map(Number);
    const next = new Date(due ?? Date.now());
    next.setHours(h, mi, 0, 0);
    onChange({ dueDate: toDateTime(next), isAllDay: false, ...shiftReminders(due, next) });
  };

  const applyReminder = (minutes: number) => {
    if (!due) return;
    onChange({
      reminders: [{ id: `${Date.now()}`, trigger: toDateTime(addMinutes(due, -minutes)) }],
    });
    setReminderOpen(false);
  };

  const toggleTag = (name: string) => {
    const next = activeTags.includes(name) ? activeTags.filter((tag) => tag !== name) : [...activeTags, name];
    onChange({ tags: next });
  };

  return (
    <div className="flex flex-col gap-0.5">
      <Row icon={<FolderDot size={13} />} label="清单">
        <div className="relative">
          <button
            type="button"
            onClick={() => setProjectOpen((open) => !open)}
            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2 text-xs text-ink transition-colors hover:border-brand/40"
          >
            <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: project?.color ?? '#0E9F8A' }} />
            {project?.name ?? '笔记本'}
            <ChevronDown size={11} className="text-faint" />
          </button>
          <Popover open={projectOpen} onClose={() => setProjectOpen(false)} align="start" className="max-h-64 overflow-y-auto">
            {projects.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange({ projectId: item.id });
                  setProjectOpen(false);
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors hover:bg-subtle',
                  item.id === task.projectId ? 'text-brand' : 'text-ink',
                )}
              >
                <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: item.color ?? '#0E9F8A' }} />
                <span className="flex-1 truncate text-left">{item.name}</span>
              </button>
            ))}
          </Popover>
        </div>
      </Row>

      <Row icon={<CalendarDays size={13} />} label="日期">
        <input
          type="date"
          value={due ? dateKey(due) : ''}
          onChange={(event) => setDate(event.target.value)}
          className="h-7 cursor-pointer rounded-lg border border-line px-2 text-xs text-ink"
          aria-label="截止日期"
        />
        {due ? (
          <>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} className="text-faint" />
              <input
                type="time"
                value={formatHHmm(due)}
                step={60}
                onChange={(event) => setTime(event.target.value)}
                className="h-7 cursor-pointer rounded-lg border border-line px-2 text-xs text-ink"
                aria-label="截止时间（可精确到分钟）"
              />
            </span>
            <button
              type="button"
              onClick={() => onChange({ isAllDay: !task.isAllDay, dueDate: toDateTime(due, !task.isAllDay) })}
              className={cn(
                'h-7 cursor-pointer rounded-lg border px-2 text-2xs transition-colors',
                task.isAllDay ? 'border-brand/40 bg-brand-50 text-brand' : 'border-line text-faint hover:text-ink',
              )}
            >
              全天
            </button>
            <button
              type="button"
              aria-label="清除日期"
              onClick={() => onChange({ dueDate: undefined, reminders: [] })}
              className="cursor-pointer rounded-md p-1 text-faint transition-colors hover:text-red-500"
            >
              <X size={12} />
            </button>
          </>
        ) : null}
      </Row>

      <Row icon={<Flag size={13} />} label="优先级">
        <div className="inline-flex items-center gap-1">
          {PRIORITIES.map((priority) => (
            <button
              key={priority}
              type="button"
              onClick={() => onChange({ priority })}
              className={cn(
                'h-7 cursor-pointer rounded-lg border px-2 text-2xs font-medium transition-all duration-150',
                task.priority === priority ? 'border-transparent text-white' : 'border-line text-muted hover:text-ink',
              )}
              style={task.priority === priority ? { backgroundColor: PRIORITY_COLOR[priority] } : undefined}
            >
              {PRIORITY_LABEL[priority]}
            </button>
          ))}
        </div>
      </Row>

      <Row icon={<Bell size={13} />} label="提醒">
        <div className="relative">
          <button
            type="button"
            onClick={() => setReminderOpen((open) => !open)}
            title={reminderExpired ? '提醒时间已过，重新选一个时间才会生效' : undefined}
            className={cn(
              'inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border px-2 text-2xs transition-colors',
              reminderExpired
                ? 'border-red-300 text-red-500 hover:border-red-400'
                : 'border-line text-muted hover:border-brand/40 hover:text-brand',
            )}
          >
            {reminder ? `已设置（${formatHHmm(parseDateTime(reminder.trigger) ?? new Date())}）` : '添加提醒'}
          </button>
          {reminderExpired ? <span className="ml-1.5 text-2xs text-red-500">已过期</span> : null}
          <Popover open={reminderOpen} onClose={() => setReminderOpen(false)} align="start">
            {REMINDER_OPTIONS.map((option) => (
              <button
                key={option.minutes}
                type="button"
                disabled={!due}
                onClick={() => applyReminder(option.minutes)}
                className="flex w-full cursor-pointer items-center rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
              >
                {option.label}
              </button>
            ))}
            {!due ? <p className="px-2.5 py-1 text-2xs text-faint">先设置截止时间才能添加提醒</p> : null}
          </Popover>
        </div>
      </Row>

      <Row icon={<Repeat size={13} />} label="重复">
        <div className="relative">
          <button
            type="button"
            onClick={() => setRepeatOpen((open) => !open)}
            className={cn(
              'inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border px-2 text-2xs transition-colors',
              task.repeatFlag ? 'border-brand/40 bg-brand-50 text-brand' : 'border-line text-muted hover:border-brand/40 hover:text-brand',
            )}
          >
            {repeatLabel(task.repeatFlag)}
            <ChevronDown size={11} />
          </button>
          <Popover open={repeatOpen} onClose={() => setRepeatOpen(false)} align="start" className="w-[220px]">
            {REPEAT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onChange({ repeatFlag: preset.flag });
                  setRepeatOpen(false);
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-subtle',
                  repeatLabel(task.repeatFlag) === preset.label ? 'text-brand' : 'text-ink',
                )}
              >
                {preset.label}
              </button>
            ))}
            <div className="mt-1 flex items-center gap-1.5 border-t border-line px-2 pb-1 pt-2">
              <span className="text-2xs text-faint">每隔</span>
              <input
                type="number"
                min={2}
                max={365}
                value={everyDays}
                onChange={(event) => setEveryDays(Math.max(2, Math.min(365, Number(event.target.value) || 2)))}
                aria-label="重复间隔天数"
                className="h-6 w-12 rounded-md border border-line px-1.5 text-center text-2xs text-ink"
              />
              <span className="text-2xs text-faint">天</span>
              <button
                type="button"
                onClick={() => {
                  onChange({ repeatFlag: buildRepeat('DAILY', everyDays) });
                  setRepeatOpen(false);
                }}
                className="ml-auto h-6 cursor-pointer rounded-md bg-brand px-2 text-2xs font-medium text-white hover:bg-brand-600"
              >
                应用
              </button>
            </div>
          </Popover>
        </div>
        {task.repeatFlag && due ? (
          <span className="text-2xs text-faint">完成一次后自动顺延到下一次</span>
        ) : null}
      </Row>

      <Row icon={<Tag size={13} />} label="标签">
        {activeTags.map((tag) => (
          <span key={tag} className="tag-chip bg-brand-50 text-brand">
            {tag}
            <button type="button" aria-label={`移除标签 ${tag}`} onClick={() => toggleTag(tag)} className="cursor-pointer">
              <X size={9} />
            </button>
          </span>
        ))}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTagOpen((open) => !open)}
            className="h-7 cursor-pointer rounded-lg border border-dashed border-line px-2 text-2xs text-faint transition-colors hover:border-brand/40 hover:text-brand"
          >
            + 标签
          </button>
          <Popover open={tagOpen} onClose={() => setTagOpen(false)} align="start" className="max-h-56 overflow-y-auto">
            {tags.length ? (
              tags.map((tag) => (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() => toggleTag(tag.name)}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] transition-colors hover:bg-subtle',
                    activeTags.includes(tag.name) ? 'text-brand' : 'text-ink',
                  )}
                >
                  <span>{tag.label ?? tag.name}</span>
                  {activeTags.includes(tag.name) ? <span className="text-2xs">已选</span> : null}
                </button>
              ))
            ) : (
              <p className="px-2.5 py-1.5 text-2xs text-faint">账号里还没有标签</p>
            )}
          </Popover>
        </div>
      </Row>
    </div>
  );
}
