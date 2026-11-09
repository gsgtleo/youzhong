/**
 * 版本号形如 `1.0.202611081807`（主次版本 + 构建时刻 YYYYMMDDHHmm）。
 * 界面上拆成「1.0 · 2026-11-07 09:29」，比一整串数字好读。
 */
export function formatVersion(value?: string | null): string {
  if (!value) return '—';
  const match = /^(\d+\.\d+)\.(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const [, base, year, month, day, hour, minute] = match;
  return `${base} · ${year}-${month}-${day} ${hour}:${minute}`;
}
