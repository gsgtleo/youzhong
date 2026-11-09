import type { CalendarEvent, Channel, NotificationItem, Project, Task, Tag, User } from '@youzhong/shared';
import { newId } from '../lib/security';
import { db, now } from './index';

type Row = Record<string, unknown>;

export function parseStamp(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const ts = new Date(normalized).getTime();
  return Number.isNaN(ts) ? null : ts;
}

/* ------------------------------ users ------------------------------ */

function toUser(row: Row): User {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    role: row.role === 'admin' ? 'admin' : 'member',
    status: row.status === 'disabled' ? 'disabled' : 'active',
    timezone: String(row.timezone ?? 'Asia/Shanghai'),
    createdAt: Number(row.created_at),
    lastLoginAt: row.last_login_at ? Number(row.last_login_at) : undefined,
  };
}

export const users = {
  byUsername(username: string) {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as Row | undefined;
    return row ? { user: toUser(row), passwordHash: String(row.password_hash) } : null;
  },
  byId(id: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined;
    return row ? toUser(row) : null;
  },
  list(): User[] {
    return (db.prepare('SELECT * FROM users ORDER BY created_at').all() as Row[]).map(toUser);
  },
  count(): number {
    return Number((db.prepare('SELECT COUNT(*) AS c FROM users').get() as Row).c);
  },
  create(input: { username: string; displayName: string; passwordHash: string; role?: 'admin' | 'member'; timezone?: string }): User {
    const id = newId();
    db.prepare(
      `INSERT INTO users (id, username, display_name, password_hash, role, status, timezone, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).run(id, input.username, input.displayName, input.passwordHash, input.role ?? 'member', input.timezone ?? 'Asia/Shanghai', now());
    return users.byId(id)!;
  },
  setPassword(id: string, passwordHash: string) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  },
  setStatus(id: string, status: 'active' | 'disabled') {
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
  },
  setTimezone(id: string, timezone: string) {
    db.prepare('UPDATE users SET timezone = ? WHERE id = ?').run(timezone, id);
  },
  touchLogin(id: string) {
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now(), id);
  },
};

/* ----------------------------- sessions ----------------------------- */

export const sessions = {
  create(input: { tokenHash: string; userId: string; expiresAt: number; userAgent?: string }) {
    db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)').run(
      input.tokenHash,
      input.userId,
      now(),
      input.expiresAt,
      input.userAgent ?? null,
    );
  },
  userIdByToken(tokenHash: string): string | null {
    const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(tokenHash) as Row | undefined;
    if (!row) return null;
    if (Number(row.expires_at) < now()) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return null;
    }
    return String(row.user_id);
  },
  remove(tokenHash: string) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  },
  removeAllForUser(userId: string) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  },
};

/* ----------------------------- projects ----------------------------- */

function toProject(row: Row): Project {
  return {
    id: String(row.id),
    name: String(row.name),
    color: String(row.color ?? '#0E9F8A'),
    sortOrder: Number(row.sort_order ?? 0),
    permission: row.permission ? String(row.permission) : undefined,
  };
}

export const projects = {
  list(userId: string): Project[] {
    return (db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY sort_order').all(userId) as Row[]).map(toProject);
  },
  create(userId: string, input: { name: string; color?: string; permission?: string; id?: string }): Project {
    const id = input.id ?? newId();
    const sort = Number((db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM projects WHERE user_id = ?').get(userId) as Row).m) + 10;
    db.prepare('INSERT INTO projects (id, user_id, name, color, sort_order, permission, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id,
      userId,
      input.name,
      input.color ?? '#0E9F8A',
      sort,
      input.permission ?? null,
      now(),
    );
    return toProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Row);
  },
  update(userId: string, id: string, patch: { name?: string; color?: string }) {
    const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, userId) as Row | undefined;
    if (!row) return null;
    db.prepare('UPDATE projects SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(
      patch.name ?? row.name,
      patch.color ?? row.color,
      id,
      userId,
    );
    return toProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Row);
  },
  remove(userId: string, id: string) {
    db.prepare('DELETE FROM tasks WHERE project_id = ? AND user_id = ?').run(id, userId);
    db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(id, userId);
  },
};

/* ------------------------------- tasks ------------------------------ */

function toTask(row: Row): Task {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title),
    content: row.content ? String(row.content) : undefined,
    priority: Number(row.priority) as Task['priority'],
    status: Number(row.status) === 2 ? 2 : 0,
    dueDate: row.due_date ? String(row.due_date) : undefined,
    isAllDay: Boolean(row.is_all_day),
    tags: JSON.parse(String(row.tags ?? '[]')) as string[],
    items: JSON.parse(String(row.items ?? '[]')) as Task['items'],
    reminders: JSON.parse(String(row.reminders ?? '[]')) as Task['reminders'],
    sortOrder: Number(row.sort_order ?? 0),
    repeatFlag: row.repeat_flag ? String(row.repeat_flag) : undefined,
    createdTime: new Date(Number(row.created_at)).toISOString(),
    modifiedTime: new Date(Number(row.modified_at)).toISOString(),
    completedTime: row.completed_at ? new Date(Number(row.completed_at)).toISOString() : undefined,
  };
}

export const tasks = {
  list(userId: string): Task[] {
    return (db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY sort_order').all(userId) as Row[]).map(toTask);
  },
  get(userId: string, id: string): Task | null {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, userId) as Row | undefined;
    return row ? toTask(row) : null;
  },
  upsert(userId: string, task: Task): Task {
    // 兜底默认值：直接调 API 的客户端可能不带 priority / status，避免 NOT NULL 约束报 500
    task = {
      ...task,
      title: task.title ?? '',
      priority: task.priority ?? 0,
      status: task.status === 2 ? 2 : 0,
    };
    const existing = tasks.get(userId, task.id);
    const dueAt = parseStamp(task.dueDate);
    if (existing) {
      db.prepare(
        `UPDATE tasks SET project_id=?, title=?, content=?, priority=?, status=?, due_date=?, due_at=?, is_all_day=?,
         tags=?, items=?, reminders=?, sort_order=?, repeat_flag=?, modified_at=?, completed_at=? WHERE id=? AND user_id=?`,
      ).run(
        task.projectId,
        task.title,
        task.content ?? null,
        task.priority,
        task.status,
        task.dueDate ?? null,
        dueAt,
        task.isAllDay ? 1 : 0,
        JSON.stringify(task.tags ?? []),
        JSON.stringify(task.items ?? []),
        JSON.stringify(task.reminders ?? []),
        task.sortOrder ?? 0,
        task.repeatFlag ?? null,
        now(),
        task.status === 2 ? now() : null,
        task.id,
        userId,
      );
    } else {
      db.prepare(
        `INSERT INTO tasks (id, user_id, project_id, title, content, priority, status, due_date, due_at, is_all_day, tags, items, reminders, sort_order, repeat_flag, created_at, modified_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        task.id,
        userId,
        task.projectId,
        task.title,
        task.content ?? null,
        task.priority,
        task.status,
        task.dueDate ?? null,
        dueAt,
        task.isAllDay ? 1 : 0,
        JSON.stringify(task.tags ?? []),
        JSON.stringify(task.items ?? []),
        JSON.stringify(task.reminders ?? []),
        task.sortOrder ?? 0,
        task.repeatFlag ?? null,
        now(),
        now(),
        task.status === 2 ? now() : null,
      );
    }
    return tasks.get(userId, task.id)!;
  },
  remove(userId: string, id: string) {
    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId);
  },
  dueBetween(userId: string, from: number, to: number): Task[] {
    return (
      db
        .prepare('SELECT * FROM tasks WHERE user_id = ? AND status = 0 AND due_at IS NOT NULL AND due_at BETWEEN ? AND ?')
        .all(userId, from, to) as Row[]
    ).map(toTask);
  },
};

