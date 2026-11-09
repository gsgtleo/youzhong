import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAY_LABELS, dateKey, isSameDay, monthMatrix, parseDateTime } from '@youzhong/shared';
import { IconButton } from '@/components/ui/primitives';
import { useApp } from '@/store/app';
import { cn } from '@/lib/utils';

interface MiniCalendarProps {
  anchor: Date;
  selected: Date;
  weekStartsOn: 0 | 1;
  onSelect: (date: Date) => void;
  onMonthChange: (delta: number) => void;
}

export function MiniCalendar({ anchor, selected, weekStartsOn, onSelect, onMonthChange }: MiniCalendarProps) {
  const tasks = useApp((state) => state.tasks);
  const days = useMemo(() => monthMatrix(anchor, weekStartsOn), [anchor, weekStartsOn]);

  const busyDays = useMemo(() => {
    const set = new Set<string>();
    Object.values(tasks).forEach((task) => {
      if (task.status === 2) return;
      const due = parseDateTime(task.dueDate);
      if (due) set.add(dateKey(due));
    });
    return set;
  }, [tasks]);

  const weekday = weekStartsOn === 1 ? WEEKDAY_LABELS : ['日', ...WEEKDAY_LABELS.slice(0, 6)];

  return (
    <div className="rounded-2xl border border-line bg-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink">
          {anchor.getFullYear()} 年 {anchor.getMonth() + 1} 月
        </span>
        <div className="flex items-center gap-0.5">
          <IconButton aria-label="上个月" className="h-6 w-6" onClick={() => onMonthChange(-1)}>
            <ChevronLeft size={14} />
          </IconButton>
          <IconButton aria-label="下个月" className="h-6 w-6" onClick={() => onMonthChange(1)}>
            <ChevronRight size={14} />
          </IconButton>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {weekday.map((label) => (
          <span key={label} className="text-center text-2xs text-faint">
            {label}
          </span>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === anchor.getMonth();
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selected);
          const busy = busyDays.has(dateKey(day));
          return (
            <button
              key={dateKey(day)}
              type="button"
              onClick={() => onSelect(day)}
              className={cn(
                'relative mx-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-xs tabular-nums transition-colors',
                isSelected && 'bg-brand text-white',
                !isSelected && isToday && 'bg-brand-50 text-brand font-semibold',
                !isSelected && !isToday && (inMonth ? 'text-ink hover:bg-subtle' : 'text-faint/60 hover:bg-subtle'),
              )}
            >
              {day.getDate()}
              {busy && !isSelected ? (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-brand/70" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
