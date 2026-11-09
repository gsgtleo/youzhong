import { Router } from 'express';
import { users } from '../db/repositories';
import { badRequest, handle } from '../lib/errors';
import { hashPassword } from '../lib/security';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { seedUserData } from '../services/bootstrap';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const MAX_USERS = Number(process.env.MAX_USERS ?? 10);

adminRouter.get('/admin/users', (_req, res) => {
  res.json({ users: users.list(), limit: MAX_USERS });
});

adminRouter.post(
  '/admin/users',
  handle(async (req, res) => {
    const { username, displayName, password, role } = (req.body ?? {}) as Record<string, string | undefined>;
    if (!username?.trim() || username.trim().length < 3) throw badRequest('用户名至少 3 位');
    if (!password || password.length < 8) throw badRequest('初始密码至少 8 位');
    if (users.count() >= MAX_USERS) throw badRequest(`已达用户上限（${MAX_USERS} 人）`);
    if (users.byUsername(username.trim().toLowerCase())) throw badRequest('用户名已存在');

    const user = users.create({
      username: username.trim().toLowerCase(),
      displayName: displayName?.trim() || username.trim(),
      passwordHash: hashPassword(password),
      role: role === 'admin' ? 'admin' : 'member',
    });
    seedUserData(user.id, user.displayName);
    res.status(201).json({ user });
  }),
);

adminRouter.post(
  '/admin/users/:id/password',
  handle(async (req, res) => {
    const { password } = (req.body ?? {}) as { password?: string };
    if (!password || password.length < 8) throw badRequest('密码至少 8 位');
    if (!users.byId(req.params.id)) throw badRequest('用户不存在');
    users.setPassword(req.params.id, hashPassword(password));
    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/admin/users/:id/status',
  handle(async (req, res) => {
    const { status } = (req.body ?? {}) as { status?: string };
    if (status !== 'active' && status !== 'disabled') throw badRequest('状态不合法');
    if (req.params.id === req.user!.id) throw badRequest('不能停用自己的账号');
    users.setStatus(req.params.id, status);
    res.json({ ok: true });
  }),
);
