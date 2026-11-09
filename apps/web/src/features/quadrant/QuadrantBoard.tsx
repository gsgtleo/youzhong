import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { QUADRANT_META, QUADRANT_ORDER, QUADRANT_RULES } from '@youzhong/shared';
import type { Quadrant, Task } from '@youzhong/shared';
import { useApp } from '@/store/app';
import { useUi } from '@/store/ui';
import { moveTaskToQuadrant } from '@/api/mutations';
import { QuadrantCard } from './QuadrantCard';

export function QuadrantBoard({ projectFilter }: { projectFilter: string[] }) {
  const tasks = useApp((state) => state.tasks);
  const projects = useApp((state) => state.projects);
  const ruleId = useUi((state) => state.ruleId);
  const selectTask = useUi((state) => state.selectTask);
  const [activeId, setActiveId] = useState<string>();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const rule = QUADRANT_RULES[ruleId];

  const grouped = useMemo(() => {
    const now = new Date();
    const buckets: Record<Quadrant, Task[]> = { q1: [], q2: [], q3: [], q4: [] };
    Object.values(tasks).forEach((task) => {
      if (task.status === 2) return;
      if (projectFilter.length && !projectFilter.includes(task.projectId)) return;
      buckets[rule.quadrantOf(task, now)].push(task);
    });
    QUADRANT_ORDER.forEach((quadrant) => {
      buckets[quadrant].sort((a, b) => b.priority - a.priority || (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    });
    return buckets;
  }, [tasks, projectFilter, rule]);

  const total = QUADRANT_ORDER.reduce((sum, quadrant) => sum + grouped[quadrant].length, 0);
  const projectColorOf = (projectId: string) => projects.find((project) => project.id === projectId)?.color ?? '#0E9F8A';
  const activeTask = activeId ? tasks[activeId] : undefined;

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(undefined);
    const target = event.over?.id;
    if (!target) return;
    const quadrant = String(target) as Quadrant;
    if (!QUADRANT_ORDER.includes(quadrant)) return;
    moveTaskToQuadrant(String(event.active.id), quadrant);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid min-h-0 flex-1 auto-rows-[minmax(252px,auto)] grid-cols-1 gap-3 overflow-y-auto md:auto-rows-fr md:grid-cols-2 md:grid-rows-2 md:overflow-hidden">
        {QUADRANT_ORDER.map((quadrant) => (
          <QuadrantCard
            key={quadrant}
            meta={QUADRANT_META[quadrant]}
            tasks={grouped[quadrant]}
            total={total}
            projectColorOf={projectColorOf}
            onOpenTask={selectTask}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-64 rotate-[1.5deg] cursor-grabbing rounded-xl border border-brand/40 bg-panel px-3 py-2 shadow-drag">
            <p className="truncate text-[13px] font-medium text-ink">{activeTask.title}</p>
            <p className="mt-0.5 text-2xs text-faint">
              {ruleId === 'priority' ? '拖动将修改优先级' : '拖动将同时调整优先级与时间'}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
