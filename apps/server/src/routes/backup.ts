import { Router } from 'express';
import type { CalendarEvent, Project, Reminder, Subtask, Tag, Task, User } from '@youzhong/shared';
import { db } from '../db';
import { events, projects, settings, tags, tasks } from '../db/repositories';
import { broadcast } from '../events';
import { ApiError, badRequest, handle } from '../lib/errors';
import { newId } from '../lib/security';
import { requireAuth } from '../middleware/auth';

/**
 * 数据备份 / 恢复 + WebDAV 云备份
 *
 * 目标：换服务器（或换部署机器）后，登录新服务器能把清单、任务、日程、标签、设置整套恢复回来。
 * WebDAV 请求由服务端发出，原因是浏览器直连 WebDAV 会被 CORS 拦住，
 * 而自建服务器通常能直接访问 NAS / 坚果云 / Nextcloud 等地址。
 * 账号密码只随单次请求传输，不落库（客户端保存在本机 localStorage）。
 */

export const backupRouter = Router();
backupRouter.use(requireAuth);

const BACKUP_FORMAT = 'youzhong-backup';
const BACKUP_VERSION = 1;
const DAV_TIMEOUT = 20_000;

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

function buildBundle(user: User): BackupBundle {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    user: { username: user.username, displayName: user.displayName, timezone: user.timezone },
    settings: settings.get(user.id),
    projects: projects.list(user.id),
    tags: tags.list(user.id),
    tasks: tasks.list(user.id),
    events: events.list(user.id),
  };
}

function arr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function priorityOf(value: unknown): Task['priority'] {
  const num = Number(value);
  return num === 5 || num === 3 || num === 1 ? num : 0;
}

/* ------------------------------ 导出 ------------------------------ */

backupRouter.get('/backup/export', (req, res) => {
  res.json(buildBundle(req.user!));
});

/* ------------------------------ 恢复 ------------------------------ */

backupRouter.post(
  '/backup/restore',
  handle(async (req, res) => {
    const userId = req.user!.id;
    const body = (req.body ?? {}) as { data?: BackupBundle; mode?: string };
    const data = body.data;
    if (!data || typeof data !== 'object') throw badRequest('缺少备份数据');
    if (data.format !== BACKUP_FORMAT) throw badRequest('备份格式不正确（缺少 format=youzhong-backup）');

    const mode = body.mode === 'replace' ? 'replace' : 'merge';

    // 清单 id → 新服务器上的 id（备份里的 id 可能与目标服务器已有数据冲突，统一重新分配）
    const existingInbox = projects.list(userId).find((project) => project.permission === 'inbox');
    if (mode === 'replace') {
      db.prepare('DELETE FROM tasks WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM events WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM projects WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM tags WHERE user_id = ?').run(userId);
    }
    const inbox = existingInbox && mode !== 'replace' ? existingInbox : projects.create(userId, { name: '笔记本', permission: 'inbox' });

    const projectMap = new Map<string, string>();
    let projectCount = 0;
    arr<Project>(data.projects).forEach((project) => {
      const name = text(project.name).trim();
      const oldId = text(project.id);
      if (!name) return;
      if (project.permission === 'inbox') {
        projectMap.set(oldId, inbox.id);
        return;
      }
      // merge 模式下同名清单直接复用，避免重复导入后出现「工作 / 工作(1)」
      const sameName = projects.list(userId).find((item) => item.name === name);
      if (mode === 'merge' && sameName) {
        projectMap.set(oldId, sameName.id);
        return;
      }
      const created = projects.create(userId, {
        name,
        color: text(project.color) || undefined,
        permission: text(project.permission) || undefined,
      });
      projectMap.set(oldId, created.id);
      projectCount += 1;
    });

    let taskCount = 0;
    arr<Task>(data.tasks).forEach((task) => {
      const title = text(task.title).trim();
      if (!title) return;
      const projectId = projectMap.get(text(task.projectId)) ?? inbox.id;
      tasks.upsert(userId, {
        ...task,
        id: newId(),
        projectId,
        title,
        priority: priorityOf(task.priority),
        status: Number(task.status) === 2 ? 2 : 0,
        dueDate: task.dueDate || undefined,
        content: task.content || undefined,
        isAllDay: Boolean(task.isAllDay),
        tags: arr<string>(task.tags).filter((tag) => typeof tag === 'string'),
        items: arr<Subtask>(task.items).map((item, index) => ({
          id: text(item.id) || `sub_${index}`,
          title: text(item.title),
          status: Number(item.status) === 2 ? 2 : 0,
          sortOrder: Number(item.sortOrder ?? index),
        })),
        reminders: arr<Reminder>(task.reminders).filter((item) => Boolean(item?.trigger)),
        sortOrder: Number(task.sortOrder ?? 0),
        repeatFlag: task.repeatFlag || undefined,
        createdTime: task.createdTime,
        modifiedTime: task.modifiedTime,
        completedTime: task.completedTime,
      });
      taskCount += 1;
    });

    let eventCount = 0;
    arr<CalendarEvent>(data.events).forEach((event) => {
      const summary = text(event.summary).trim();
      const startDate = text(event.startDate);
      if (!summary || !startDate) return;
      events.upsert(userId, {
        ...event,
        id: newId(),
        summary,
        startDate,
        endDate: event.endDate || undefined,
        isAllDay: Boolean(event.isAllDay),
        color: text(event.color) || undefined,
        description: event.description || undefined,
        location: event.location || undefined,
      });
      eventCount += 1;
    });

    const tagNames = arr<Tag>(data.tags)
      .filter((tag) => text(tag.name).trim())
      .map((tag) => ({ name: text(tag.name).trim(), color: text(tag.color) || undefined }));
    if (tagNames.length) {
      tagNames.forEach((tag) => tags.ensure(userId, [tag.name], tag.color));
    }
    // 任务里出现但标签表没记录的标签也补上，界面上不会出现「无主标签」
    arr<Task>(data.tasks).forEach((task) => {
      const names = arr<string>(task.tags).filter((tag) => typeof tag === 'string' && tag.trim());
      if (names.length) tags.ensure(userId, names);
    });

    if (data.settings && typeof data.settings === 'object') {
      const current = settings.get(userId);
      settings.save(userId, mode === 'replace' ? { ...data.settings } : { ...current, ...data.settings });
    }

    broadcast(userId, 'snapshot-changed', { path: '/backup/restore' });
    console.log(`[backup] 恢复完成 mode=${mode} 清单${projectCount} 任务${taskCount} 日程${eventCount}`);

    res.json({
      mode,
      projects: projectCount,
      tasks: taskCount,
      events: eventCount,
      total: { tasks: tasks.list(userId).length, projects: projects.list(userId).length, events: events.list(userId).length },
    });
  }),
);

