import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpDown, Check, ChevronRight, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { formatFull } from '@youzhong/shared';
import { IconButton } from '@/components/ui/primitives';
import { MenuItem, Popover } from '@/components/ui/overlay';
import { QuickAdd } from '@/features/tasks/QuickAdd';
import { TaskList } from '@/features/tasks/TaskList';
import { queryTasks, type SmartList } from '@/store/selectors';
import { useApp } from '@/store/app';
import { useUi } from '@/store/ui';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';
import type { SortBy } from '@/store/ui';

export type ViewKind = 'today' | 'week' | 'notebook' | 'completed' | 'project';

const SORT_LABELS: Record<SortBy, string> = {
  smart: '智能排序',
  due: '按时间',
  priority: '按优先级',
  created: '按创建时间',
};

export default function TaskViewPage({ kind }: { kind: ViewKind }) {
  const isMobile = useIsMobile();
  const params = useParams();
  const projects = useApp((state) => state.projects);
  const tasks = useApp((state) => state.tasks);
  const mode = useApp((state) => state.mode);
  const query = useUi((state) => state.query);
  const filters = useUi((state) => state.filters);
  const sortBy = useUi((state) => state.setSortBy);
  const setQuery = useUi((state) => state.setQuery);
  const setSearchOpen = useUi((state) => state.setSearchOpen);
  const setDensity = useUi((state) => state.setDensity);
  const density = useUi((state) => state.density);
  const [sortOpen, setSortOpen] = useState(false);
  const sortValue = useUi((state) => state.sortBy);

  const inboxId = projects.find((project) => project.permission === 'inbox')?.id ?? projects[0]?.id ?? 'inbox';
  const projectId = kind === 'project' ? params.id : kind === 'notebook' ? inboxId : undefined;
  const project = projectId ? projects.find((item) => item.id === projectId) : undefined;

  const smart: SmartList | undefined =
    kind === 'completed' ? 'completed' : kind === 'today' ? 'today' : kind === 'week' ? 'week' : undefined;

  const list = useMemo(
    () => queryTasks(tasks, { smart, projectId, query, filters, sortBy: sortValue }),
    [tasks, smart, projectId, query, filters, sortValue],
  );

  const title =
    kind === 'today'
      ? '今天'
      : kind === 'week'
        ? '最近 7 天'
        : kind === 'notebook'
          ? '笔记本'
          : kind === 'completed'
            ? '已完成'
            : project?.name ?? '清单';

  const subtitle =
    kind === 'today'
      ? formatFull(new Date())
      : kind === 'week'
        ? '未来一周内到期的任务'
        : kind === 'completed'
          ? '已完成的任务会保留在这里'
          : kind === 'notebook'
            ? '随手记下的临时任务与信息：默认不排期、不提醒，设好日期或清单就归位'
            : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-app/85 backdrop-blur-xl">
        <div className={cn('flex items-center gap-2', isMobile ? 'px-4 py-2.5' : 'px-6 py-3')}>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h1 className={cn('truncate font-semibold tracking-tight text-ink', isMobile ? 'text-[18px]' : 'text-[20px]')}>{title}</h1>
              <span className="shrink-0 rounded-md bg-subtle px-1.5 py-0.5 text-2xs tabular-nums text-faint">{list.length}</span>
            </div>
            {subtitle && !isMobile ? <p className="mt-0.5 text-2xs text-faint">{subtitle}</p> : null}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {isMobile ? (
              <IconButton aria-label="搜索" onClick={() => setSearchOpen(true)}>
                <Search size={17} />
              </IconButton>
            ) : null}

            <div className="relative">
              <IconButton aria-label="排序" active={sortOpen} onClick={() => setSortOpen((open) => !open)}>
                <ArrowUpDown size={16} />
              </IconButton>
              <Popover open={sortOpen} onClose={() => setSortOpen(false)} align="end" className="w-[168px]">
                {(Object.keys(SORT_LABELS) as SortBy[]).map((key) => (
                  <MenuItem
                    key={key}
                    active={sortValue === key}
                    icon={sortValue === key ? <Check size={12} /> : <span className="w-3" />}
                    onClick={() => {
                      sortBy(key);
                      setSortOpen(false);
                    }}
                  >
                    {SORT_LABELS[key]}
                  </MenuItem>
                ))}
              </Popover>
            </div>

            <IconButton aria-label="筛选" onClick={() => setSearchOpen(true)}>
              <SlidersHorizontal size={16} />
            </IconButton>
            {!isMobile ? (
              <IconButton
                aria-label="切换密度"
                onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
              >
                <Sparkles size={15} />
              </IconButton>
            ) : null}
          </div>
        </div>

        {query ? (
          <div className="flex items-center gap-2 border-t border-line/70 px-4 py-1.5 text-2xs text-faint md:px-6">
            <span>正在搜索「{query}」</span>
            <button type="button" onClick={() => setQuery('')} className="cursor-pointer text-brand hover:underline">
              清除
            </button>
          </div>
        ) : null}
      </header>

      <div className={cn('min-h-0 flex-1 overflow-y-auto', isMobile ? 'px-3 pt-3' : 'px-6 pt-4')}>
        {mode === 'mock' ? (
          <Link
            to="/settings"
            className="mb-3 flex items-center gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-2xs text-amber-800 transition-colors hover:bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15">
              <Sparkles size={11} />
            </span>
            <span className="flex-1">当前展示的是内置演示数据，登录后即可看到你自己的任务</span>
            <ChevronRight size={13} />
          </Link>
        ) : null}

        <div className="mx-auto mb-3 w-full max-w-[1000px]">
          <QuickAdd
            projectId={projectId ?? inboxId}
            compact={isMobile}
            placeholder={kind === 'notebook' ? '记一笔：临时任务或想法，默认不设期限' : undefined}
          />
        </div>

        <div className="mx-auto w-full max-w-[1000px]">
          <TaskList
            tasks={list}
            showProject={!projectId}
            compact={density === 'compact'}
            hideCompleted={kind === 'today' || kind === 'week'}
            undatedInToday={kind === 'today'}
            schedulable={kind === 'notebook'}
            emptyTitle={
              kind === 'completed' ? '还没有完成的任务' : kind === 'today' ? '今天可以开始收工了' : kind === 'notebook' ? '笔记本还是空的' : '这里还没有任务'
            }
            emptyHint={
              kind === 'today'
                ? '今天到期、已逾期，以及未设日期且未完成的任务会留在这里；用自然语言写下计划，回车即可创建。'
                : kind === 'notebook'
                  ? '随手写下临时任务或信息：默认不设期限；之后点行尾的日历图标可以补日期、提醒，或转去别的清单。'
                  : '在上方输入框写下第一件事，支持「明天 10:00 提交周报 !高」这样的自然语言。'
            }
          />
          <p className="pb-6 pt-2 text-center text-2xs text-faint">
            数据来源：{mode === 'server' ? '本机 SQLite（多用户）' : '本地演示数据'} · 最后同步{' '}
            {new Date(useApp.getState().lastSync ?? Date.now()).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
}
