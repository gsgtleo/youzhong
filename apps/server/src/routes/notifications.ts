import { Router } from 'express';
import { notifications } from '../db/repositories';
import { requireAuth } from '../middleware/auth';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

/** 安卓 WorkManager 轮询：since 为上次拉取时间戳 */
notificationsRouter.get('/notifications', (req, res) => {
  const since = Number(req.query.since ?? 0) || undefined;
  const items = notifications.list(req.user!.id, since);
  res.json({ notifications: items, unread: items.filter((item) => !item.read).length });
});

notificationsRouter.post('/notifications/read', (req, res) => {
  notifications.markAllRead(req.user!.id);
  res.json({ ok: true });
});
