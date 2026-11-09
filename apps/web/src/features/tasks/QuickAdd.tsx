import { useMemo, useState } from 'react';
import { CalendarClock, CornerDownLeft, Flag, Plus, Sparkles } from 'lucide-react';
import { formatHHmm, parseDateTime, relativeDayLabel } from '@youzhong/shared';
import { createTask } from '@/api/mutations';
import { Button } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { PRIORITY_COLOR } from '@/lib/utils';
import { QUICK_HINTS, parseQuickInput } from './quickParse';

export function QuickAdd({
  projectId,
  compact,
  placeholder = '添加任务：明天 10:00 提交周报 !高',
}: {
  projectId: string;
  compact?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  const parsed = useMemo(() => (value.trim() ? parseQuickInput(value) : null), [value]);
  const due = parseDateTime(parsed?.dueDate);

  const submit = () => {
    const result = parseQuickInput(value);
    if (!result.title) {
      setValue('');
      return;
    }
    void createTask({
      projectId,
      title: result.title,
      dueDate: result.dueDate,
      priority: result.priority,
      isAllDay: result.isAllDay,
    });
    setValue('');
  };

  return (
    <div className={cn('group flex flex-col gap-1.5', compact && 'gap-1')}>
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-xl border bg-panel px-3 transition-all duration-200 ease-snap',
          focused ? 'border-brand/60 shadow-[0_0_0_3px_rgb(var(--brand-rgb)/0.10)]' : 'border-line hover:border-line/80',
        )}
      >
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors',
            focused ? 'bg-brand text-white' : 'bg-subtle text-faint',
          )}
        >
          <Plus size={14} strokeWidth={2.6} />
        </span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
            if (event.key === 'Escape') setValue('');
          }}
          placeholder={placeholder}
          aria-label="添加任务"
          className="h-11 w-full min-w-0 border-0 bg-transparent p-0 text-sm text-ink shadow-none outline-none placeholder:text-faint"
        />
        {value.trim() ? (
          <Button size="xs" onClick={submit} className="shrink-0">
            保存
            <CornerDownLeft size={11} />
          </Button>
        ) : (
          <span className="hidden shrink-0 items-center gap-1 text-2xs text-faint md:flex">
            <CornerDownLeft size={11} /> 回车保存
          </span>
        )}
      </div>

      {value.trim() && parsed ? (
        <div className="flex flex-wrap items-center gap-1.5 px-1 animate-fade-in">
          {due ? (
            <span className="tag-chip bg-brand-50 text-brand">
              <CalendarClock size={10} />
              {relativeDayLabel(due)} {parsed?.isAllDay ? '全天' : formatHHmm(due)}
            </span>
          ) : null}
          {parsed.priority > 0 ? (
            <span className="tag-chip" style={{ backgroundColor: `${PRIORITY_COLOR[parsed.priority]}18`, color: PRIORITY_COLOR[parsed.priority] }}>
              <Flag size={10} />
              {parsed.priority === 5 ? '高优先级' : parsed.priority === 3 ? '中优先级' : '低优先级'}
            </span>
          ) : null}
          <span className="tag-chip bg-subtle text-faint">
            <Sparkles size={10} />
            已识别自然语言
          </span>
        </div>
      ) : null}

      {!value.trim() && focused ? (
        <div className="flex flex-wrap gap-1.5 px-1 animate-fade-in">
          {QUICK_HINTS.map((hint) => (
            <button
              key={hint}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setValue(hint)}
              className="cursor-pointer rounded-md border border-line px-1.5 py-0.5 text-2xs text-faint transition-colors hover:border-brand/40 hover:text-brand"
            >
              {hint}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