/* ------------------------------ WebDAV ------------------------------ */

interface DavConfig {
  url: string;
  username: string;
  password: string;
  dir: string;
}

function davConfig(input: Partial<DavConfig> | undefined): DavConfig {
  const url = text(input?.url).trim();
  if (!/^https?:\/\//i.test(url)) throw badRequest('WebDAV 地址需要以 http:// 或 https:// 开头');
  return {
    url: url.replace(/\/+$/, ''),
    username: text(input?.username).trim(),
    password: text(input?.password),
    dir: text(input?.dir).trim() || 'youzhong-backup',
  };
}

function davHeaders(config: DavConfig, extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (config.username || config.password) {
    headers.Authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  }
  return headers;
}

function davUrl(config: DavConfig): string {
  const segments = config.dir
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  return [config.url, ...segments.map((segment) => encodeURIComponent(segment))].join('/');
}

async function davFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(DAV_TIMEOUT) });
  } catch (error) {
    const aborted = (error as Error).name === 'TimeoutError' || (error as Error).name === 'AbortError';
    throw new ApiError(
      aborted ? '连接 WebDAV 超时（服务器可能无法访问该地址）' : `无法连接 WebDAV：${(error as Error).message}`,
      { status: 502, code: 'webdav_unreachable', retryable: true },
    );
  }
}

function davFailure(status: number, fallback: string): ApiError {
  if (status === 401) return new ApiError('WebDAV 认证失败，请检查账号或应用密码', { status: 400, code: 'webdav_auth' });
  if (status === 403) return new ApiError('WebDAV 拒绝访问，请检查目录权限', { status: 400, code: 'webdav_forbidden' });
  if (status === 404) return new ApiError('WebDAV 路径不存在，请检查地址或目录', { status: 400, code: 'webdav_not_found' });
  if (status === 507) return new ApiError('WebDAV 空间不足，无法写入备份', { status: 400, code: 'webdav_quota' });
  return new ApiError(`${fallback}（HTTP ${status}）`, { status: 400, code: 'webdav_failed' });
}

/** 逐级创建目录：已存在返回 405，不算失败 */
async function ensureDir(config: DavConfig): Promise<string> {
  const root = config.url;
  let current = root;
  for (const segment of config.dir.split('/').map((item) => item.trim()).filter(Boolean)) {
    current = `${current}/${encodeURIComponent(segment)}`;
    const response = await davFetch(current, { method: 'MKCOL', headers: davHeaders(config) });
    if ([200, 201, 204, 405].includes(response.status)) continue;
    if (response.status === 401 || response.status === 403) throw davFailure(response.status, '创建目录失败');
    // 409/404：上级目录还没建好，继续往下试，最终由 PUT 报错
  }
  return davUrl(config);
}

interface DavFile {
  name: string;
  size: number;
  modifiedAt?: string;
}

