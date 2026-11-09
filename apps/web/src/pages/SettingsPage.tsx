import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Database, Download, LogOut, Moon, RefreshCw, Sun, Trash2 } from 'lucide-react';
import { Button, Input, Segmented } from '@/components/ui/primitives';
import { NotificationPanel } from '@/features/settings/NotificationPanel';
import { UserManager } from '@/features/settings/UserManager';
import { BackupPanel } from '@/features/settings/BackupPanel';
import { ACCENT_PRESETS } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { formatVersion } from '@/lib/version';
import { authApi } from '@/api/auth';
import { getServerUrl } from '@/api/http';
import { clearLocalCache } from '@/db/dexie';
import { pendingCount } from '@/sync/queue';
import { triggerSync } from '@/sync/useSync';
import { toast } from '@/components/ui/toast';
import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';
import { useUi } from '@/store/ui';

interface PackageInfo {
  name: string;
  version: string | null;
  size: number;
  date: string;
  url: string;
}

interface VersionInfo {
  server: string;
  apiVersion: number;
  build: string | null;
  apk: PackageInfo | null;
  desktop?: PackageInfo | null;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-4 shadow-card">
      <div className="mb-3">
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-2xs leading-relaxed text-faint">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-[13px] text-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-2xs text-faint">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const lastSync = useApp((state) => state.lastSync);
  const theme = useUi((state) => state.theme);
  const setTheme = useUi((state) => state.setTheme);
  const accent = useUi((state) => state.accent);
  const setAccent = useUi((state) => state.setAccent);
  const density = useUi((state) => state.density);
  const setDensity = useUi((state) => state.setDensity);
  const weekStartsOn = useUi((state) => state.weekStartsOn);
  const setWeekStartsOn = useUi((state) => state.setWeekStartsOn);
  const ruleId = useUi((state) => state.ruleId);
  const setRuleId = useUi((state) => state.setRuleId);

