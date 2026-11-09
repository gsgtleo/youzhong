import { Outlet } from 'react-router-dom';
import { TaskDetail } from '@/features/tasks/TaskDetail';
import { SearchPanel } from '@/features/search/SearchPanel';
import { ToastViewport } from '@/components/ui/toast';
import { triggerSync } from '@/sync/useSync';
import { Sidebar } from './Sidebar';

export function DesktopShell() {
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar onSync={() => triggerSync(false)} />
      <main className="mesh-bg flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
      <TaskDetail />
      <SearchPanel />
      <ToastViewport />
    </div>
  );
}