function parseList(xml: string, dirUrl: string): DavFile[] {
  const blocks = xml.match(/<(?:[\w-]+:)?response\b[\s\S]*?<\/(?:[\w-]+:)?response>/gi) ?? [];
  const dirPath = decodeURIComponent(new URL(dirUrl).pathname).replace(/\/+$/, '');
  const files: DavFile[] = [];
  for (const block of blocks) {
    const href = /<(?:[\w-]+:)?href>([\s\S]*?)<\/(?:[\w-]+:)?href>/i.exec(block)?.[1]?.trim() ?? '';
    if (!href) continue;
    const size = Number(/<(?:[\w-]+:)?getcontentlength>(\d+)</i.exec(block)?.[1] ?? 0);
    const modified = /<(?:[\w-]+:)?getlastmodified>([^<]+)</i.exec(block)?.[1]?.trim();
    let decoded = href.replace(/^https?:\/\/[^/]+/i, '');
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // href 里出现非法百分号编码时保持原样
    }
    const normalized = decoded.replace(/\/+$/, '');
    const name = normalized.slice(normalized.lastIndexOf('/') + 1);
    // 目录本身会出现在列表里，跳过
    if (!name || normalized === dirPath) continue;
    if (!name.toLowerCase().includes('.json')) continue;
    files.push({ name, size, modifiedAt: modified ? new Date(modified).toISOString() : undefined });
  }
  return files.sort((a, b) => (b.modifiedAt ?? '').localeCompare(a.modifiedAt ?? ''));
}

/** 只去掉路径分隔符与非法字符，保留中文等 Unicode 文件名 */
function safeFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\.{2,}/g, '.')
    .trim()
    .slice(0, 120);
}

function stampName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(
    now.getSeconds(),
  )}`;
}

backupRouter.post(
  '/backup/webdav',
  handle(async (req, res) => {
    const body = (req.body ?? {}) as { action?: string; config?: Partial<DavConfig>; file?: string };
    const action = text(body.action) || 'test';
    const config = davConfig(body.config);

    if (action === 'test') {
      const dirUrl = davUrl(config);
      const response = await davFetch(dirUrl, {
        method: 'PROPFIND',
        headers: davHeaders(config, { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' }),
        body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
      });
      if (response.status === 404) {
        const created = await ensureDir(config);
        res.json({ ok: true, message: '目录已创建，可以开始备份', dir: created });
        return;
      }
      if (response.status !== 207 && !response.ok) throw davFailure(response.status, 'WebDAV 连接失败');
      res.json({ ok: true, message: 'WebDAV 连接正常', dir: dirUrl });
      return;
    }

    if (action === 'upload') {
      const dirUrl = await ensureDir(config);
      const name = safeFileName(text(body.file) || `youzhong-${req.user!.username}-${stampName()}.json`);
      const target = `${dirUrl}/${encodeURIComponent(name)}`;
      const payload = JSON.stringify(buildBundle(req.user!));
      const response = await davFetch(target, {
        method: 'PUT',
        headers: davHeaders(config, { 'Content-Type': 'application/json; charset=utf-8' }),
        body: payload,
      });
      if (![200, 201, 204].includes(response.status)) throw davFailure(response.status, '上传备份失败');
      res.json({ ok: true, file: name, size: Buffer.byteLength(payload), dir: dirUrl });
      return;
    }

    if (action === 'list') {
      const dirUrl = davUrl(config);
      const response = await davFetch(dirUrl, {
        method: 'PROPFIND',
        headers: davHeaders(config, { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' }),
        body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>',
      });
      if (response.status === 404) {
        res.json({ ok: true, dir: dirUrl, files: [] });
        return;
      }
      if (response.status !== 207 && !response.ok) throw davFailure(response.status, '读取备份列表失败');
      res.json({ ok: true, dir: dirUrl, files: parseList(await response.text(), dirUrl) });
      return;
    }

    if (action === 'download') {
      const name = safeFileName(text(body.file));
      if (!name) throw badRequest('请指定要恢复的备份文件');
      const target = `${davUrl(config)}/${encodeURIComponent(name)}`;
      const response = await davFetch(target, { method: 'GET', headers: davHeaders(config) });
      if (!response.ok) throw davFailure(response.status, '下载备份失败');
      const raw = await response.text();
      let parsed: BackupBundle;
      try {
        parsed = JSON.parse(raw) as BackupBundle;
      } catch {
        throw badRequest('备份文件不是合法的 JSON');
      }
      if (parsed?.format !== BACKUP_FORMAT) throw badRequest('该文件不是有终的备份文件');
      res.json({ ok: true, file: name, data: parsed });
      return;
    }

    if (action === 'delete') {
      const name = safeFileName(text(body.file));
      if (!name) throw badRequest('请指定要删除的备份文件');
      const target = `${davUrl(config)}/${encodeURIComponent(name)}`;
      const response = await davFetch(target, { method: 'DELETE', headers: davHeaders(config) });
      if (![200, 202, 204].includes(response.status)) throw davFailure(response.status, '删除备份失败');
      res.json({ ok: true, file: name });
      return;
    }

    throw badRequest(`不支持的 WebDAV 操作：${action}`);
  }),
);
