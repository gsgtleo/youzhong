import { create } from 'zustand';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastTone = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, tone?: ToastTone) => void;
  remove: (id: number) => void;
}

export const useToast = create<ToastState>((set) => ({
  items: [],
  push: (message, tone = 'info') => {
    const id = Date.now() + Math.random();
    set((state) => ({ items: [...state.items.slice(-3), { id, message, tone }] }));
    window.setTimeout(() => {
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
    }, 3600);
  },
  remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
}));

export function toast(message: string, tone: ToastTone = 'info'): void {
  useToast.getState().push(message, tone);
}

const toneStyle: Record<ToastTone, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: 'text-brand bg-brand-50' },
  success: { icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50' },
  error: { icon: AlertCircle, className: 'text-red-600 bg-red-50' },
};

export function ToastViewport() {
  const items = useToast((state) => state.items);
  const remove = useToast((state) => state.remove);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-6 md:bottom-6 md:items-end">
      {items.map((item) => {
        const { icon: Icon, className } = toneStyle[item.tone];
        return (
          <div
            key={item.id}
            className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border border-line bg-panel px-3.5 py-3 shadow-pop"
          >
            <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', className)}>
              <Icon size={14} />
            </span>
            <p className="flex-1 text-[13px] leading-relaxed text-ink">{item.message}</p>
            <button
              type="button"
              aria-label="关闭提示"
              onClick={() => remove(item.id)}
              className="cursor-pointer rounded-md p-1 text-faint transition-colors hover:bg-subtle hover:text-ink"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
