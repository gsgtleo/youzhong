import { Router } from 'express';
import type { Response } from 'express';
import { sessions, users } from './db/repositories';
import { sha256 } from './lib/security';

/**
 * 服务端实时通道（SSE）：
 * - 数据变更 → 广播 snapshot-changed，客户端静默刷新
 * - 通知生成 → 广播 notification，客户端直接弹通知（时间以服务器为准）
 */

interface Client {
  id: number;
  res: Response;
}

const clients = new Map<string, Set<Client>>();
let seq = 0;

export function broadcast(userId: string, event: string, data: unknown): void {
  const set = clients.get(userId);
  if (!set?.size) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  set.forEach((client) => {
    try {
      client.res.write(payload);
    } catch {
      set.delete(client);
    }
  });
}

export function connectionCount(): number {
  let total = 0;
  clients.forEach((set) => {
    total += set.size;
  });
  return total;
}

export const streamRouter = Router();

streamRouter.get('/stream', (req, res) => {
  // EventSource 无法自定义请求头，因此允许用 ?token= 传递（只用于本端点）
  const token = String(req.query.token ?? '');
  const userId = token ? sessions.userIdByToken(sha256(token)) : null;
  const user = userId ? users.byId(userId) : null;
  if (!userId || !user || user.status !== 'active') {
    res.status(401).json({ error: { code: 'not_authenticated', message: '请先登录', retryable: false } });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // 关闭 nginx 缓冲，保证实时
  });
  res.write(`event: ready\ndata: {"serverTime":"${new Date().toISOString()}"}\n\n`);

  const client: Client = { id: (seq += 1), res };
  const set = clients.get(userId) ?? new Set<Client>();
  set.add(client);
  clients.set(userId, set);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  const cleanup = () => {
    clearInterval(heartbeat);
    const current = clients.get(userId);
    current?.delete(client);
    if (current && current.size === 0) clients.delete(userId);
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('error', cleanup);
});
