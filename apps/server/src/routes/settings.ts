import { Router } from 'express';
import { users, settings } from '../db/repositories';
import { requireAuth } from '../middleware/auth';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get('/settings', (req, res) => {
  res.json({ settings: settings.get(req.user!.id), user: req.user });
});

settingsRouter.put('/settings', (req, res) => {
  const data = (req.body ?? {}) as Record<string, unknown>;
  const current = settings.get(req.user!.id);
  const merged = { ...current, ...data };
  settings.save(req.user!.id, merged);
  if (typeof data.timezone === 'string') users.setTimezone(req.user!.id, data.timezone);
  res.json({ settings: merged });
});