/* ------------------------------ events ------------------------------ */

function toEvent(row: Row): CalendarEvent {
  return {
    id: String(row.id),
    summary: String(row.summary),
    startDate: String(row.start_date),
    endDate: row.end_date ? String(row.end_date) : undefined,
    isAllDay: Boolean(row.is_all_day),
    color: String(row.color ?? '#0E9F8A'),
    description: row.description ? String(row.description) : undefined,
    location: row.location ? String(row.location) : undefined,
  };
}

export const events = {
  list(userId: string): CalendarEvent[] {
    return (db.prepare('SELECT * FROM events WHERE user_id = ? ORDER BY start_at').all(userId) as Row[]).map(toEvent);
  },
  upsert(userId: string, event: CalendarEvent): CalendarEvent {
    const startAt = parseStamp(event.startDate) ?? now();
    const exists = db.prepare('SELECT id FROM events WHERE id = ? AND user_id = ?').get(event.id, userId);
    if (exists) {
      db.prepare(
        'UPDATE events SET summary=?, start_date=?, end_date=?, start_at=?, is_all_day=?, color=?, description=?, location=? WHERE id=? AND user_id=?',
      ).run(
        event.summary,
        event.startDate,
        event.endDate ?? null,
        startAt,
        event.isAllDay ? 1 : 0,
        event.color ?? '#0E9F8A',
        event.description ?? null,
        event.location ?? null,
        event.id,
        userId,
      );
    } else {
      db.prepare(
        'INSERT INTO events (id, user_id, summary, start_date, end_date, start_at, is_all_day, color, description, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        event.id,
        userId,
        event.summary,
        event.startDate,
        event.endDate ?? null,
        startAt,
        event.isAllDay ? 1 : 0,
        event.color ?? '#0E9F8A',
        event.description ?? null,
        event.location ?? null,
        now(),
      );
    }
    return toEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(event.id) as Row);
  },
  remove(userId: string, id: string) {
    db.prepare('DELETE FROM events WHERE id = ? AND user_id = ?').run(id, userId);
  },
};

