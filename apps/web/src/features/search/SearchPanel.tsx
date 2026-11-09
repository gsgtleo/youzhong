import { useEffect, useMemo, useState } from 'react';
import { Flag, Search, SlidersHorizontal, Tag, X } from 'lucide-react';
import type { Priority } from '@youzhong/shared';
import { formatHHmm, parseDateTime, relativeDayLabel } from '@youzhong/shared';
import { Button, Chip } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/overlay';
import { queryTasks } from '@/store/selectors';
import { useApp } from '@/store/app';
import { useUi } from '@/store/ui';
import { cn, PRIORITY_COLOR, PRIORITY_LABEL } from '@/lib/utils';

const PRIORITIES: Priority[] = [5, 3, 1, 0];

export function SearchPanel() {
  const open = useUi((state) => state.searchOpen);
  const setOpen = useUi((state) => state.setSearchOpen);
  const query = useUi((state) => state.query);
  const setQuery = useUi((state) => state.setQuery);
  const filters = useUi((state) => state.filters);
  const togglePriority = useUi((state) => state.togglePriority);
  const toggleTag = useUi((state) => state.toggleTag);
  const setOnlyOpen = useUi((state) => state.setOnlyOpen);
  const clearFilters = useUi((state) => state.clearFilters);
  const selectTask = useUi((state) => state.selectTask);

  const tasks = useApp((state) => state.tasks);
  const projects = useApp((state) => state.projects);
  const tags = useApp((state) => state.tags);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    if (open) setAdvanced(filters.priorities.length > 0 || filters.tags.length > 0 || Boolean(query));
  }, [open]);

  const results = useMemo(
    () => queryTasks(tasks, { query, filters, sortBy: 'due' }).slice(0, 40),
    [tasks, query, filters],
  );

  const activeFilterCount = filters.priorities.length + filters.tags.length + (filters.onlyOpen ? 0 : 1);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="搜索与筛选"
      subtitle="按关键词、优先级与标签快速定位任务"
      width="lg"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-line px-3 focus-within:border-brand/60">
          <Search size={15} className="shrink-0 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
            }}
            placeholder="输入任务标题、备注或标签…"
            aria-label="搜索关键词"
            className="h-10 w-full border-0 bg-transparent p-0 text-sm text-ink shadow-none outline-none placeholder:text-faint"
          />
          {query ? (
            <button
              type="button"
              aria-label="清空关键词"
              onClick={() => setQuery('')}
              className="cursor-pointer rounded p-1 text-faint hover:text-ink"
            >
              <X size={14} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setAdvanced((value) => !value)}
            className={cn(
              'flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-2xs transition-colors',
              advanced ? 'bg-brand-50 text-brand' : 'text-faint hover:text-ink',
            )}
          >
            <SlidersHorizontal size={12} />
            筛选
            {activeFilterCount ? <span className="rounded bg-brand px-1 text-[10px] text-white">{activeFilterCount}</span> : null}
          </button>
        </div>

        {advanced ? (
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-subtle/40 p-2.5 animate-fade-in">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 flex items-center gap-1 text-2xs text-faint">
                <Flag size={10} /> 优先级
              </span>
              {PRIORITIES.map((priority) => (
                <Chip
                  key={priority}
                  active={filters.priorities.includes(priority)}
                  color={filters.priorities.includes(priority) ? PRIORITY_COLOR[priority] : undefined}
                  onClick={() => togglePriority(priority)}
                >
                  {PRIORITY_LABEL[priority]}
                </Chip>
              ))}
              <span className="ml-auto flex items-center gap-1.5">
                <Chip active={filters.onlyOpen} onClick={() => setOnlyOpen(!filters.onlyOpen)}>
                  只看未完成
                </Chip>
                <Button variant="ghost" size="xs" onClick={clearFilters}>
                  清除
                </Button>
              </span>
            </div>

            {tags.length ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 flex items-center gap-1 text-2xs text-faint">
                  <Tag size={10} /> 标签
                </span>
                {tags.slice(0, 10).map((tag) => (
                  <Chip key={tag.name} active={filters.tags.includes(tag.name)} onClick={() => toggleTag(tag.name)}>
                    {tag.label ?? tag.name}
                  </Chip>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between text-2xs text-faint">
          <span>共 {results.length} 条结果</span>
          <span>回车打开 · Esc 关闭</span>
        </div>

        <div className="max-h-[46vh] overflow-y-auto">
          {results.length ? (
            <div className="flex flex-col gap-0.5">
              {results.map((task) => {
                const project = projects.find((item) => item.id === task.projectId);
                const due = parseDateTime(task.dueDate);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      selectTask(task.id);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-subtle"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: project?.color ?? '#0E9F8A' }}
                    />
                    <span className={cn('flex-1 truncate text-[13px]', task.status === 2 ? 'text-faint line-through' : 'text-ink')}>
                      {task.title}
                    </span>
                    {task.priority > 0 ? <Flag size={11} style={{ color: PRIORITY_COLOR[task.priority] }} /> : null}
                    <span className="shrink-0 text-2xs tabular-nums text-faint">
                      {due ? `${relativeDayLabel(due)} ${task.isAllDay ? '' : formatHHmm(due)}` : '未安排'}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-10 text-center">
              <Search size={20} className="text-faint/60" />
              <p className="text-xs text-faint">没有匹配的任务，试试换个关键词</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
