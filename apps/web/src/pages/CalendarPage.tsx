import { useCallback, useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarEvent } from '@youzhong/shared';
import { addDays, dateKey, formatFull, startOfDay, startOfWeek } from '@youzhong/shared';
import { Button, IconButton, Segmented } from '@/components/ui/primitives';
import { MonthView } from '@/features/calendar/MonthView';
import { TimeGridView } from '@/features/calendar/TimeGridView';
import { MiniCalendar } from '@/features/calendar/MiniCalendar';
import { EventEditor } from '@/features/calendar/EventEditor';
import { useApp } from '@/store/app';
import { useUi } from '@/store/ui';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { cn, hexToRgba } from '@/lib/utils';

type CalendarMode = 'month' | 'week' | 'day';

function titleFor(mode: CalendarMode, anchor: Date): string {
  if (mode === 'month') return `${anchor.getFullYear()} 年 ${anchor.getMonth() + 1} 月`;
  if (mode === 'day') return formatFull(anchor);
  const start = startOfWeek(anchor, 1);
  const end = addDays(start, 6);
  return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
}

export default function CalendarPage() {
  const isMobile = useIsMobile();
  const projects = useApp((state) => state.projects);
  const weekStartsOn = useUi((state) => state.weekStartsOn);
  const selectTask = useUi((state) => state.selectTask);

  const [mode, setMode] = useState<CalendarMode>(isMobile ? 'day' : 'month');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [editor, setEditor] = useState<
    { mode: 'create'; date: string; time?: string } | { mode: 'edit'; event: CalendarEvent } | null
  >(null);

  const title = useMemo(() => titleFor(mode, anchor), [mode, anchor]);

  const openEvent = useCallback((id: string) => {
    const target = useApp.getState().events.find((event) => event.id === id);
    if (target) setEditor({ mode: 'edit', event: target });
  }, []);

  const createEventAt = useCallback((date: Date, time?: string) => {
    setEditor({ mode: 'create', date: dateKey(date), time });
  }, []);

  const openTask = useCallback((id: string) => selectTask(id), [selectTask]);

  const shift = (delta: number) => {
    if (mode === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1));
    else if (mode === 'week') setAnchor(addDays(anchor, delta * 7));
    else setAnchor(addDays(anchor, delta));
  };

  const openCreate = (date: Date, time?: string) => createEventAt(date, time);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-line px-4 py-3 md:flex-row md:items-center md:px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h1>
          <span className="hidden rounded-md bg-subtle px-1.5 py-0.5 text-2xs text-faint md:inline">
            {mode === 'month' ? '月视图' : mode === 'week' ? '周视图' : '日视图'}
          </span>
        </div>

        <div className="flex flex-1 items-center gap-2 md:justify-end">
          <IconButton aria-label="上一个周期" onClick={() => shift(-1)}>
            <ChevronLeft size={16} />
          </IconButton>
          <Button variant="outline" size="xs" onClick={() => setAnchor(startOfDay(new Date()))}>
            今天
          </Button>
          <IconButton aria-label="下一个周期" onClick={() => shift(1)}>
            <ChevronRight size={16} />
          </IconButton>
          <Segmented
            value={mode}
            onChange={(value) => setMode(value)}
            options={[
              { value: 'month', label: '月' },
              { value: 'week', label: '周' },
              { value: 'day', label: '日' },
            ]}
          />
          <Button size="xs" onClick={() => openCreate(anchor)} className="ml-auto md:ml-2">
            <CalendarPlus size={13} /> 日程
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-3 md:p-4">
        {!isMobile ? (
          <aside className="flex w-[232px] shrink-0 flex-col gap-3 overflow-y-auto">
            <MiniCalendar
              anchor={anchor}
              selected={anchor}
              weekStartsOn={weekStartsOn}
              onSelect={(date) => {
                setAnchor(date);
                if (mode === 'month') setMode('day');
              }}
              onMonthChange={(delta) => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1))}
            />

            <div className="rounded-2xl border border-line bg-panel p-3">
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-faint">显示清单</p>
              <div className="flex flex-col gap-0.5">
                {projects.map((project) => {
                  const active = !projectFilter.length || projectFilter.includes(project.id);
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() =>
                        setProjectFilter((prev) => {
                          if (!prev.length) return projects.filter((item) => item.id !== project.id).map((item) => item.id);
                          return prev.includes(project.id) ? prev.filter((id) => id !== project.id) : [...prev, project.id];
                        })
                      }
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs transition-colors hover:bg-subtle"
                    >
                      <span
                        className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border"
                        style={{
                          borderColor: active ? project.color ?? '#0E9F8A' : 'var(--line)',
                          backgroundColor: active ? hexToRgba(project.color ?? '#0E9F8A', 0.9) : 'transparent',
                        }}
                      >
                        {active ? <span className="h-1 w-1 rounded-full bg-white" /> : null}
                      </span>
                      <span className={cn('flex-1 truncate', active ? 'text-ink' : 'text-faint')}>{project.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          {mode === 'month' ? (
            <MonthView
              anchor={anchor}
              selected={anchor}
              projectFilter={projectFilter}
              onSelectDate={(date) => setAnchor(date)}
              onSwitchDay={(date) => {
                setAnchor(date);
                setMode('day');
              }}
              onOpenEvent={openEvent}
            />
          ) : (
            <TimeGridView
              anchor={anchor}
              mode={mode}
              projectFilter={projectFilter}
              onOpenTask={openTask}
              onOpenEvent={openEvent}
              onCreateEventAt={openCreate}
            />
          )}
        </div>
      </div>

      <EventEditor
        open={Boolean(editor)}
        event={editor?.mode === 'edit' ? editor.event : undefined}
        presetDate={editor?.mode === 'create' ? editor.date : undefined}
        presetTime={editor?.mode === 'create' ? editor.time : undefined}
        onClose={() => setEditor(null)}
      />
    </div>
  );
}
