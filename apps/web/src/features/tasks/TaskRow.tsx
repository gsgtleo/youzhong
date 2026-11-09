import { memo } from 'react';
import { Clock, Flag, ListChecks, Repeat, Tag, Trash2 } from 'lucide-react';
import type { Task } from '@youzhong/shared';
import { formatHHmm, isSameDay, isOverdue, parseDateTime, relativeDayLabel } from '@youzhong/shared';
import { Checkbox } from '@/components/ui/primitives';
import { SchedulePopover } from './SchedulePopover';
import { PRIORITY_COLOR, cn } from '@/lib/utils';

export interface TaskRowProps {
  task: Task;
  projectColor: string;
  showProject?: boolean;
  projectName?: string;
  selected?: boolean;
  compact?: boolean;
  /** 笔记本里显示「安排」入口（补日期 / 提醒 / 转清单） */
  schedulable?: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function dueLabel(task: Task): { text: string; overdue: boolean } | null {
  const due = parseDateTime(task.dueDate);
  if (!due) return null;
  const now = new Date();
  const overdue = isOverdue(task.dueDate, now) && task.status !== 2;
  const day = relativeDayLabel(due, now);
  if (task.isAllDay) return { text: day, overdue };
  const time = formatHHmm(due);
  if (isSameDay(due, now)) return { text: time, overdue };
  return { text: `${day} ${time}`, overdue };
}

export const TaskRow = memo(function TaskRow({
  task,
  projectColor,
  showProject,
  projectName,
  selected,
  compact,
  schedulable,
  onToggle,
  onSelect,
  onDelete,
}: TaskRowProps) {
  const done = task.status === 2;
  const due = dueLabel(task);
  const totalItems = task.items?.length ?? 0;
  const doneItems = task.items?.filter((item) => item.status === 2).length ?? 0;
  const tags = task.tags ?? [];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(task.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSelect(task.id);
      }}
      className={cn(
        'group relative flex cursor-pointer items-center gap-3 rounded-xl py-2 pl-4 pr-2 transition-colors duration-150',
        compact && 'py-1.5',
        selected ? 'bg-brand-50/70' : 'hover:bg-hover',
      )}
    >
      <span
        className="absolute left-1 top-1/2 h-[calc(100%-14px)] w-[3px] -translate-y-1/2 rounded-full"
        style={{ backgroundColor: PRIORITY_COLOR[task.priority], opacity: task.priority === 0 ? 0 : 1 }}
      />

      <Checkbox checked={done} onChange={() => onToggle(task.id)} color={projectColor} label={`完成 ${task.title}`} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p
            className={cn(
              'truncate text-[13.5px] leading-5',
              done ? 'text-faint line-through' : 'text-ink',
              task.priority === 5 && !done && 'font-medium',
            )}
          >
            {task.title}
          </p>
          {task.priority > 0 ? <Flag size={11} className="shrink-0" style={{ color: PRIORITY_COLOR[task.priority] }} strokeWidth={2.4} /> : null}
          {task.repeatFlag ? <Repeat size={11} className="shrink-0 text-faint" /> : null}
          {totalItems > 0 ? (
            <span className={cn('hidden shrink-0 items-center gap-0.5 text-2xs sm:flex', doneItems === totalItems ? 'text-emerald-600' : 'text-faint')}>
              <ListChecks size={10} /> {doneItems}/{totalItems}
            </span>
          ) : null}
          {tags.slice(0, 1).map((tag) => (
            <span key={tag} className="hidden shrink-0 items-center gap-1 text-2xs text-faint md:flex">
              <Tag size={9} /> {tag}
            </span>
          ))}
        </div>
        {task.content ? <p className="mt-0.5 truncate text-2xs text-faint">{task.content}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {schedulable ? <SchedulePopover task={task} /> : null}
        {showProject && projectName ? (
          <span className="hidden max-w-[120px] items-center gap-1 text-2xs text-faint md:flex">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: projectColor }} />
            <span className="truncate">{projectName}</span>
          </span>
        ) : null}
        {due ? (
          <span className={cn('inline-flex items-center gap-1 text-2xs tabular-nums', due.overdue ? 'text-red-500' : 'text-faint')}>
            <Clock size={10} /> {due.text}
          </span>
        ) : null}
        <button
          type="button"
          aria-label={`删除 ${task.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(task.id);
          }}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-faint opacity-0 transition-all hover:bg-subtle hover:text-red-500 group-hover:opacity-100"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
});
