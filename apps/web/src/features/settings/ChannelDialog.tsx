import { useEffect, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import type { Channel, ChannelEvent, ChannelType } from '@youzhong/shared';
import { Button, Chip, Input, Segmented } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/overlay';
import { channelApi } from '@/api/auth';
import { toast } from '@/components/ui/toast';

const EVENTS: { value: ChannelEvent; label: string }[] = [
  { value: 'due', label: '任务到期' },
  { value: 'daily', label: '每日汇总' },
  { value: 'completed', label: '任务完成' },
];

export function ChannelDialog({
  open,
  onClose,
  channel,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  channel?: Channel;
  onSaved: () => void;
}) {
  const [type, setType] = useState<ChannelType>('dingtalk');
  const [name, setName] = useState('');
  const [webhook, setWebhook] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<ChannelEvent[]>(['due']);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(channel?.type ?? 'dingtalk');
    setName(channel?.name ?? '');
    setWebhook(channel?.webhook ?? '');
    setSecret('');
    setEvents(channel?.events?.length ? channel.events : ['due']);
    setEnabled(channel?.enabled ?? true);
  }, [open, channel]);

  const save = async () => {
    if (!name.trim()) {
      toast('请填写渠道名称', 'error');
      return;
    }
    if (!webhook.trim().startsWith('http')) {
      toast('请填写完整的 Webhook 地址', 'error');
      return;
    }
    setSaving(true);
    try {
      if (channel) await channelApi.update(channel.id, { type, name, webhook, secret: secret || undefined, events, enabled });
      else await channelApi.create({ type, name, webhook, secret: secret || undefined, events, enabled });
      toast('通知渠道已保存', 'success');
      onSaved();
      onClose();
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!channel) {
      toast('请先保存渠道，再发送测试消息', 'info');
      return;
    }
    setTesting(true);
    try {
      const result = await channelApi.test(channel.id);
      toast(result.message, 'success');
      onSaved();
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={channel ? '编辑通知渠道' : '新建通知渠道'}
      subtitle="钉钉与飞书都通过群机器人 Webhook 推送，密钥仅在服务端加密保存"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            保存渠道
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Segmented
          value={type}
          onChange={(value) => setType(value)}
          options={[
            { value: 'dingtalk', label: '钉钉群机器人' },
            { value: 'feishu', label: '飞书群机器人' },
          ]}
        />

        <label className="flex flex-col gap-1 text-2xs text-faint">
          渠道名称
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：家庭群 / 研发日报群" />
        </label>

        <label className="flex flex-col gap-1 text-2xs text-faint">
          Webhook 地址
          <Input
            value={webhook}
            onChange={(event) => setWebhook(event.target.value)}
            placeholder={type === 'dingtalk' ? 'https://oapi.dingtalk.com/robot/send?access_token=...' : 'https://open.feishu.cn/open-apis/bot/v2/hook/...'}
          />
        </label>

        <label className="flex flex-col gap-1 text-2xs text-faint">
          加签密钥（可选）
          <Input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder={channel?.secret ? '留空表示不修改' : type === 'dingtalk' ? 'SEC 开头的加签密钥' : '机器人签名校验密钥'}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-2xs text-faint">触发事件</span>
          <div className="flex flex-wrap gap-1.5">
            {EVENTS.map((event) => (
              <Chip
                key={event.value}
                active={events.includes(event.value)}
                onClick={() =>
                  setEvents((prev) => (prev.includes(event.value) ? prev.filter((value) => value !== event.value) : [...prev, event.value]))
                }
              >
                {event.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
          <div>
            <p className="text-[13px] text-ink">启用该渠道</p>
            <p className="text-2xs text-faint">关闭后仍保留配置，但不再推送</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((value) => !value)}
            className={`relative h-5 w-9 cursor-pointer rounded-full transition-colors ${enabled ? 'bg-brand' : 'bg-line'}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${enabled ? 'left-[18px]' : 'left-0.5'}`}
            />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={sendTest} disabled={testing || !channel}>
            {testing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            发送测试消息
          </Button>
          {!channel ? <span className="text-2xs text-faint">保存后可发送测试</span> : null}
        </div>

        {channel?.lastError ? (
          <p className="flex items-start gap-1 rounded-lg bg-red-50 px-2 py-1.5 text-2xs text-red-600">
            <X size={11} className="mt-0.5 shrink-0" />
            最近一次失败：{channel.lastError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
