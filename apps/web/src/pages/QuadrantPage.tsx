import { useMemo, useState } from 'react';
import { LayoutGrid, Sparkles } from 'lucide-react';
import { QUADRANT_META, QUADRANT_ORDER, QUADRANT_RULES } from '@youzhong/shared';
import { Segmented } from '@/components/ui/primitives';
import { QuadrantBoard } from '@/features/quadrant/QuadrantBoard';
import { useApp } from '@/store/app';
import { useUi } from '@/store/ui';
import { cn, hexToRgba } from '@/lib/utils';

export default function QuadrantPage() {
  const projects = useApp((state) => state.projects);
  const tasks = useApp((state) => state.tasks);
  const ruleId = useUi((state) => state.ruleId);
  const setRuleId = useUi((state) => state.setRuleId);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);

  const rule = QUADRANT_RULES[ruleId];

  const counts = useMemo(() => {
    const now = new Date();
    const result: Record<string, number> = { q1: 0, q2: 0, q3: 0, q4: 0 };
    Object.values(tasks).forEach((task) => {
      if (task.status === 2) return;
      if (projectFilter.length && !projectFilter.includes(task.projectId)) return;
      result[rule.quadrantOf(task, now)] += 1;
    });
    return result;
  }, [tasks, rule, projectFilter]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-col gap-3 border-b border-line px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand">
              <LayoutGrid size={15} />
            </span>
            <h1 className="text-[17px] font-semibold tracking-tight text-ink">四象限</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Segmented
              value={ruleId}
              onChange={(value) => setRuleId(value)}
              options={[
                { value: 'priority', label: '按优先级' },
                { value: 'urgency', label: '优先级 + 时间' },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-1 text-2xs text-faint">
            <Sparkles size={11} /> {rule.description}
          </p>
          <div className="ml-auto flex items-center gap-1 overflow-x-auto no-scrollbar">
            {QUADRANT_ORDER.map((quadrant) => (
              <span
                key={quadrant}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium"
                style={{ backgroundColor: QUADRANT_META[quadrant].soft, color: QUADRANT_META[quadrant].color }}
              >
                {QUADRANT_META[quadrant].title} {counts[quadrant]}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setProjectFilter([])}
            className={cn(
              'h-6 shrink-0 cursor-pointer rounded-full border px-2.5 text-2xs transition-colors',
              !projectFilter.length ? 'border-brand/50 bg-brand-50 text-brand' : 'border-line text-faint hover:text-ink',
            )}
          >
            全部清单
          </button>
          {projects.map((project) => {
            const active = projectFilter.includes(project.id);
            const color = project.color ?? '#0E9F8A';
            return (
              <button
                key={project.id}
                type="button"
                onClick={() =>
                  setProjectFilter((prev) => (prev.includes(project.id) ? prev.filter((id) => id !== project.id) : [...prev, project.id]))
                }
                style={active ? { backgroundColor: hexToRgba(color, 0.12), color, borderColor: hexToRgba(color, 0.45) } : undefined}
                className={cn(
                  'flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-2xs transition-colors',
                  active ? 'border-transparent' : 'border-line text-faint hover:text-ink',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                {project.name}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
        <QuadrantBoard projectFilter={projectFilter} />
      </div>
    </div>
  );
}
