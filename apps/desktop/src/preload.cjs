'use strict';

/** 主窗口预加载：只暴露只读信息、通知与「打开服务器设置」，不做任何文件/网络能力 */
const { contextBridge, ipcRenderer, webFrame } = require('electron');

// 桌面端不需要 Service Worker：本地静态文件随应用包升级，
// 留着 SW 反而会在升级后把旧外壳/旧资源缓存住，导致「界面不更新」。
try {
  webFrame.executeJavaScript(
    "try { Object.defineProperty(navigator, 'serviceWorker', { get: () => undefined, configurable: true }); } catch (error) {}",
  );
} catch {
  /* 忽略：极端情况下页面仍会注册 SW，但本地缓存清理由主进程 reloadIgnoringCache 兜底 */
}

const argVersion = process.argv.find((item) => item.startsWith('--youzhong-app-version=')) || '';
const appVersion = argVersion.slice('--youzhong-app-version='.length);

contextBridge.exposeInMainWorld('youzhongDesktop', {
  isDesktop: true,
  platform: process.platform,
  appVersion,
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
  /** 由主进程弹系统通知（窗口最小化/隐藏到托盘时也能弹，并可点回窗口） */
  notify: (payload) => {
    if (!payload || !payload.title) return;
    ipcRenderer.send('youzhong:notify', {
      title: String(payload.title),
      body: payload.body ? String(payload.body) : '',
      taskId: payload.taskId ? String(payload.taskId) : undefined,
    });
  },
  openServerSettings: () => ipcRenderer.send('youzhong:open-server-settings'),
  getServerUrl: () => ipcRenderer.invoke('youzhong:get-server-url'),
  setServerUrl: (value) => ipcRenderer.invoke('youzhong:set-server-url', value),
});
