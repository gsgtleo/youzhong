/// <reference types="vite/client" />

/** 构建时间戳，用于确认浏览器加载的是否为最新前端（排查 Service Worker 缓存） */
declare const __BUILD_ID__: string;

/** 桌面客户端（Electron）在页面里注入的桥接；浏览器里为 undefined */
interface YouzhongDesktopBridge {
  isDesktop: boolean;
  platform: string;
  appVersion?: string;
  electronVersion?: string;
  chromeVersion?: string;
  /** 弹系统通知（窗口最小化/隐藏到托盘时也能弹） */
  notify?: (payload: { title: string; body?: string; taskId?: string }) => void;
  openServerSettings?: () => void;
  getServerUrl?: () => Promise<string>;
  setServerUrl?: (value: string) => Promise<unknown>;
}

interface Window {
  youzhongDesktop?: YouzhongDesktopBridge;
}
