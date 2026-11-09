import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Task } from '@youzhong/shared';
import { CompletedMark, SealMark } from '@/components/BrandMark';
import { groupTasks } from '@/store/selectors';
import { useApp } from '@/store/app';
import { useUi } from '@/store/ui';
import { deleteTask, toggleTask } from '@/api/mutations';
import { cn } from '@/lib/utils';
import { TaskRow } from './TaskRow';

interface TaskListProps {
  tasks: Task[];
  showProject?: boolean;
  compact?: boolean;
  /** 笔记本视图：给每行加「安排」入口 */
  schedulable?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  hideCompleted?: boolean;
  /** 今天视图：把未设日期的未完成任务并入「今天」分组 */
  undatedInToday?: boolean;
}

const toneClass = {
  danger: 'text-red-500',
  brand: 'text-brand',
  muted: 'text-faint',
} as const;

export function TaskList({
  tasks,
  showProject,
  compact,
  schedulable,
  emptyTitle = '这里还没有任务',
  emptyHint = '在上方输入框写下第一件事，回车即可创建。',
  hideCompleted,
  undatedInToday = false,
}: TaskListProps) {
  const projects = useApp((state) => state.projects);
  const selectedTaskId = useUi((state) => state.selectedTaskId);
  const selectTask = useUi((state) => state.selectTask);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true });

  const groups = useMemo(() => {
    const all = groupTasks(tasks, new Date(), { undatedInToday });
    return hideCompleted ? all.filter((group) => group.key !== 'done') : all;
  }, [tasks, hideCompleted, undatedInToday]);

  const projectMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {};
    projects.forEach((project) => {
      map[project.id] = { name: project.name, color: project.color ?? '#0E9F8A' };
    });
    return map;
  }, [projects]);

  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
          <SealMark size={36} className="rounded-[10px] shadow-[0_10px_22px_-12px_rgba(16,24,40,0.55)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">{emptyTitle}</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-faint">{emptyHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      {groups.map((group) => {
        const isCollapsed = collapsed[group.key];
        return (
          <section key={group.key} className="flex flex-col">
            <button
              type="button"
              onClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
              className="group/header mb-1 flex cursor-pointer items-center gap-1.5 px-1 py-1 text-left"
            >
              <ChevronDown
                size={13}
                className={cn('text-faint transition-transform duration-200', isCollapsed && '-rotate-90')}
              />
              <span className={cn('flex items-center gap-1 text-xs font-semibold', group.tone ? toneClass[group.tone] : 'text-ink')}>
                {group.key === 'done' ? <CompletedMark size={13} /> : null}
                {group.title}
              </span>
              <span className="rounded-md bg-subtle px-1.5 text-2xs tabular-nums leading-5 text-faint">{group.tasks.length}</span>
              <span className="mx-1 h-px flex-1 bg-line" />
            </button>

            {!isCollapsed ? (
              <div className="flex flex-col gap-0.5">
                {group.tasks.map((task) => {
                  const project = projectMap[task.projectId];
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      projectColor={project?.color ?? '#0E9F8A'}
                      projectName={project?.name}
                      showProject={showProject}
                      compact={compact}
                      schedulable={schedulable}
                      selected={selectedTaskId === task.id}
                      onToggle={toggleTask}
                      onSelect={selectTask}
                      onDelete={(id) => void deleteTask(id)}
                    />
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