/* ------------------------------- tags ------------------------------- */

export const tags = {
  list(userId: string): Tag[] {
    return (db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name').all(userId) as Row[]).map((row) => ({
      name: String(row.name),
      label: String(row.name),
      color: row.color ? String(row.color) : undefined,
    }));
  },
  ensure(userId: string, names: string[], color?: string) {
    const stmt = db.prepare('INSERT OR IGNORE INTO tags (user_id, name, color) VALUES (?, ?, ?)');
    names.forEach((name) => stmt.run(userId, name, color ?? null));
  },
};

/* ----------------------------- channels ----------------------------- */

function toChannel(row: Row): Channel {
  return {
    id: String(row.id),
    type: row.type === 'feishu' ? 'feishu' : 'dingtalk',
    name: String(row.name),
    enabled: Boolean(row.enabled),
    events: JSON.parse(String(row.events ?? '[]')),
    lastStatus: row.last_status ? String(row.last_status) : undefined,
    lastError: row.last_error ? String(row.last_error) : undefined,
    lastSentAt: row.last_sent_at ? Number(row.last_sent_at) : undefined,
    createdAt: Number(row.created_at),
  };
}

export const channels = {
  list(userId: string): Channel[] {
    return (db.prepare('SELECT * FROM channels WHERE user_id = ? ORDER BY created_at').all(userId) as Row[]).map(toChannel);
  },
  raw(userId: string, id: string): Row | null {
    return (db.prepare('SELECT * FROM channels WHERE id = ? AND user_id = ?').get(id, userId) as Row) ?? null;
  },
  create(userId: string, input: { type: string; name: string; webhook: string; secret?: string; events?: string[]; enabled?: boolean }): Channel {
    const id = newId();
    db.prepare(
      'INSERT INTO channels (id, user_id, type, name, webhook, secret, events, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      userId,
      input.type,
      input.name,
      input.webhook,
      input.secret ?? null,
      JSON.stringify(input.events ?? ['due']),
      input.enabled === false ? 0 : 1,
      now(),
    );
    return toChannel(db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as Row);
  },
  update(userId: string, id: string, patch: Record<string, unknown>) {
    const row = channels.raw(userId, id);
    if (!row) return null;
    db.prepare('UPDATE channels SET type=?, name=?, webhook=?, secret=?, events=?, enabled=? WHERE id=? AND user_id=?').run(
      (patch.type as string) ?? row.type,
      (patch.name as string) ?? row.name,
      (patch.webhook as string) ?? row.webhook,
      patch.secret === undefined ? row.secret : (patch.secret as string),
      patch.events ? JSON.stringify(patch.events) : row.events,
      patch.enabled === undefined ? row.enabled : patch.enabled ? 1 : 0,
      id,
      userId,
    );
    return toChannel(db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as Row);
  },
  markResult(id: string, ok: boolean, error?: string) {
    db.prepare('UPDATE channels SET last_status=?, last_error=?, last_sent_at=? WHERE id=?').run(
      ok ? 'ok' : 'failed',
      ok ? null : (error ?? 'unknown'),
      now(),
      id,
    );
  },
  remove(userId: string, id: string) {
    db.prepare('DELETE FROM channels WHERE id = ? AND user_id = ?').run(id, userId);
  },
  enabledWithEvent(userId: string, kind: string): { id: string; type: string; webhook: string; secret: string | null }[] {
    return (db.prepare('SELECT * FROM channels WHERE user_id = ? AND enabled = 1').all(userId) as Row[])
      .filter((row) => (JSON.parse(String(row.events ?? '[]')) as string[]).includes(kind))
      .map((row) => ({
        id: String(row.id),
        type: String(row.type),
        webhook: String(row.webhook),
        secret: row.secret ? String(row.secret) : null,
      }));
  },
};