  const [pending, setPending] = useState(0);
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void pendingCount().then(setPending);
  }, [lastSync]);

  const loadVersion = async (notify: boolean) => {
    setChecking(true);
    try {
      const base = getServerUrl() || (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
      const response = await fetch(`${base}/api/version`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as VersionInfo;
      setVersion(data);
      if (notify) {
        toast(
          data.apk?.version ? `已是最新配置 · 服务端 ${data.server} · 安卓包 ${data.apk.version}` : `服务端 ${data.server} · 暂无安卓安装包`,
          'success',
        );
      }
    } catch (error) {
      if (notify) toast(`检查失败：${(error as Error).message}`, 'error');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void loadVersion(false);
  }, []);

  const logout = async () => {
    await authApi.logout().catch(() => undefined);
    useAuth.getState().logout();
    useApp.setState({ ready: false, tasks: {}, projects: [], events: [], tags: [] });
    navigate('/login');
  };

  return (
    <div className="h-full overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-line bg-app/85 px-4 py-3 backdrop-blur-xl md:px-6">
        <h1 className="text-[18px] font-semibold tracking-tight text-ink">设置</h1>
        <p className="mt-0.5 text-2xs text-faint">{user ? `${user.displayName}（@${user.username}）` : '未登录'}</p>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-3 py-4 md:px-6">
        <Section title="账号与服务器" description={`当前服务器：${getServerUrl() || '同源部署'}`}>
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Input
                type="password"
                placeholder="当前密码"
                value={passwords.current}
                onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
              />
              <Input
                type="password"
                placeholder="新密码（至少 8 位）"
                value={passwords.next}
                onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await authApi.changePassword(passwords.current, passwords.next);
                    toast('密码已更新', 'success');
                    setPasswords({ current: '', next: '' });
                  } catch (error) {
                    toast((error as Error).message, 'error');
                  }
                }}
              >
                修改密码
              </Button>
              <Button size="sm" variant="outline" onClick={() => void logout()}>
                <LogOut size={13} /> 退出登录
              </Button>
            </div>
          </div>
        </Section>

        <Section title="通知" description="到期提醒、每日汇总推送到钉钉/飞书，安卓端同时收到本地通知">
          <NotificationPanel />
        </Section>

        {user?.role === 'admin' ? (
          <Section title="成员管理" description="管理员可创建账号、重置密码、停用成员；最多 10 人">
            <UserManager />
          </Section>
        ) : null}

        <Section title="外观与视图" description="淡色 / 深色 / 系统色三档可选，切换立即生效并记住选择">
          <Row label="主题" hint="跟随系统时，手机或电脑切换深浅色会自动跟着变">
            <Segmented
              value={theme}
              onChange={(value) => setTheme(value)}
              options={[
                { value: 'light', label: '淡色', icon: <Sun size={11} /> },
                { value: 'dark', label: '深色', icon: <Moon size={11} /> },
                { value: 'system', label: '系统色', icon: null },
              ]}
            />
          </Row>
          <div className="border-t border-line py-2">
            <p className="text-[13px] text-ink">主题色</p>
            <p className="mt-0.5 text-2xs text-faint">
              默认已换成青玉，替换掉原先与商业产品过于接近的蓝色；换色只影响主色，不影响任务数据
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ACCENT_PRESETS.map((preset) => {
                const active = accent === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.note}
                    aria-pressed={active}
                    onClick={() => setAccent(preset.id)}
                    className={cn(
                      'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-2xs font-medium transition-all duration-150',
                      active ? 'border-brand/50 bg-brand-50 text-brand' : 'border-line text-muted hover:border-line hover:text-ink',
                    )}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: preset.hex }} />
                    {preset.name}
                    {active ? <Check size={10} strokeWidth={3} /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <Row label="列表密度">
            <Segmented
              value={density}
              onChange={(value) => setDensity(value)}
              options={[
                { value: 'comfortable', label: '舒适' },
                { value: 'compact', label: '紧凑' },
              ]}
            />
          </Row>
          <Row label="每周起始日">
            <Segmented
              value={String(weekStartsOn) as '0' | '1'}
              onChange={(value) => setWeekStartsOn(value === '1' ? 1 : 0)}
              options={[
                { value: '1', label: '周一' },
                { value: '0', label: '周日' },
              ]}
            />
          </Row>
          <Row label="四象限规则" hint="切换后象限分布立即按新规则计算">
            <Segmented
              value={ruleId}
              onChange={(value) => setRuleId(value)}
              options={[
                { value: 'priority', label: '按优先级' },
                { value: 'urgency', label: '优先级 + 时间' },
              ]}
            />
          </Row>
        </Section>

        <Section title="版本与更新" description="网页会自动更新；安卓端与 Windows 桌面端需手动下载新包（覆盖安装即可保留数据）">
          <Row label="网页版本" hint={`构建 ${__BUILD_ID__} · 强制刷新：Ctrl+Shift+R`}>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw size={13} /> 重新加载
            </Button>
          </Row>
          <Row label="服务端版本" hint={version ? `接口 v${version.apiVersion}` : '读取中…'}>
            <span className="text-xs text-ink tabular-nums">{formatVersion(version?.server)}</span>
          </Row>
          <Row
            label="安卓客户端最新包"
            hint={
              version?.apk
                ? `${(version.apk.size / 1024 / 1024).toFixed(1)} MB · ${new Date(version.apk.date).toLocaleDateString('zh-CN')} · ${version.apk.name}`
                : '服务器 dist-packages 里还没有 APK'
            }
          >
            {version?.apk ? (
              <a
                href={`${getServerUrl() || (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${version.apk.url}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-brand transition-colors hover:border-brand/40 hover:bg-brand-50"
              >
                <Download size={13} /> 下载 {formatVersion(version.apk.version)}
              </a>
            ) : (
              <span className="text-xs text-faint">—</span>
            )}
          </Row>
          <Row
            label="Windows 客户端"
            hint={
              version?.desktop
                ? `${(version.desktop.size / 1024 / 1024).toFixed(0)} MB · ${new Date(version.desktop.date).toLocaleDateString('zh-CN')} · ${version.desktop.name}`
                : '服务器 dist-packages 里还没有桌面端安装包（把 youzhong-desktop-*.zip 放进去即可）'
            }
          >
            {version?.desktop ? (
              <a
                href={`${getServerUrl() || (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${version.desktop.url}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-brand transition-colors hover:border-brand/40 hover:bg-brand-50"
              >
                <Download size={13} /> 下载 {version.desktop.version ?? ''}
              </a>
            ) : (
              <span className="text-xs text-faint">—</span>
            )}
          </Row>
          <div className="pt-1">
            <Button size="sm" onClick={() => void loadVersion(true)} disabled={checking}>
              {checking ? '检查中…' : '检查更新'}
            </Button>
          </div>
        </Section>

        <Section title="数据与缓存" description="快照缓存到浏览器 IndexedDB；再用 WebDAV 备份一份，换服务器后可直接恢复">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => triggerSync(false)}>
              <RefreshCw size={13} /> 立即同步
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await clearLocalCache();
                setPending(0);
                toast('本地缓存已清除', 'success');
                triggerSync(false);
              }}
            >
              <Trash2 size={13} /> 清除本地缓存
            </Button>
            <span className="inline-flex items-center gap-1 rounded-lg bg-subtle px-2 py-1 text-2xs text-faint">
              <Database size={11} /> 待重试写入 {pending} 条
            </span>
          </div>
          <BackupPanel />
        </Section>

        <p className="px-1 text-2xs text-faint">前端构建：{__BUILD_ID__} · 若页面缺少新功能，请按 Ctrl+Shift+R 强制刷新</p>

        <p className="px-1 pb-8 text-2xs leading-relaxed text-faint">
          自托管多用户版。数据保存在你自己的 SQLite 数据库（默认 10 人上限），请定期备份
          `/var/lib/youzhong/youzhong.db`。本项目为独立实现，与任何第三方商业产品无关联。
        </p>
      </div>
    </div>
  );
}
