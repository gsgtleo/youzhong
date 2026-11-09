import { useEffect, useState } from 'react';
import { ArrowLeft, Check, ListChecks, Plus, Trash2, X } from 'lucide-react';
import type { Subtask, TaskPatch } from '@youzhong/shared';
import { formatFull } from '@youzhong/shared';
import { Button } from '@/components/ui/primitives';
import { Checkbox } from '@/components/ui/primitives';
import { deleteTask, patchTask } from '@/api/mutations';
import { useApp } from '@/store/app';
import { useUi } from '@/store/ui';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { cn, newId } from '@/lib/utils';
import { PropertyRows } from './PropertyRows';

export function TaskDetail() {
  const isMobile = useIsMobile();
  const selectedTaskId = useUi((state) => state.selectedTaskId);
  const detailOpen = useUi((state) => state.detailOpen);
  const closeDetail = useUi((state) => state.closeDetail);
  const task = useApp((state) => (selectedTaskId ? state.tasks[selectedTaskId] : undefined));
  const project = useApp((state) => state.projects.find((item) => item.id === task?.projectId));

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subInput, setSubInput] = useState('');

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setContent(task.content ?? '');
  }, [task?.id]);

  if (!task || !detailOpen) return null;

  const patch = (next: TaskPatch) => void patchTask(task.id, next);

  const commitTitle = () => {
    const value = title.trim();
    if (!value) {
      setTitle(task.title);
      return;
    }
    if (value !== task.title) patch({ title: value });
  };

  const commitContent = () => {
    const value = content.trim();
    if (value !== (task.content ?? '')) patch({ content: value || undefined });
  };

  const items = task.items ?? [];
  const doneCount = items.filter((item) => item.status === 2).length;

  const updateItems = (next: Subtask[]) => patch({ items: next });

  const addSubtask = () => {
    const value = subInput.trim();
    if (!value) return;
    updateItems([...items, { id: newId(), title: value, status: 0, sortOrder: items.length }]);
    setSubInput('');
  };

  const body = (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <button
          type="button"
          onClick={closeDetail}
          aria-label="关闭详情"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          {isMobile ? <ArrowLeft size={17} /> : <X size={16} />}
        </button>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-faint">
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: project?.color ?? '#0E9F8A' }} />
          <span className="truncate">{project?.name ?? '笔记本'}</span>
        </span>
        <span className="flex-1" />
        <button
          type="button"
          aria-label="删除任务"
          onClick={() => void deleteTask(task.id)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-faint transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 size={15} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex items-start gap-2.5">
          <div className="pt-1.5">
            <Checkbox
              checked={task.status === 2}
              onChange={() => patch({ status: task.status === 2 ? 0 : 2 })}
              color={project?.color ?? '#0E9F8A'}
              size={20}
              label="完成任务"
            />
          </div>
          <textarea
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commitTitle}
            rows={2}
            className={cn(
              'min-h-[52px] w-full resize-none border-0 bg-transparent p-0 text-[17px] font-semibold leading-6 text-ink shadow-none outline-none',
              task.status === 2 && 'text-faint line-through',
            )}
            aria-label="任务标题"
          />
        </div>

        <div className="mt-4 flex flex-col gap-0.5">
          <PropertyRows task={task} onChange={patch} />
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-faint">
            <ListChecks size={13} />
            子任务
            {items.length ? (
              <span className="text-2xs text-faint">
                {doneCount}/{items.length}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-0.5">
            {items.map((item) => (
              <div key={item.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-subtle/70">
                <Checkbox
                  checked={item.status === 2}
                  size={16}
                  onChange={() =>
                    updateItems(items.map((row) => (row.id === item.id ? { ...row, status: row.status === 2 ? 0 : 2 } : row)))
                  }
                  label={`完成子任务 ${item.title}`}
                />
                <span className={cn('flex-1 text-[13px]', item.status === 2 ? 'text-faint line-through' : 'text-ink')}>
                  {item.title}
                </span>
                <button
                  type="button"
                  aria-label={`删除子任务 ${item.title}`}
                  onClick={() => updateItems(items.filter((row) => row.id !== item.id))}
                  className="cursor-pointer rounded p-1 text-faint opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-2 rounded-lg px-1 py-1">
            <Plus size={14} className="text-faint" />
            <input
              value={subInput}
              onChange={(event) => setSubInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addSubtask();
              }}
              placeholder="添加子任务，回车确认"
              aria-label="添加子任务"
              className="h-7 w-full border-0 bg-transparent p-0 text-[13px] shadow-none outline-none placeholder:text-faint"
            />
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-1.5 text-xs font-medium text-faint">备注</p>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onBlur={commitContent}
            rows={5}
            placeholder="补充背景、链接或验收标准…"
            className="w-full resize-none rounded-xl border border-line bg-subtle/40 px-3 py-2 text-[13px] leading-relaxed text-ink outline-none transition-colors focus:border-brand/50 focus:bg-panel"
          />
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <span className="text-2xs text-faint">
          {task.createdTime ? `创建于 ${formatFull(new Date(task.createdTime))}` : '刚刚创建'}
        </span>
        <Button
          size="sm"
          variant={task.status === 2 ? 'soft' : 'primary'}
          onClick={() => patch({ status: task.status === 2 ? 0 : 2 })}
        >
          <Check size={13} />
          {task.status === 2 ? '取消完成' : '标记完成'}
        </Button>
      </footer>
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-panel animate-slide-in-right">
        <div className="safe-top" />
        {body}
      </div>
    );
  }

  return <aside className="flex w-[380px] shrink-0 flex-col border-l border-line bg-panel animate-slide-in-right">{body}</aside>;
}
