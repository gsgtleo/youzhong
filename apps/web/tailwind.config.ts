import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /**
         * 主色走 CSS 变量（lib/theme.ts 写入通道值），品牌色可整套切换。
         * 必须是 `rgb(var(--x) / <alpha-value>)` 形式，`bg-brand/40` 这类透明度修饰才有效。
         */
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          600: 'rgb(var(--brand-600-rgb) / <alpha-value>)',
          700: 'rgb(var(--brand-700-rgb) / <alpha-value>)',
          100: 'rgb(var(--brand-100-rgb) / <alpha-value>)',
          50: 'rgb(var(--brand-50-rgb) / <alpha-value>)',
        },
        app: 'var(--bg)',
        panel: 'var(--panel)',
        subtle: 'var(--subtle)',
        hover: 'var(--hover)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        muted: 'var(--ink-muted)',
        faint: 'var(--ink-faint)',
      },
      fontFamily: {
        sans: ['PingFang SC', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Microsoft YaHei', 'sans-serif'],
        /** 古典引文（如「靡不有初，鲜克有终」）用衬线字体，和界面黑体形成对比 */
        quote: ['Songti SC', 'Noto Serif SC', 'Source Han Serif SC', 'STSong', 'SimSun', 'serif'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 10px 28px -16px rgba(16,24,40,0.18)',
        pop: '0 16px 40px -12px rgba(16,24,40,0.24), 0 2px 6px rgba(16,24,40,0.06)',
        drag: '0 18px 44px -10px rgb(var(--brand-rgb) / 0.38)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        'slide-up': 'slide-up 220ms cubic-bezier(0.22,1,0.36,1) both',
        'pop-in': 'pop-in 160ms cubic-bezier(0.22,1,0.36,1) both',
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.22,1,0.36,1) both',
      },
      transitionTimingFunction: {
        snap: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
