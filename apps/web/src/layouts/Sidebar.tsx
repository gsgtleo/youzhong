import { NavLink } from 'react-router-dom';
import { CheckCircle2, CloudOff, Monitor, Moon, RefreshCw, Search, Settings, Sun, Wifi } from 'lucide-react';
import type { ThemeMode } from '@/store/ui';
import { SealMark } from '@/components/BrandMark';
import { ProjectTree } from '@/features/projects/ProjectTree';
import { useApp } from '@/store/app';
import { useUi } from '@/store/ui';
import { cn } from '@/lib/utils';

const THEME_BUTTONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '淡色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
];

function relativeTime(timestamp?: number): string {
  if (!timestamp) return '尚未同步';
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return '刚刚同步';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前同步`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前同步`;
  return `${Math.floor(diff / 86_400_000)} 天前同步`;
}

export function Sidebar({ onSync }: { onSync: () => void }) {
  const mode = useApp((state) => state.mode);
  const syncing = useApp((state) => state.syncing);
  const lastSync = useApp((state) => state.lastSync);
  const setSearchOpen = useUi((state) => state.setSearchOpen);
  const query = useUi((state) => state.query);
  const theme = useUi((state) => state.theme);
  const setTheme = useUi((state) => state.setTheme);

  const live = mode !== 'mock';

  return (
    <aside className="flex h-full w-[268px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="px-3 pt-3">
        <div className="relative overflow-hidden rounded-2xl brand-gradient px-3.5 py-3 text-white shadow-[0_10px_30px_-12px_rgb(var(--brand-rgb)/0.7)]">
          <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/12" />
          <div className="absolute -bottom-10 -left-4 h-24 w-24 rounded-full bg-white/8" />
          <div className="relative flex items-center gap-2.5">
            <SealMark size={34} className="shrink-0 rounded-[9px] shadow-[0_6px_16px_-6px_rgba(0,0,0,0.55)] ring-1 ring-white/30" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <p className="shrink-0 text-[15px] font-semibold leading-5 tracking-tight">有终</p>
                <span className="flex min-w-0 items-center gap-1 text-[10px] leading-4 text-white/60">
                  {live ? <Wifi size={9} /> : <CloudOff size={9} />}
                  <span className="truncate">{live ? '已连接' : '演示数据'}</span>
                </span>
              </div>
              <p className="mt-0.5 truncate font-quote text-[11px] leading-4 tracking-[0.02em] text-white/70">靡不有初，鲜克有终</p>
            </div>
            <button
              type="button"
              aria-label="立即同步"
              onClick={onSync}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white/15 transition-colors hover:bg-white/25"
            >
              <RefreshCw size={13} className={cn(syncing && 'animate-spin')} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="mt-3 flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-subtle/60 px-2.5 text-xs text-faint transition-colors hover:border-brand/40 hover:text-ink"
        >
          <Search size={13} />
          <span className="flex-1 text-left">{query ? `搜索：${query}` : '搜索任务、标签或备注'}</span>
          <kbd className="rounded border border-line bg-panel px-1 text-[10px] text-faint">/</kbd>
        </button>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-2.5 pb-3">
        <ProjectTree />
      </div>

      <div className="border-t border-line px-2.5 py-2">
        <div className="mb-1 flex items-center gap-1.5 px-1.5 text-2xs text-faint">
          <span
            className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-emerald-500' : 'bg-amber-500')}
            style={{ boxShadow: live ? '0 0 0 3px rgba(34,160,107,0.14)' : '0 0 0 3px rgba(245,166,35,0.16)' }}
          />
          <span className="truncate">{live ? relativeTime(lastSync) : '演示数据 · 设置后可接真实账号'}</span>
          {live ? <CheckCircle2 size={11} className="ml-auto text-emerald-500" /> : null}
        </div>
        <div className="flex items-center gap-1 px-1 pb-1">
          <span className="mr-auto text-2xs text-faint">外观</span>
          {THEME_BUTTONS.map((item) => {
            const Icon = item.icon;
            const active = theme === item.value;
            return (
              <button
                key={item.value}
                type="button"
                title={item.label}
                aria-label={`主题：${item.label}`}
                aria-pressed={active}
                onClick={() => setTheme(item.value)}
                className={cn(
                  'flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-colors',
                  active ? 'bg-brand-50 text-brand' : 'text-faint hover:bg-subtle hover:text-ink',
                )}
              >
                <Icon size={13} />
              </button>
            );
          })}
        </div>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
              isActive ? 'bg-brand-50 text-brand' : 'text-muted hover:bg-subtle hover:text-ink',
            )
          }
        >
          <Settings size={15} />
          设置与账号
        </NavLink>
      </div>
    </aside>
  );
}
