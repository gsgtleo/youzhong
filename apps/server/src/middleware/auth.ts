import type { NextFunction, Request, Response } from 'express';
import type { User } from '@youzhong/shared';
import { sessions, users } from '../db/repositories';
import { sha256 } from '../lib/security';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      sessionHash?: string;
    }
  }
}

export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const cookie = req.headers.cookie ?? '';
  const match = cookie.match(/(?:^|;\s*)youzhong_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = tokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: { code: 'not_authenticated', message: '请先登录', retryable: false } });
    return;
  }
  const hash = sha256(token);
  const userId = sessions.userIdByToken(hash);
  if (!userId) {
    res.status(401).json({ error: { code: 'not_authenticated', message: '登录已过期，请重新登录', retryable: false } });
    return;
  }
  const user = users.byId(userId);
  if (!user || user.status !== 'active') {
    res.status(403).json({ error: { code: 'account_disabled', message: '账号已被停用', retryable: false } });
    return;
  }
  req.user = user;
  req.sessionHash = hash;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: { code: 'forbidden', message: '需要管理员权限', retryable: false } });
    return;
  }
  next();
}

/** 登录限流：同 IP + 用户名 5 次/分钟，内存滑窗 */
const attempts = new Map<string, number[]>();

export function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const username = String((req.body as { username?: string })?.username ?? '').toLowerCase();
  const key = `${req.ip}|${username}`;
  const windowMs = 60_000;
  const current = (attempts.get(key) ?? []).filter((ts) => Date.now() - ts < windowMs);
  if (current.length >= 5) {
    res.status(429).json({ error: { code: 'too_many_attempts', message: '尝试过于频繁，请 1 分钟后再试', retryable: true } });
    return;
  }
  current.push(Date.now());
  attempts.set(key, current);
  next();
}

export function clearLoginAttempts(req: Request): void {
  const username = String((req.body as { username?: string })?.username ?? '').toLowerCase();
  attempts.delete(`${req.ip}|${username}`);
}
