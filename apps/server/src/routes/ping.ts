import { Router } from 'express';
import type { PingResult } from '@youzhong/shared';
import { users } from '../db/repositories';
import { latestApk, latestDesktop } from './apk';

export const API_VERSION = 3;
export const APP_VERSION = process.env.APP_VERSION ?? '1.0.202611081807';

export const pingRouter = Router();

/** 免鉴权连通性探测：两端「测试连接」共用 */
pingRouter.get('/ping', (_req, res) => {
  const payload: PingResult = {
    ok: true,
    name: process.env.SERVER_NAME ?? '有终 · 家庭服务器',
    version: APP_VERSION,
    apiVersion: API_VERSION,
    serverTime: new Date().toISOString(),
    requiresAuth: true,
    features: ['tasks', 'calendar', 'quadrant', 'notifications', 'channels', 'backup'],
  };
  res.json({ ...payload, userCount: users.count() });
});

/** 版本信息（免鉴权）：网页/安卓设置页用来对比「当前版本 / 服务器版本 / 最新安装包」 */
pingRouter.get('/version', (_req, res) => {
  res.json({
    server: APP_VERSION,
    apiVersion: API_VERSION,
    build: process.env.BUILD_ID ?? null,
    apk: latestApk(),
    desktop: latestDesktop(),
    serverTime: new Date().toISOString(),
  });
});
