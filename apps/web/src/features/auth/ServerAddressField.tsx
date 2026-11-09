import { Check, Loader2, Server, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onTest: () => void;
  status: TestStatus;
  message?: string;
}

export function ServerAddressField({ value, onChange, onTest, status, message }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="server-url" className="text-2xs font-medium text-muted">
        服务器地址
      </label>
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border bg-panel px-3 transition-all duration-200',
          status === 'ok' && 'border-emerald-400/70',
          status === 'error' && 'border-red-400/70',
          status !== 'ok' && status !== 'error' && 'border-line focus-within:border-brand/60',
        )}
      >
        <Server size={14} className="shrink-0 text-faint" />
        <input
          id="server-url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onTest();
          }}
          placeholder="http://192.168.1.20:10078"
          aria-label="服务器地址"
          autoComplete="url"
          spellCheck={false}
          className="h-10 w-full min-w-0 border-0 bg-transparent p-0 text-[13px] text-ink shadow-none outline-none placeholder:text-faint"
        />
        <button
          type="button"
          onClick={onTest}
          disabled={status === 'testing'}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-line px-2 py-1 text-2xs text-muted transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'testing' ? <Loader2 size={11} className="animate-spin" /> : null}
          {status === 'ok' ? <Check size={11} className="text-emerald-500" /> : null}
          {status === 'error' ? <X size={11} className="text-red-500" /> : null}
          测试连接
        </button>
      </div>
      {message ? (
        <p
          className={cn(
            'flex items-center gap-1 text-2xs animate-fade-in',
            status === 'ok' ? 'text-emerald-600' : status === 'error' ? 'text-red-500' : 'text-faint',
          )}
        >
          {message}
        </p>
      ) : (
        <p className="text-2xs text-faint">留空表示使用当前站点；安卓端请填写 http://IP:10078</p>
      )}
    </div>
  );
}
