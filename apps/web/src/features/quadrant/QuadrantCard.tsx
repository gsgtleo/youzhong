import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CalendarDays, GripVertical, Inbox } from 'lucide-react';
import type { QuadrantMeta, Task } from '@youzhong/shared';
import { formatHHmm, parseDateTime, relativeDayLabel } from '@youzhong/shared';
import { ProgressRing } from '@/components/ui/primitives';
import { hexToRgba, cn } from '@/lib/utils';

export function DraggableTask({ task, color, onOpen }: { task: Task; color: string; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const due = parseDateTime(task.dueDate);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        borderLeftColor: color,
      }}
      className={cn(
        'group flex cursor-grab items-start gap-2 rounded-lg border border-line border-l-[3px] bg-panel px-2.5 py-2 transition-shadow active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
      {...attributes}
      {...listeners}
    >
      <span className="mt-0.5 shrink-0 text-faint/60 opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical size={12} />
      </span>
      <button type="button" onClick={() => onOpen(task.id)} className="min-w-0 flex-1 cursor-pointer text-left">
        <p className={cn('truncate text-[13px] leading-5', task.status === 2 ? 'text-faint line-through' : 'text-ink')}>{task.title}</p>
        <div className="mt-0.5 flex items-center gap-2 text-2xs text-faint">
          {due ? (
            <span className={cn('inline-flex items-center gap-1 tabular-nums')}>
              <CalendarDays size={9} />
              {relativeDayLabel(due)} {task.isAllDay ? '' : formatHHmm(due)}
            </span>
          ) : (
            <span>未安排时间</span>
          )}
          {task.tags?.length ? <span className="truncate">#{task.tags[0]}</span> : null}
        </div>
      </button>
    </div>
  );
}

interface QuadrantCardProps {
  meta: QuadrantMeta;
  tasks: Task[];
  total: number;
  projectColorOf: (projectId: string) => string;
  onOpenTask: (id: string) => void;
}

export function QuadrantCard({ meta, tasks, total, projectColorOf, onOpenTask }: QuadrantCardProps) {
  const { setNodeRef, isOver } = useDroppable({ id: meta.id });
  const share = total ? tasks.length / total : 0;

  return (
    <section
      ref={setNodeRef}
      style={{
        backgroundColor: isOver ? hexToRgba(meta.color, 0.06) : 'var(--panel)',
        borderColor: isOver ? meta.ring : 'var(--line)',
      }}
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-2xl border transition-all duration-200',
        isOver && 'shadow-[0_0_0_3px_rgb(var(--brand-rgb)/0.10)]',
      )}
    >
      <header className="flex items-start gap-2.5 px-3.5 pb-2 pt-3">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
          style={{ backgroundColor: meta.soft, color: meta.color }}
        >
          Q{meta.id.slice(1)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <h3 className="truncate text-[13.5px] font-semibold text-ink">{meta.title}</h3>
            <span className="shrink-0 text-2xs tabular-nums text-faint">{tasks.length}</span>
          </div>
          <p className="truncate text-2xs text-faint">
            {meta.subtitle} · {meta.action}
          </p>
        </div>
        <div className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center">
          <ProgressRing value={share} color={meta.color} />
          <span className="absolute text-[9px] font-semibold tabular-nums" style={{ color: meta.color }}>
            {Math.round(share * 100)}%
          </span>
        </div>
      </header>

      <div className="flex min-h-[132px] flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 pb-2.5">
        {tasks.length ? (
          tasks.map((task) => (
            <DraggableTask key={task.id} task={task} color={projectColorOf(task.projectId)} onOpen={onOpenTask} />
          ))
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line/80 py-4 text-center">
            <Inbox size={16} className="text-faint/70" />
            <p className="text-2xs text-faint">{isOver ? '松手放入本象限' : '这里很清爽'}</p>
          </div>
        )}
      </div>

      {isOver ? (
        <div
          className="border-t px-3 py-1.5 text-center text-2xs font-medium"
          style={{ borderColor: meta.ring, backgroundColor: meta.soft, color: meta.color }}
        >
          释放以归入「{meta.title}」
        </div>
      ) : null}
    </section>
  );
}
