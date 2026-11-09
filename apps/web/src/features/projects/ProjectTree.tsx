import { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  LayoutGrid,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Sun,
  Trash2,
  CalendarRange,
  Layers,
} from 'lucide-react';
import { addDays, startOfDay } from '@youzhong/shared';
import { Button, IconButton } from '@/components/ui/primitives';
import { MenuItem, Modal, Popover } from '@/components/ui/overlay';
import { deleteProject, createProject, renameProject } from '@/api/mutations';
import { useApp } from '@/store/app';
import { cn, hexToRgba } from '@/lib/utils';

interface NavItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  accent?: string;
}

function NavItem({ to, label, icon, count, accent }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150',
          isActive ? 'bg-brand-50 text-brand' : 'text-muted hover:bg-subtle hover:text-ink',
        )
      }
      style={accent ? ({ '--nav-accent': accent } as React.CSSProperties) : undefined}
    >
      {({ isActive }) => (
        <>
          <span className={cn('shrink-0', isActive ? 'text-brand' : 'text-faint group-hover:text-muted')}>{icon}</span>
          <span className="flex-1 truncate">{label}</span>
          {typeof count === 'number' && count > 0 ? (
            <span className={cn('text-2xs tabular-nums', isActive ? 'text-brand/80' : 'text-faint')}>{count}</span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

export function ProjectTree() {
  const projects = useApp((state) => state.projects);
  const groups = useApp((state) => state.groups);
  const tasks = useApp((state) => state.tasks);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [menuId, setMenuId] = useState<string>();
  const [renamingId, setRenamingId] = useState<string>();
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string>();

  const counts = useMemo(() => {
    const today = startOfDay(new Date());
    const weekEnd = addDays(today, 7).getTime();
    const all = Object.values(tasks);
    const byProject: Record<string, number> = {};
    let todayCount = 0;
    let weekCount = 0;
    let overdue = 0;

    all.forEach((task) => {
      if (task.status === 2) return;
      byProject[task.projectId] = (byProject[task.projectId] ?? 0) + 1;
      if (!task.dueDate) return;
      const due = new Date(task.dueDate.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')).getTime();
      if (Number.isNaN(due)) return;
      if (due < today.getTime()) overdue += 1;
      if (due < today.getTime() + 86_400_000) todayCount += 1;
      if (due <= weekEnd) weekCount += 1;
    });

    return { byProject, todayCount, weekCount, overdue };
  }, [tasks]);

  const customProjects = projects.filter((project) => project.permission !== 'inbox');
  const inbox = projects.find((project) => project.permission === 'inbox');
  const grouped = groups.map((group) => ({ group, items: customProjects.filter((project) => project.groupId === group.id) }));
  const ungrouped = customProjects.filter((project) => !project.groupId || !groups.some((group) => group.id === project.groupId));

  const submitCreate = () => {
    const name = newName.trim();
    if (!name) {
      setCreating(false);
      return;
    }
    void createProject(name);
    setNewName('');
    setCreating(false);
  };

  const submitRename = (id: string) => {
    const name = renameValue.trim();
    if (name) void renameProject(id, name);
    setRenamingId(undefined);
  };

  const renderProject = (id: string, name: string, color?: string, count?: number) => {
    if (renamingId === id) {
      return (
        <input
          key={id}
          autoFocus
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          onBlur={() => submitRename(id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitRename(id);
            if (event.key === 'Escape') setRenamingId(undefined);
          }}
          className="h-8 w-full rounded-lg border border-brand/50 bg-panel px-2 text-[13px] text-ink"
        />
      );
    }
    return (
      <div key={id} className="group/project relative">
        <NavLink
          to={`/project/${id}`}
          className={({ isActive }) =>
            cn(
              'flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150',
              isActive ? 'bg-brand-50 text-brand' : 'text-muted hover:bg-subtle hover:text-ink',
            )
          }
        >
          <span
            className="h-2 w-2 shrink-0 rounded-[3px]"
            style={{ backgroundColor: color ?? '#0E9F8A', boxShadow: `0 0 0 3px ${hexToRgba(color ?? '#0E9F8A', 0.14)}` }}
          />
          <span className="flex-1 truncate">{name}</span>
          {count ? <span className="text-2xs tabular-nums text-faint group-hover/project:opacity-0">{count}</span> : null}
        </NavLink>
        <button
          type="button"
          aria-label={`${name} 更多操作`}
          onClick={() => setMenuId(menuId === id ? undefined : id)}
          className="absolute right-1 top-1 hidden h-6 w-6 cursor-pointer items-center justify-center rounded-md text-faint hover:bg-panel hover:text-ink group-hover/project:flex"
        >
          <MoreHorizontal size={14} />
        </button>
        <Popover open={menuId === id} onClose={() => setMenuId(undefined)} align="end" className="min-w-[150px]">
          <MenuItem
            icon={<Layers size={13} />}
            onClick={() => {
              setRenamingId(id);
              setRenameValue(name);
              setMenuId(undefined);
            }}
          >
            重命名清单
          </MenuItem>
          <MenuItem
            danger
            icon={<Trash2 size={13} />}
            onClick={() => {
              setDeleteTarget(id);
              setMenuId(undefined);
            }}
          >
            删除清单
          </MenuItem>
        </Popover>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1">
      <p className="section-label mb-1">智能清单</p>
      <NavItem to="/today" label="今天" icon={<Sun size={15} />} count={counts.todayCount} />
      <NavItem to="/week" label="最近 7 天" icon={<CalendarRange size={15} />} count={counts.weekCount} />
      <NavItem to="/notebook" label="笔记本" icon={<NotebookPen size={15} />} count={inbox ? counts.byProject[inbox.id] : 0} />
      <NavItem to="/completed" label="已完成" icon={<CheckCircle2 size={15} />} />

      <p className="section-label mb-1 mt-5">视图</p>
      <NavItem to="/calendar" label="日历" icon={<CalendarDays size={15} />} />
      <NavItem to="/quadrant" label="四象限" icon={<LayoutGrid size={15} />} />

      <div className="mb-1 mt-5 flex items-center justify-between pr-1">
        <p className="section-label">我的清单</p>
        <IconButton aria-label="新建清单" className="h-6 w-6" onClick={() => setCreating(true)}>
          <Plus size={14} />
        </IconButton>
      </div>

      {grouped.map(({ group, items }) => (
        <div key={group.id} className="mb-1">
          <div className="flex items-center gap-1 px-2.5 py-1 text-2xs font-medium text-faint">
            <ChevronDown size={11} />
            {group.name}
          </div>
          {items.map((project) => renderProject(project.id, project.name, project.color, counts.byProject[project.id]))}
        </div>
      ))}

      {ungrouped.map((project) => renderProject(project.id, project.name, project.color, counts.byProject[project.id]))}

      {creating ? (
        <input
          autoFocus
          value={newName}
          placeholder="清单名称，回车创建"
          onChange={(event) => setNewName(event.target.value)}
          onBlur={submitCreate}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitCreate();
            if (event.key === 'Escape') {
              setCreating(false);
              setNewName('');
            }
          }}
          className="mt-1 h-8 w-full rounded-lg border border-brand/50 bg-panel px-2 text-[13px] text-ink"
        />
      ) : null}

      {!customProjects.length && !creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-1 flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-2.5 text-xs text-faint transition-colors hover:border-brand/40 hover:text-brand"
        >
          <Plus size={13} /> 创建第一个清单
        </button>
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(undefined)}
        title="删除清单"
        subtitle="清单内的任务会一并从视图中移除，操作不可撤销。"
        width="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(undefined)}>
              取消
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (deleteTarget) void deleteProject(deleteTarget);
                setDeleteTarget(undefined);
              }}
            >
              确认删除
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">
          即将删除清单「{customProjects.find((project) => project.id === deleteTarget)?.name ?? ''}」，其中的任务会一并删除。
        </p>
      </Modal>
    </div>
  );
}
