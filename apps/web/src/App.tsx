import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { DesktopShell } from '@/layouts/DesktopShell';
import { MobileShell } from '@/layouts/MobileShell';
import CalendarPage from '@/pages/CalendarPage';
import QuadrantPage from '@/pages/QuadrantPage';
import SettingsPage from '@/pages/SettingsPage';
import TaskViewPage from '@/pages/TaskViewPage';
import LoginPage from '@/pages/LoginPage';
import { bindAuth, setServerUrl as persistServerUrl } from '@/api/http';
import { useAuth } from '@/store/auth';
import { triggerSync } from '@/sync/useSync';
import { useApp } from '@/store/app';
import { useUi } from '@/store/ui';
import { useSync } from '@/sync/useSync';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { isEditableTarget } from '@/lib/utils';
import { applyBrand } from '@/lib/theme';

function useThemeEffect() {
  const theme = useUi((state) => state.theme);
  const accent = useUi((state) => state.accent);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      // 主题色（品牌色）在主色变量里，明暗切换后要重新计算一遍
      const brand = applyBrand(accent, dark);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#121316' : brand);
    };
    apply();
    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, accent]);
}

function BootSplash() {
  return (
    <div className="mesh-bg flex h-full flex-col items-center justify-center gap-4">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl brand-gradient text-xl font-bold text-white shadow-[0_16px_36px_-12px_rgb(var(--brand-rgb)/0.75)]">
        时
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-medium text-ink">正在同步你的清单…</p>
        <p className="text-2xs text-faint">首次加载会拉取清单、任务与日历数据</p>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-subtle">
        <div className="h-full w-1/2 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-brand" />
      </div>
    </div>
  );
}

export default function App() {
  useThemeEffect();
  useSync();
  const isMobile = useIsMobile();
  const ready = useApp((state) => state.ready);
  const setSearchOpen = useUi((state) => state.setSearchOpen);
  const navigate = useNavigate();
  const token = useAuth((state) => state.token);

  useEffect(() => {
    persistServerUrl(useAuth.getState().serverUrl);
    bindAuth(
      () => useAuth.getState().token,
      () => useAuth.getState().logout(),
    );
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        if (event.key.toLowerCase() === 'k') {
          event.preventDefault();
          setSearchOpen(true);
        }
        return;
      }
      if (event.key === '/' && !isEditableTarget(event.target)) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'g' && !isEditableTarget(event.target)) {
        navigate('/today');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, setSearchOpen]);

  if (!token) {
    return (
      <LoginPage
        onSuccess={() => {
          useApp.setState({ ready: false });
          triggerSync(false);
        }}
      />
    );
  }

  if (!ready) return <BootSplash />;

  const Shell = isMobile ? MobileShell : DesktopShell;

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TaskViewPage kind="today" />} />
        <Route path="/week" element={<TaskViewPage kind="week" />} />
        <Route path="/notebook" element={<TaskViewPage kind="notebook" />} />
        {/* 旧的 /inbox 地址统一跳到笔记本 */}
        <Route path="/inbox" element={<Navigate to="/notebook" replace />} />
        <Route path="/completed" element={<TaskViewPage kind="completed" />} />
        <Route path="/project/:id" element={<TaskViewPage kind="project" />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/quadrant" element={<QuadrantPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  );
}
