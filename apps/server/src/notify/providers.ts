import { createHmac } from 'node:crypto';

export interface PushMessage {
  title: string;
  body: string;
  link?: string;
}

function hmacBase64(key: string, data: string): string {
  return createHmac('sha256', key).update(data).digest('base64');
}

/** 钉钉群机器人：加签 + markdown 消息 */
export async function sendDingtalk(webhook: string, secret: string | null, message: PushMessage): Promise<void> {
  const url = new URL(webhook);
  if (secret) {
    const timestamp = Date.now();
    url.searchParams.set('timestamp', String(timestamp));
    url.searchParams.set('sign', hmacBase64(secret, `${timestamp}\n${secret}`));
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: { title: message.title, text: `### ${message.title}\n\n${message.body}${message.link ? `\n\n[打开任务](${message.link})` : ''}` },
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { errcode?: number; errmsg?: string };
  if (!response.ok || (payload.errcode ?? 0) !== 0) {
    throw new Error(`钉钉返回 ${response.status} ${payload.errcode ?? ''} ${payload.errmsg ?? ''}`.trim());
  }
}

/** 飞书群机器人：可选签名 + 文本消息 */
export async function sendFeishu(webhook: string, secret: string | null, message: PushMessage): Promise<void> {
  const body: Record<string, unknown> = {
    msg_type: 'text',
    content: { text: `${message.title}\n${message.body}${message.link ? `\n${message.link}` : ''}` },
  };
  if (secret) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    body.timestamp = timestamp;
    body.sign = hmacBase64(`${timestamp}\n${secret}`, '');
  }
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { code?: number; msg?: string; StatusCode?: number };
  const code = payload.code ?? payload.StatusCode ?? 0;
  if (!response.ok || code !== 0) {
    throw new Error(`飞书返回 ${response.status} ${code} ${payload.msg ?? ''}`.trim());
  }
}

export async function sendByType(type: string, webhook: string, secret: string | null, message: PushMessage): Promise<void> {
  if (type === 'feishu') return sendFeishu(webhook, secret, message);
  return sendDingtalk(webhook, secret, message);
}
