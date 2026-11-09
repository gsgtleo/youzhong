import './lib/env'; // 必须最先执行：读取 .env，供后续模块初始化使用
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { dbFile } from './db';
import { errorHandler } from './lib/errors';
import { adminRouter } from './routes/admin';
import { apkRouter } from './routes/apk';
import { connectionCount, streamRouter } from './events';
import { authRouter } from './routes/auth';
import { backupRouter } from './routes/backup';
import { channelsRouter } from './routes/channels';
import { dataRouter } from './routes/data';
import { notificationsRouter } from './routes/notifications';
import { APP_VERSION, pingRouter } from './routes/ping';
import { settingsRouter } from './routes/settings';
import { writeRouter } from './routes/write';
import { ensureAdmin } from './services/bootstrap';
import { startScheduler } from './notify/dispatcher';

const app = express();
const PORT = Number(process.env.PORT ?? 10078);
const HOST = process.env.HOST ?? '0.0.0.0';

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true');
// 备份恢复要接收全量 JSON（几千条任务约几 MB），普通写接口仍然很小
app.use(express.json({ limit: '25mb' }));

/**
 * 反向代理子路径支持：nginx 把 /youzhong 转发到本服务时，无论是否改写前缀都能工作。
 * 例如 https://host:19993/youzhong/api/ping → 内部按 /api/ping 处理。
 */
const URL_PREFIX = (process.env.URL_PREFIX ?? '').replace(/\/$/, '');
app.use((req, _res, next) => {
  if (URL_PREFIX && (req.url === URL_PREFIX || req.url.startsWith(`${URL_PREFIX}/`))) {
    req.url = req.url.slice(URL_PREFIX.length) || '/';
  }
  next();
});

// 允许网页端改服务器地址直连：同源 + localhost + 显式配置的来源
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);
  const isLocal = origin ? /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin) : false;
  if (origin && (isLocal || allowed.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) console.log(`[api] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
});

app.use('/api', pingRouter);
app.use('/api/health', (_req, res) => {
  res.json({ ok: true, version: APP_VERSION, db: dbFile(), host: HOST, port: PORT, streams: connectionCount() });
});
app.use('/api', streamRouter);
app.use('/api/auth', authRouter);
app.use('/api', dataRouter);
app.use('/api', writeRouter);
app.use('/api', settingsRouter);
app.use('/api', backupRouter);
app.use('/api', channelsRouter);
app.use('/api', notificationsRouter);
app.use('/api', adminRouter);

// 安卓安装包下载页：/apk （子路径部署下即 /youzhong/apk）
app.use(apkRouter);

const distDir = resolve(process.cwd(), '../web/dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(resolve(distDir, 'index.html'));
  });
}

app.use(errorHandler);

ensureAdmin();
startScheduler();

app.listen(PORT, HOST, () => {
  console.log(`[server] API 已启动 http://${HOST}:${PORT}（v${APP_VERSION}）`);
  if (!process.env.APP_SECRET) console.warn('[server] 未设置 APP_SECRET，渠道密钥使用开发默认密钥，请勿用于生产');
});
