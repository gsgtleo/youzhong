import { Router } from 'express';
import type { AuthSession } from '@youzhong/shared';
import { sessions, users } from '../db/repositories';
import { handle } from '../lib/errors';
import { hashPassword, randomToken, sha256, verifyPassword } from '../lib/security';
import { clearLoginAttempts, loginRateLimit, requireAuth, tokenFromRequest } from '../middleware/auth';

export const authRouter = Router();

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
const COOKIE = 'youzhong_session';

function setCookie(req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1], token: string): void {
  // 只有真正走 HTTPS 时才加 Secure：反代后面常是 http（内网 / IP 直连），
  // 用 TRUST_PROXY 判断会把 Cookie 标成 Secure，浏览器直接丢弃
  const forwarded = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  const secure = req.secure || forwarded === 'https';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL / 1000)}${secure ? '; Secure' : ''}`,
  );
}

authRouter.post(
  '/login',
  loginRateLimit,
  handle(async (req, res) => {
    const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: { code: 'bad_request', message: '请输入用户名和密码', retryable: false } });
      return;
    }
    const found = users.byUsername(username.trim().toLowerCase());
    if (!found || !verifyPassword(password, found.passwordHash)) {
      res.status(401).json({ error: { code: 'invalid_credentials', message: '用户名或密码不正确', retryable: false } });
      return;
    }
    if (found.user.status !== 'active') {
      res.status(403).json({ error: { code: 'account_disabled', message: '账号已被停用，请联系管理员', retryable: false } });
      return;
    }

    clearLoginAttempts(req);
    const token = randomToken();
    const expiresAt = Date.now() + SESSION_TTL;
    sessions.create({ tokenHash: sha256(token), userId: found.user.id, expiresAt, userAgent: req.headers['user-agent'] });
    users.touchLogin(found.user.id);
    setCookie(req, res, token);

    const payload: AuthSession = { user: found.user, token, expiresAt };
    res.json(payload);
  }),
);

authRouter.post('/logout', (req, res) => {
  const token = tokenFromRequest(req);
  if (token) sessions.remove(sha256(token));
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post(
  '/password',
  requireAuth,
  handle(async (req, res) => {
    const { currentPassword, newPassword } = (req.body ?? {}) as { currentPassword?: string; newPassword?: string };
    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: { code: 'weak_password', message: '新密码至少 8 位', retryable: false } });
      return;
    }
    const found = users.byUsername(req.user!.username);
    if (!found || !verifyPassword(currentPassword ?? '', found.passwordHash)) {
      res.status(400).json({ error: { code: 'invalid_credentials', message: '当前密码不正确', retryable: false } });
      return;
    }
    users.setPassword(req.user!.id, hashPassword(newPassword));
    res.json({ ok: true });
  }),
);
