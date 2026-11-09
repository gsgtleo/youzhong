/**
 * 品牌色（主题色）系统
 *
 * 背景：原来整套界面的主色是 #0E9F8A，和被广泛认识的商业产品主色过于接近，
 * 有被认定为「傍名牌 / 混淆来源」的风险。这里把主色抽成可切换的预设色板，
 * 默认换成偏青绿的「青玉」，同时允许用户按喜好换色。
 *
 * 实现：把主色及其中间色写成 CSS 变量（--brand-rgb / --brand-600-rgb / ...），
 * Tailwind 的 brand-* 全部映射到这些变量；切换主题色只需要改这些变量。
 */

export type AccentId = 'jade' | 'moss' | 'plum' | 'rose' | 'clay';

export interface AccentPreset {
  id: AccentId;
  name: string;
  /** 浅色模式下的基准色 */
  hex: string;
  /** 给人看的说明，说明为什么推荐这个色 */
  note: string;
}

/**
 * 推荐色板：都刻意避开了「蓝色系」，防止再次撞上商业产品的主色。
 * 同时避开正红 / 亮橙，因为这两个颜色已经被优先级（高 / 中）占用。
 */
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'jade', name: '青玉', hex: '#0E9F8A', note: '默认。冷静的青绿，长时间看不刺眼' },
  { id: 'moss', name: '苔绿', hex: '#418C5C', note: '自然稳重，和「未完成 / 已完成」对比清晰' },
  { id: 'plum', name: '紫棠', hex: '#7C5CE6', note: '有个性，深色模式下更亮' },
  { id: 'rose', name: '绯桃', hex: '#C2508A', note: '偏柔和的玫红，适合个人使用' },
  { id: 'clay', name: '赭石', hex: '#B06A3F', note: '温暖的土色，接近纸张与墨水' },
];

export const DEFAULT_ACCENT: AccentId = 'jade';

export const DEFAULT_BRAND_HEX = ACCENT_PRESETS[0].hex;

export function accentPreset(id: AccentId): AccentPreset {
  return ACCENT_PRESETS.find((item) => item.id === id) ?? ACCENT_PRESETS[0];
}

export function isAccentId(value: unknown): value is AccentId {
  return ACCENT_PRESETS.some((item) => item.id === value);
}

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '');
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

/** amount 为 b 的占比：0 = 全是 a，1 = 全是 b */
function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount];
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const DARK_PANEL: Rgb = [26, 28, 33];

export interface BrandTokens {
  /** 当前模式下实际使用的主色（十六进制），用于 <meta theme-color> */
  hex: string;
  brand: Rgb;
  brand600: Rgb;
  brand700: Rgb;
  brand100: Rgb;
  brand50: Rgb;
}

/** 同一套色板的明暗两种取值：深色模式下整体提亮，浅色模式下压暗 */
export function brandTokens(id: AccentId, dark: boolean): BrandTokens {
  const base = hexToRgb(accentPreset(id).hex);
  const brand = dark ? mix(base, WHITE, 0.16) : base;
  return {
    hex: toHex(brand),
    brand,
    brand600: mix(brand, BLACK, dark ? 0.08 : 0.1),
    brand700: mix(brand, BLACK, dark ? 0.18 : 0.24),
    // 浅色模式：主色向白色稀释；深色模式：向面板色稀释，避免整块发光
    brand100: dark ? mix(brand, DARK_PANEL, 0.8) : mix(brand, WHITE, 0.9),
    brand50: dark ? mix(brand, DARK_PANEL, 0.9) : mix(brand, WHITE, 0.95),
  };
}

function setVar(root: HTMLElement, name: string, rgb: Rgb): void {
  root.style.setProperty(name, `${Math.round(rgb[0])} ${Math.round(rgb[1])} ${Math.round(rgb[2])}`);
}

/** 把主题色写入 CSS 变量（documentElement），Tailwind 的 brand-* 立即生效 */
export function applyBrand(id: AccentId, dark: boolean): string {
  const tokens = brandTokens(id, dark);
  const root = document.documentElement;
  setVar(root, '--brand-rgb', tokens.brand);
  setVar(root, '--brand-600-rgb', tokens.brand600);
  setVar(root, '--brand-700-rgb', tokens.brand700);
  setVar(root, '--brand-100-rgb', tokens.brand100);
  setVar(root, '--brand-50-rgb', tokens.brand50);
  root.dataset.accent = id;
  return tokens.hex;
}
