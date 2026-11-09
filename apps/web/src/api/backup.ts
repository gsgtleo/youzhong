import type { CalendarEvent, Project, Tag, Task } from '@youzhong/shared';
import { request } from './http';

export interface BackupBundle {
  format: string;
  version: number;
  exportedAt: string;
  user?: { username: string; displayName: string; timezone: string };
  settings: Record<string, unknown>;
  projects: Project[];
  tags: Tag[];
  tasks: Task[];
  events: CalendarEvent[];
}

export interface WebdavConfig {
  url: string;
  username: string;
  password: string;
  dir: string;
}

export interface WebdavFile {
  name: string;
  size: number;
  modifiedAt?: string;
}

export interface WebdavResult {
  ok: boolean;
  message?: string;
  dir?: string;
  file?: string;
  size?: number;
  files?: WebdavFile[];
  data?: BackupBundle;
}

export interface RestoreResult {
  mode: 'merge' | 'replace';
  projects: number;
  tasks: number;
  events: number;
  total: { tasks: number; projects: number; events: number };
}

export type WebdavAction = 'test' | 'upload' | 'list' | 'download' | 'delete';

const CONFIG_KEY = 'youzhong-webdav';

export const EMPTY_WEBDAV: WebdavConfig = { url: '', username: '', password: '', dir: 'youzhong-backup' };

/** WebDAV 配置只存在本机浏览器：换服务器后仍是同一份配置，便于直接恢复 */
export function loadWebdavConfig(): WebdavConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return EMPTY_WEBDAV;
    const parsed = JSON.parse(raw) as Partial<WebdavConfig>;
    return {
      url: String(parsed.url ?? ''),
      username: String(parsed.username ?? ''),
      password: String(parsed.password ?? ''),
      dir: String(parsed.dir ?? 'youzhong-backup') || 'youzhong-backup',
    };
  } catch {
    return EMPTY_WEBDAV;
  }
}

export function saveWebdavConfig(config: WebdavConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // 隐私模式下可能写不进去，忽略即可
  }
}

export const backupApi = {
  export: () => request<BackupBundle>('/backup/export', {}, { timeoutMs: 60_000 }),

  restore: (data: BackupBundle, mode: 'merge' | 'replace') =>
    request<RestoreResult>('/backup/restore', { method: 'POST', body: JSON.stringify({ data, mode }) }, { timeoutMs: 120_000 }),

  webdav: (action: WebdavAction, config: WebdavConfig, file?: string) =>
    request<WebdavResult>(
      '/backup/webdav',
      { method: 'POST', body: JSON.stringify({ action, config, file }) },
      { timeoutMs: 90_000 },
    ),
};
