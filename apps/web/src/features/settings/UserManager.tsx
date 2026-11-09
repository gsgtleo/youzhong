import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import type { User } from '@youzhong/shared';
import { Button, Input } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/overlay';
import { adminApi } from '@/api/auth';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/utils';

export function UserManager() {
  const me = useAuth((state) => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: '', displayName: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<User>();
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await adminApi.list();
      setUsers(result.users);
      setLimit(result.limit);
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitCreate = async () => {
    setBusy(true);
    try {
      await adminApi.create(form);
      toast(`已创建账号 ${form.username}`, 'success');
      setCreating(false);
      setForm({ username: '', displayName: '', password: '' });
      void load();
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-2xs text-faint">
          {loading ? '加载中…' : `共 ${users.length} / ${limit} 位成员`}
        </p>
        <Button size="xs" onClick={() => setCreating(true)} disabled={users.length >= limit}>
          <UserPlus size={12} /> 新建成员
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        {users.map((user) => (
          <div key={user.id} className="flex items-center gap-3 border-b border-line/70 px-3 py-2.5 last:border-b-0">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg text-2xs font-semibold',
                user.role === 'admin' ? 'bg-brand-50 text-brand' : 'bg-subtle text-muted',
              )}
            >
              {user.displayName.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-[13px] text-ink">
                {user.displayName}
                <span className="text-2xs text-faint">@{user.username}</span>
                {user.role === 'admin' ? <ShieldCheck size={11} className="text-brand" /> : null}
              </p>
              <p className="text-2xs text-faint">
                {user.status === 'active' ? '正常' : '已停用'}
                {user.lastLoginAt ? ` · 最近登录 ${new Date(user.lastLoginAt).toLocaleDateString('zh-CN')}` : ''}
              </p>
            </div>
            <Button size="xs" variant="ghost" onClick={() => setResetTarget(user)}>
              重置密码
            </Button>
            {user.id !== me?.id ? (
              <Button
                size="xs"
                variant="ghost"
                onClick={async () => {
                  await adminApi.setStatus(user.id, user.status === 'active' ? 'disabled' : 'active');
                  toast(user.status === 'active' ? '账号已停用' : '账号已启用', 'success');
                  void load();
                }}
              >
                {user.status === 'active' ? '停用' : '启用'}
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="新建成员"
        subtitle="新账号会自动创建笔记本与示例任务"
        width="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              取消
            </Button>
            <Button size="sm" onClick={submitCreate} disabled={busy}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              创建
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2.5">
          <Input placeholder="登录用户名，例如 xiaoming" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          <Input placeholder="显示名称，例如 小明" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
          <Input
            type="password"
            placeholder="初始密码（至少 8 位）"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(undefined)}
        title={`重置 ${resetTarget?.displayName ?? ''} 的密码`}
        width="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setResetTarget(undefined)}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!resetTarget) return;
                await adminApi.resetPassword(resetTarget.id, newPassword);
                toast('密码已重置', 'success');
                setResetTarget(undefined);
                setNewPassword('');
              }}
            >
              确认重置
            </Button>
          </>
        }
      >
        <Input type="password" placeholder="新密码（至少 8 位）" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
      </Modal>
    </div>
  );
}
