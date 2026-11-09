import { Router } from 'express';
import type { Snapshot } from '@youzhong/shared';
import { events, projects, tags, tasks } from '../db/repositories';
import { requireAuth } from '../middleware/auth';

export const dataRouter = Router();

/** 全量快照：一次请求拿齐首屏所需数据（均按会话用户隔离） */
dataRouter.get('/snapshot', requireAuth, (req, res) => {
  const userId = req.user!.id;
  const payload: Snapshot = {
    projects: projects.list(userId),
    projectGroups: [],
    tags: tags.list(userId),
    tasks: tasks.list(userId),
    events: events.list(userId),
    serverTime: new Date().toISOString(),
    mode: 'server',
  };
  res.json(payload);
});
