import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, LockKeyhole, UserRound, Wifi, WifiOff } from 'lucide-react';
import { SealMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/primitives';
import { ServerAddressField, type TestStatus } from '@/features/auth/ServerAddressField';
import { authApi } from '@/api/auth';
import { setServerUrl as persistServerUrl } from '@/api/http';
import { useAuth } from '@/store/auth';
import { formatVersion } from '@/lib/version';
import { useApp } from '@/store/app';
import { toast } from '@/components/ui/toast';

export default function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const serverUrl = useAuth((state) => state.serverUrl);
  const setServerUrl = useAuth((state) => state.setServerUrl);
  const setPing = useAuth((state) => state.setPing);
  const ping = useAuth((state) => state.ping);
  const setUser = useAuth((state) => state.setUser);
  const setToken = useAuth((state) => state.setToken);

  const [url, setUrl] = useState(serverUrl);
  const [status, setStatus] = useState<TestStatus>(ping ? 'ok' : 'idle');
  const [message, setMessage] = useState(ping ? `已连接：${ping.name} · ${formatVersion(ping.version)}` : '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    persistServerUrl(url);
  }, [url]);

  const test = async () => {
    setStatus('testing');
    setMessage('正在连接服务器…');
    try {
      persistServerUrl(url);
      const result = await authApi.ping();
      setPing(result);
      setStatus('ok');
      setMessage(`连接成功：${result.name} · ${formatVersion(result.version)} · 已注册 ${result.userCount} 位用户`);
    } catch (error) {
      setStatus('error');
      setMessage(`连接失败：${(error as Error).message}（请检查地址、端口与防火墙）`);
    }
  };

  const submit = async () => {
    if (!username.trim() || !password) {
      toast('请输入用户名和密码', 'error');
      return;
    }
    setSubmitting(true);
    persistServerUrl(url);
    try {
      const session = await authApi.login(username.trim(), password);
      setToken(session.token);
      setUser(session.user);
      setServerUrl(url);
      useApp.getState().setMeta({ mode: 'server', authed: true });
      toast(`欢迎回来，${session.user.displayName}`, 'success');
      onSuccess();
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <div className="relative flex flex-col justify-between overflow-hidden brand-gradient px-6 py-8 text-white md:w-[46%] md:px-12 md:py-14">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-white/8" />
        <div className="relative flex items-center gap-3">
          <SealMark size={42} className="shrink-0 rounded-[11px] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/30" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[19px] font-semibold tracking-tight">有终</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] tracking-wide text-white/75 backdrop-blur">
                家庭服务器
              </span>
            </div>
            <p className="mt-0.5 font-quote text-[11.5px] tracking-wide text-white/65">靡不有初，鲜克有终</p>
          </div>
        </div>
        <div className="relative mt-8 md:mt-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight md:text-[32px]">家庭与团队的任务中枢</h1>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-white/80">
            每个人用自己的账号登录，清单、任务、日历与四象限彼此独立；到期提醒可以推送到钉钉和飞书群里。
          </p>

          <figure className="mt-6 max-w-sm rounded-xl border border-white/15 border-l-2 border-l-[#D9A441]/85 bg-white/10 px-4 py-3 backdrop-blur">
            <blockquote className="font-quote text-[15px] leading-7 tracking-wide text-white/95">靡不有初，鲜克有终。</blockquote>
            <figcaption className="mt-1.5 text-2xs leading-relaxed text-white/70">
              出自《诗经·大雅·荡》。原句是「荡荡上帝，下民之辟……靡不有初，鲜克有终」，意思是：凡事都有一个开端，
              却很少有人能坚持到最后。
            </figcaption>
            <p className="mt-1.5 text-2xs leading-relaxed text-white/55">名字取「有终」二字——把开头的事，做到收尾。</p>
          </figure>

          <div className="mt-5 flex flex-wrap gap-2 text-2xs text-white/85">
            {['最多 10 位成员', '数据存本机 SQLite', '日历 + 四象限', '钉钉 / 飞书通知'].map((item) => (
              <span key={item} className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">
                {item}
              </span>
            ))}
          </div>
        </div>
        <p className="relative mt-8 hidden text-2xs text-white/60 md:block">数据仅保存在你自己的服务器上，不经过任何第三方。</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-8 md:px-10">
        <div className="w-full max-w-[420px] animate-slide-up">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-[20px] font-semibold tracking-tight text-ink">登录</h2>
              <p className="mt-1 text-2xs text-faint">首次使用请先填写服务器地址并测试连接</p>
            </div>
            <span className={status === 'ok' ? 'text-emerald-500' : 'text-faint'}>
              {status === 'ok' ? <Wifi size={18} /> : <WifiOff size={18} />}
            </span>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-4 shadow-card md:p-5">
            <ServerAddressField value={url} onChange={setUrl} onTest={test} status={status} message={message} />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-2xs font-medium text-muted">
                用户名
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-line px-3 focus-within:border-brand/60">
                <UserRound size={14} className="shrink-0 text-faint" />
                <input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  placeholder="admin"
                  className="h-10 w-full border-0 bg-transparent p-0 text-[13px] text-ink shadow-none outline-none placeholder:text-faint"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-2xs font-medium text-muted">
                密码
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-line px-3 focus-within:border-brand/60">
                <LockKeyhole size={14} className="shrink-0 text-faint" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void submit();
                  }}
                  autoComplete="current-password"
                  placeholder="请输入密码"
                  className="h-10 w-full border-0 bg-transparent p-0 text-[13px] text-ink shadow-none outline-none placeholder:text-faint"
                />
                <button
                  type="button"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPassword((value) => !value)}
                  className="cursor-pointer text-faint transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <Button size="md" onClick={submit} disabled={submitting} className="mt-1 h-11 w-full">
              {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
              {submitting ? '登录中…' : '登录'}
            </Button>
            <p className="text-center text-2xs text-faint">账号由管理员创建，忘记密码请联系管理员重置</p>
          </div>
        </div>
      </div>
    </div>
  );
}
