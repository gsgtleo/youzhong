import { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  CloudUpload,
  FileDown,
  FileUp,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Button, Input, Segmented } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/overlay';
import { toast } from '@/components/ui/toast';
import {
  backupApi,
  loadWebdavConfig,
  saveWebdavConfig,
  type BackupBundle,
  type WebdavConfig,
  type WebdavFile,
} from '@/api/backup';
import { db } from '@/db/dexie';
import { triggerSync } from '@/sync/useSync';

type Busy = 'test' | 'upload' | 'list' | 'download' | 'restore' | 'delete' | 'export' | undefined;

interface PendingRestore {
  name: string;
  data: BackupBundle;
  from: 'webdav' | 'file';
}

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function BackupPanel() {
  const [config, setConfig] = useState<WebdavConfig>(() => loadWebdavConfig());
  const [files, setFiles] = useState<WebdavFile[]>([]);
  const [busy, setBusy] = useState<Busy>();
  const [tested, setTested] = useState(false);
  const [pending, setPending] = useState<PendingRestore | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<WebdavConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveWebdavConfig(next);
    setTested(false);
  };

  const run = async (kind: Exclude<Busy, undefined>, task: () => Promise<void>) => {
    if (!config.url.trim() && kind !== 'export') {
      toast('请先填写 WebDAV 地址（坚果云 / Nextcloud / NAS 均可）', 'error');
      return;
    }
    setBusy(kind);
    try {
      await task();
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(undefined);
    }
  };

  const test = () =>
    run('test', async () => {
      const result = await backupApi.webdav('test', config);
      setTested(true);
      toast(result.message ?? 'WebDAV 连接正常', 'success');
    });

  const backup = () =>
    run('upload', async () => {
      const result = await backupApi.webdav('upload', config);
      toast(`已备份到 WebDAV：${result.file}`, 'success');
      const list = await backupApi.webdav('list', config);
      setFiles(list.files ?? []);
    });

  const refresh = () =>
    run('list', async () => {
      const result = await backupApi.webdav('list', config);
      setFiles(result.files ?? []);
      if (!result.files?.length) toast('目录里还没有备份文件', 'info');
    });

  const download = (file: WebdavFile) =>
    run('download', async () => {
      const result = await backupApi.webdav('download', config, file.name);
      if (!result.data) throw new Error('备份内容为空');
      setMode('merge');
      setPending({ name: file.name, data: result.data, from: 'webdav' });
    });

  const remove = (file: WebdavFile) => {
    if (!window.confirm(`确定删除 WebDAV 上的备份「${file.name}」？`)) return;
    void run('delete', async () => {
      await backupApi.webdav('delete', config, file.name);
      setFiles((prev) => prev.filter((item) => item.name !== file.name));
      toast('备份已删除', 'success');
    });
  };

  const exportLocal = () =>
    run('export', async () => {
      const bundle = await backupApi.export();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `youzhong-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast('已导出备份文件到下载目录', 'success');
    });

  const importLocal = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as BackupBundle;
      if (parsed?.format !== 'youzhong-backup') throw new Error('这不是有终的备份文件');
      setMode('merge');
      setPending({ name: file.name, data: parsed, from: 'file' });
    } catch (error) {
      toast(`读取失败：${(error as Error).message}`, 'error');
    }
  };

  const restore = async () => {
    if (!pending) return;
    setBusy('restore');
    try {
      // 恢复前清掉离线写队列：否则队列里的旧修改会在恢复后重放到新数据上
      await db.outbox.clear();
      const result = await backupApi.restore(pending.data, mode);
      toast(
        `已${mode === 'replace' ? '覆盖' : '合并'}恢复：${result.tasks} 条任务 / ${result.events} 个日程 / ${result.projects} 个清单`,
        'success',
      );
      setPending(null);
      triggerSync(false);
    } catch (error) {
      toast(`恢复失败：${(error as Error).message}`, 'error');
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <HardDrive size={13} className="text-brand" />
        <p className="text-[13px] font-medium text-ink">WebDAV 备份</p>
        {tested ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-2xs text-brand">
            <CheckCircle2 size={10} /> 已连接
          </span>
        ) : null}
        <span className="text-2xs text-faint">换服务器后，在新服务器登录并在这里恢复</span>
      </div>
      <p className="mt-1 text-2xs leading-relaxed text-faint">
        填自己的 WebDAV（坚果云、Nextcloud、群晖 / 威联通 NAS 都可以）。账号密码只保存在本机浏览器，上传由服务端转发。
      </p>

      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        <Input
          value={config.url}
          onChange={(event) => update({ url: event.target.value })}
          placeholder="WebDAV 地址，如 https://dav.jianguoyun.com/dav/"
        />
        <Input
          value={config.dir}
          onChange={(event) => update({ dir: event.target.value })}
          placeholder="备份目录，如 youzhong-backup"
        />
        <Input
          value={config.username}
          onChange={(event) => update({ username: event.target.value })}
          placeholder="账号（邮箱）"
          autoComplete="off"
        />
        <Input
          type="password"
          value={config.password}
          onChange={(event) => update({ password: event.target.value })}
          placeholder="密码 / 应用专用密码"
          autoComplete="new-password"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void test()} disabled={Boolean(busy)}>
          {busy === 'test' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} 测试连接
        </Button>
        <Button size="sm" onClick={() => void backup()} disabled={Boolean(busy)}>
          {busy === 'upload' ? <Loader2 size={13} className="animate-spin" /> : <CloudUpload size={13} />} 立即备份
        </Button>
        <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={Boolean(busy)}>
          {busy === 'list' ? <Loader2 size={13} className="animate-spin" /> : <CloudDownload size={13} />} 备份列表
        </Button>
        <span className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => void exportLocal()} disabled={Boolean(busy)}>
            <FileDown size={13} /> 导出到本地
          </Button>
          <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
            <FileUp size={13} /> 从文件恢复
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void importLocal(file);
            }}
          />
        </span>
      </div>

      {files.length ? (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
          {files.map((file) => (
            <li key={file.name} className="flex items-center gap-2 px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-ink">{file.name}</p>
                <p className="text-2xs text-faint">
                  {formatSize(file.size)}
                  {file.modifiedAt ? ` · ${formatTime(file.modifiedAt)}` : ''}
                </p>
              </div>
              <Button size="xs" variant="outline" onClick={() => void download(file)} disabled={Boolean(busy)}>
                {busy === 'download' ? <Loader2 size={11} className="animate-spin" /> : null} 恢复
              </Button>
              <button
                type="button"
                aria-label={`删除 ${file.name}`}
                onClick={() => remove(file)}
                disabled={Boolean(busy)}
                className="cursor-pointer rounded-md p-1 text-faint transition-colors hover:text-red-500"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Modal
        open={Boolean(pending)}
        onClose={() => (busy === 'restore' ? undefined : setPending(null))}
        title="恢复备份"
        subtitle={pending ? `${pending.name}（${pending.from === 'webdav' ? '来自 WebDAV' : '本地文件'}）` : undefined}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPending(null)} disabled={busy === 'restore'}>
              取消
            </Button>
            <Button size="sm" onClick={() => void restore()} disabled={busy === 'restore'}>
              {busy === 'restore' ? <Loader2 size={13} className="animate-spin" /> : null} 确认恢复
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Segmented
            value={mode}
            onChange={(value) => setMode(value)}
            options={[
              { value: 'merge', label: '合并（保留现有数据）' },
              { value: 'replace', label: '覆盖（先清空）' },
            ]}
          />
          <p className="text-2xs leading-relaxed text-faint">
            合并：现有清单与任务保留，同名清单会被复用，不会产生重复清单。
            覆盖：先删除当前账号的全部任务、清单、日程与标签，再写入备份内容（账号本身不受影响）。
          </p>
          {pending ? (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-subtle px-3 py-2 text-2xs text-muted md:grid-cols-4">
              <span>任务 {pending.data.tasks?.length ?? 0}</span>
              <span>清单 {pending.data.projects?.length ?? 0}</span>
              <span>日程 {pending.data.events?.length ?? 0}</span>
              <span>标签 {pending.data.tags?.length ?? 0}</span>
            </div>
          ) : null}
          {mode === 'replace' ? (
            <p className="flex items-start gap-1 rounded-lg bg-amber-50 px-2 py-1.5 text-2xs text-amber-700">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              覆盖恢复不可撤销，建议先点「立即备份」留一份当前数据。
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
