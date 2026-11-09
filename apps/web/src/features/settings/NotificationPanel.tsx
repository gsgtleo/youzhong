import { useCallback, useEffect, useState } from 'react';
import { Bell, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import type { Channel, UserSettings } from '@youzhong/shared';
import { Button, Chip, IconButton } from '@/components/ui/primitives';
import { ChannelDialog } from './ChannelDialog';
import { channelApi, settingsApi } from '@/api/auth';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const REMINDER_OPTIONS = [5, 15, 30, 60, 1440];

const TYPE_META = {
  dingtalk: { label: '钉钉', className: 'bg-[#E8F3FF] text-[#1E6FE8]' },
  feishu: { label: '飞书', className: 'bg-[#E6F7F4] text-[#0FA97F]' },
} as const;

export function NotificationPanel() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ reminderMinutes: [15], dailyDigest: true, dailyDigestHour: 9 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Channel>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [list, config] = await Promise.all([channelApi.list(), settingsApi.get()]);
      setChannels(list.channels);
      setSettings(config.settings);
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchSettings = async (patch: UserSettings) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await settingsApi.save(next);
    } catch (error) {
      toast(`保存失败：${(error as Error).message}`, 'error');
    }
  };

  const toggleReminder = (minutes: number) => {
    const current = settings.reminderMinutes ?? [15];
    void patchSettings({ reminderMinutes: current.includes(minutes) ? current.filter((value) => value !== minutes) : [...current, minutes].sort((a, b) => a - b) });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-subtle/40 px-3 py-2.5">
        <Bell size={13} className="text-brand" />
        <span className="mr-1 text-2xs text-muted">提前提醒</span>
        {REMINDER_OPTIONS.map((minutes) => (
          <Chip
            key={minutes}
            active={(settings.reminderMinutes ?? [15]).includes(minutes)}
            onClick={() => toggleReminder(minutes)}
          >
            {minutes >= 1440 ? '1 天' : `${minutes} 分钟`}
          </Chip>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <Chip active={Boolean(settings.dailyDigest)} onClick={() => void patchSettings({ dailyDigest: !settings.dailyDigest })}>
            每日汇总
          </Chip>
          <IconButton aria-label="刷新渠道" onClick={() => void load()}>
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          </IconButton>
        </span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-2xs text-faint">渠道（网页与安卓共用同一份配置）</p>
        <Button
          size="xs"
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus size={12} /> 新建渠道
        </Button>
      </div>

      {channels.length ? (
        <div className="flex flex-col gap-2">
          {channels.map((channel) => {
            const meta = TYPE_META[channel.type];
            return (
              <div key={channel.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-2xs font-semibold', meta.className)}>
                  {meta.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{channel.name}</p>
                  <p className="text-2xs text-faint">
                    {channel.enabled ? '已启用' : '已停用'} · {channel.events.map((event) => (event === 'due' ? '到期' : event === 'daily' ? '汇总' : '完成')).join(' / ')}
                    {channel.lastStatus === 'failed' ? ` · 上次失败：${channel.lastError ?? '未知'}` : channel.lastSentAt ? ` · ${new Date(channel.lastSentAt).toLocaleString('zh-CN')}` : ''}
                  </p>
                </div>
                <IconButton
                  aria-label="发送测试"
                  onClick={async () => {
                    try {
                      const result = await channelApi.test(channel.id);
                      toast(result.message, 'success');
                      void load();
                    } catch (error) {
                      toast((error as Error).message, 'error');
                      void load();
                    }
                  }}
                >
                  <Send size={14} />
                </IconButton>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setEditing(channel);
                    setDialogOpen(true);
                  }}
                >
                  编辑
                </Button>
                <IconButton
                  aria-label="删除渠道"
                  onClick={async () => {
                    await channelApi.remove(channel.id);
                    toast('渠道已删除', 'success');
                    void load();
                  }}
                >
                  <Trash2 size={14} className="text-faint" />
                </IconButton>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-line py-8">
          <Bell size={18} className="text-faint/70" />
          <p className="text-xs text-faint">还没有通知渠道</p>
          <p className="text-2xs text-faint/80">添加钉钉或飞书群机器人，自动接收到期提醒与每日汇总</p>
        </div>
      )}

      <ChannelDialog open={dialogOpen} onClose={() => setDialogOpen(false)} channel={editing} onSaved={() => void load()} />
    </div>
  );
}
