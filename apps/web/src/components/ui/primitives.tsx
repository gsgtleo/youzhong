import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { CompletedMark } from '@/components/BrandMark';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger';
type Size = 'xs' | 'sm' | 'md';

const variantClass: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-[0_6px_16px_-6px_rgb(var(--brand-rgb)/0.65)] hover:bg-brand-600 active:scale-[0.985]',
  soft: 'bg-brand-50 text-brand hover:bg-brand-100',
  ghost: 'text-muted hover:bg-subtle hover:text-ink',
  outline: 'border border-line bg-panel text-ink hover:border-brand/40 hover:text-brand',
  danger: 'bg-red-500 text-white hover:bg-red-600',
};

const sizeClass: Record<Size, string> = {
  xs: 'h-7 gap-1 rounded-lg px-2 text-2xs',
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-xs',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 ease-snap disabled:cursor-not-allowed disabled:opacity-55',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }>(
  function IconButton({ className, active, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-all duration-150 ease-snap hover:bg-subtle hover:text-ink active:scale-95',
          active && 'bg-brand-50 text-brand',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, wrapperClassName, prefix, suffix, ...props },
  ref,
) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border border-line bg-panel px-3 transition-colors duration-150 focus-within:border-brand/60',
        wrapperClassName,
      )}
    >
      {prefix ? <span className="shrink-0 text-faint">{prefix}</span> : null}
      <input
        ref={ref}
        className={cn('h-9 w-full min-w-0 border-0 bg-transparent p-0 text-sm text-ink shadow-none outline-none', className)}
        {...props}
      />
      {suffix ? <span className="shrink-0 text-faint">{suffix}</span> : null}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full resize-none rounded-xl border border-line bg-panel px-3 py-2 text-sm leading-relaxed text-ink outline-none transition-colors focus:border-brand/60',
        className,
      )}
      {...props}
    />
  );
});

export function Checkbox({
  checked,
  onChange,
  size = 18,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  /** 保留参数以兼容旧调用（完成态统一使用品牌标识，不再跟随清单颜色） */
  color?: string;
  size?: number;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange();
      }}
      style={{ width: size, height: size }}
      className={cn(
        'group/check flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-all duration-150 ease-snap active:scale-90',
        checked ? 'border-0' : 'border-[1.5px] border-[#CBD2DC] hover:border-brand',
      )}
    >
      {checked ? (
        <CompletedMark size={size} className="animate-pop-in" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-transparent transition-colors duration-150 group-hover/check:bg-brand/35" />
      )}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'sm',
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'xs' | 'sm';
}) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-lg bg-subtle p-0.5', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1 rounded-[7px] font-medium transition-all duration-150 ease-snap',
              size === 'xs' ? 'h-6 px-2 text-2xs' : 'h-7 px-2.5 text-xs',
              active ? 'bg-panel text-ink shadow-[0_1px_3px_rgba(16,24,40,0.10)]' : 'text-muted hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  color,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active && color ? { backgroundColor: `${color}18`, color, borderColor: `${color}55` } : undefined}
      className={cn(
        'inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-line px-2.5 text-xs text-muted transition-all duration-150 hover:border-brand/40 hover:text-brand',
        active && !color && 'border-brand/50 bg-brand-50 text-brand',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Dot({ color, size = 7 }: { color: string; size?: number }) {
  return <span className="inline-block rounded-full" style={{ width: size, height: size, backgroundColor: color }} />;
}

export function ProgressRing({ value, size = 34, stroke = 3, color = '#0E9F8A' }: { value: number; size?: number; stroke?: number; color?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, value)));
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-line" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 400ms cubic-bezier(0.22,1,0.36,1)' }}
      />
    </svg>
  );
}
