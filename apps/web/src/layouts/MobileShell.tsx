import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, LayoutGrid, ListTodo, Settings2 } from 'lucide-react';
import { TaskDetail } from '@/features/tasks/TaskDetail';
import { SearchPanel } from '@/features/search/SearchPanel';
import { ToastViewport } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/today', label: '清单', icon: ListTodo },
  { to: '/calendar', label: '日历', icon: CalendarDays },
  { to: '/quadrant', label: '四象限', icon: LayoutGrid },
  { to: '/settings', label: '我的', icon: Settings2 },
];

export function MobileShell() {
  return (
    <div className="flex h-full flex-col bg-app">
      <main className="min-h-0 flex-1 overflow-y-auto pb-[calc(62px+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-panel/95 backdrop-blur-xl">
        <div className="safe-bottom mx-auto flex max-w-lg items-stretch">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-1 flex-col items-center gap-0.5 py-2 text-2xs transition-colors',
                    isActive ? 'text-brand' : 'text-faint',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('flex h-7 w-9 items-center justify-center rounded-lg transition-colors', isActive && 'bg-brand-50')}>
                      <Icon size={17} strokeWidth={isActive ? 2.4 : 1.9} />
                    </span>
                    {tab.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <TaskDetail />
      <SearchPanel />
      <ToastViewport />
    </div>
  );
}
