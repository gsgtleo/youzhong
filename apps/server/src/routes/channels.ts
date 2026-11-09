import { Router } from 'express';
import type { Channel, ChannelEvent } from '@youzhong/shared';
import { channels } from '../db/repositories';
import { badRequest, handle } from '../lib/errors';
import { decryptSecret, encryptSecret, mask } from '../lib/security';
import { requireAuth } from '../middleware/auth';
import { sendByType } from '../notify/providers';

export const channelsRouter = Router();
channelsRouter.use(requireAuth);

const EVENTS: ChannelEvent[] = ['due', 'daily', 'completed'];

function shape(channel: Channel): Channel {
  const raw = channel;
  return { ...raw, webhook: raw.webhook ? mask(raw.webhook, 8, 6) : undefined, secret: raw.secret ? '••••••' : undefined };
}

channelsRouter.get('/channels', (req, res) => {
  res.json({ channels: channels.list(req.user!.id).map(shape) });
});

channelsRouter.post(
  '/channels',
  handle(async (req, res) => {
    const body = (req.body ?? {}) as { type?: string; name?: string; webhook?: string; secret?: string; events?: string[]; enabled?: boolean };
    if (!body.webhook?.startsWith('http')) throw badRequest('请填写以 http(s) 开头的 Webhook 地址');
    if (!body.name?.trim()) throw badRequest('请填写渠道名称');
    const created = channels.create(req.user!.id, {
      type: body.type === 'feishu' ? 'feishu' : 'dingtalk',
      name: body.name.trim(),
      webhook: encryptSecret(body.webhook.trim()),
      secret: body.secret?.trim() ? encryptSecret(body.secret.trim()) : undefined,
      events: (body.events ?? ['due']).filter((event): event is ChannelEvent => EVENTS.includes(event as ChannelEvent)),
      enabled: body.enabled,
    });
    res.status(201).json({ channel: shape(created) });
  }),
);

channelsRouter.patch(
  '/channels/:id',
  handle(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      name: body.name,
      type: body.type,
      enabled: body.enabled,
      events: body.events,
    };
    if (typeof body.webhook === 'string' && body.webhook.startsWith('http')) patch.webhook = encryptSecret(body.webhook.trim());
    if (typeof body.secret === 'string' && body.secret && body.secret !== '••••••') patch.secret = encryptSecret(body.secret.trim());
    const updated = channels.update(req.user!.id, req.params.id, patch);
    if (!updated) {
      res.status(404).json({ error: { code: 'not_found', message: '渠道不存在', retryable: false } });
      return;
    }
    res.json({ channel: shape(updated) });
  }),
);

channelsRouter.delete('/channels/:id', (req, res) => {
  channels.remove(req.user!.id, req.params.id);
  res.status(204).end();
});

/** 发送测试消息，把上游原始错误回传，便于排查加签/关键词问题 */
channelsRouter.post(
  '/channels/:id/test',
  handle(async (req, res) => {
    const raw = channels.raw(req.user!.id, req.params.id);
    if (!raw) {
      res.status(404).json({ error: { code: 'not_found', message: '渠道不存在', retryable: false } });
      return;
    }
    const webhook = decryptSecret(String(raw.webhook));
    const secret = raw.secret ? decryptSecret(String(raw.secret)) : null;
    const message = {
      title: '连接测试',
      body: `这是一条来自「${req.user!.displayName}」的测试消息，收到即表示配置正确。`,
    };
    try {
      await sendByType(String(raw.type), webhook, secret, message);
      channels.markResult(String(raw.id), true);
      res.json({ ok: true, message: '测试消息已发送' });
    } catch (error) {
      const detail = (error as Error).message;
      channels.markResult(String(raw.id), false, detail);
      res.status(502).json({ error: { code: 'channel_test_failed', message: `发送失败：${detail}`, retryable: false } });
    }
  }),
);