/* --------------------------- notifications -------------------------- */

function toNotification(row: Row): NotificationItem {
  return {
    id: String(row.id),
    kind: String(row.kind),
    title: String(row.title),
    body: row.body ? String(row.body) : undefined,
    taskId: row.task_id ? String(row.task_id) : undefined,
    createdAt: Number(row.created_at),
    read: Boolean(row.read_at),
  };
}

export const notifications = {
  insert(userId: string, input: { taskId?: string; kind: string; bucket: string; title: string; body?: string }): boolean {
    const existing = db
      .prepare('SELECT id FROM notifications WHERE user_id = ? AND task_id IS ? AND kind = ? AND bucket = ?')
      .get(userId, input.taskId ?? null, input.kind, input.bucket);
    if (existing) return false;
    db.prepare('INSERT INTO notifications (id, user_id, task_id, kind, bucket, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      newId(),
      userId,
      input.taskId ?? null,
      input.kind,
      input.bucket,
      input.title,
      input.body ?? null,
      now(),
    );
    return true;
  },
  list(userId: string, since?: number): NotificationItem[] {
    const rows = since
      ? (db.prepare('SELECT * FROM notifications WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 50').all(userId, since) as Row[])
      : (db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(userId) as Row[]);
    return rows.map(toNotification);
  },
  markAllRead(userId: string) {
    db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now(), userId);
  },
};

/* ----------------------------- settings ----------------------------- */

export const settings = {
  get(userId: string): Record<string, unknown> {
    const row = db.prepare('SELECT data FROM settings WHERE user_id = ?').get(userId) as Row | undefined;
    return row ? (JSON.parse(String(row.data)) as Record<string, unknown>) : {};
  },
  save(userId: string, data: Record<string, unknown>) {
    db.prepare('INSERT INTO settings (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data').run(
      userId,
      JSON.stringify(data),
    );
  },
};
