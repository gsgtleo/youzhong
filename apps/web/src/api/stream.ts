import { getServerUrl } from './http';

export interface StreamHandlers {
  onSnapshotChange?: () => void;
  onNotification?: (payload: { title: string; body?: string; taskId?: string; kind?: string }) => void;
  onOpen?: () => void;
}

/**
 * 服务端实时通道（SSE）：
 * 数据变更 → 静默刷新；通知事件 → 直接提示，时间完全以服务器为准。
 */
export function openStream(token: string, handlers: StreamHandlers): () => void {
  const base = getServerUrl() || (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  const url = `${base}/api/stream?token=${encodeURIComponent(token)}`;
  const source = new EventSource(url, { withCredentials: true });

  source.addEventListener('ready', () => handlers.onOpen?.());
  source.addEventListener('snapshot-changed', () => handlers.onSnapshotChange?.());
  source.addEventListener('notification', (event) => {
    try {
      handlers.onNotification?.(JSON.parse((event as MessageEvent).data));
    } catch (error) {
      console.error('[stream] 通知解析失败', error);
    }
  });

  return () => source.close();
}
