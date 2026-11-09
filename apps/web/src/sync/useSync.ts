import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { cacheSnapshot, readCachedSnapshot } from '@/db/dexie';
import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';
import { openStream } from '@/api/stream';
import { toast } from '@/components/ui/toast';
import { flushOutbox, setDrainHandler } from './queue';

const POLL_INTERVAL = 60_000;

let refresher: ((silent?: boolean) => Promise<void>) | undefined;

/** 供设置页等外部组件触发一次同步 */
export function triggerSync(silent = false): void {
  void refresher?.(silent);
}

export function registerRefresher(fn: (silent?: boolean) => Promise<void>): void {
  refresher = fn;
}

export function useSync() {
  const hydrate = useApp((state) => state.hydrate);
  const setMeta = useApp((state) => state.setMeta);
  const bootstrapped = useRef(false);
  const token = useAuth((state) => state.token);

  const refresh = useCallback(
    async (silent = false) => {
      const state = useApp.getState();
      if (!state.ready || !silent) setMeta({ loading: !state.ready });
      setMeta({ syncing: true });
      try {
        const snapshot = await api.snapshot();
        hydrate(snapshot);
        await cacheSnapshot(snapshot);
      } catch (error) {
        const message = (error as Error).message ?? '同步失败';
        setMeta({ error: message, loading: false, syncing: false, ready: true });
        if (!silent) toast(`同步失败：${message}`, 'error');
      }
    },
    [hydrate, setMeta],
  );

  useEffect(() => {
    registerRefresher(refresh);
  }, [refresh]);

  // 服务端实时通道：其它终端改动即时同步，通知也由服务端下发
  useEffect(() => {
    if (!token) return;
    const close = openStream(token, {
      onSnapshotChange: () => {
        void refresh(true);
      },
      onNotification: (payload) => {
        // 桌面客户端：同时弹系统通知（窗口最小化到托盘也能看到）
        window.youzhongDesktop?.notify?.({ title: payload.title, body: payload.body, taskId: payload.taskId });
        toast(`${payload.title}${payload.body ? `：${payload.body}` : ''}`, 'info');
      },
    });
    return close;
  }, [refresh, token]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const boot = async () => {
      const cached = await readCachedSnapshot();
      if (cached) {
        hydrate(cached.payload);
        setMeta({ lastSync: cached.savedAt });
      }
      if (!useAuth.getState().token) {
        setMeta({ ready: true, loading: false });
        return;
      }
      await flushOutbox();
      await refresh(Boolean(cached));
    };

    void boot();
    setDrainHandler(() => {
      void refresh(true);
    });
  }, [hydrate, refresh, setMeta]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(true);
    }, POLL_INTERVAL);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void flushOutbox();
        void refresh(true);
      }
    };
    const onOnline = () => {
      void flushOutbox();
      void refresh(true);
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [refresh]);

  return { refresh };
}
