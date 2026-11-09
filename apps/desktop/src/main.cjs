'use strict';

/**
 * 有终桌面客户端（Electron 外壳）
 * - 用本地 http 服务托管打包进来的网页端，功能与网页版完全一致；
 * - 额外提供：窗口位置记忆、托盘、开机自启、服务器地址设置、通知、外部链接用系统浏览器打开、下载跟随系统。
 */

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, Menu, Tray, shell, dialog, ipcMain, nativeImage, session, Notification } = require('electron');
const { startStaticServer } = require('./server.cjs');
const { load: loadConfig, save: saveConfig, configFile, normalizeServerUrl } = require('./config.cjs');

const APP_TITLE = '有终';
const SMOKE = process.argv.includes('--smoke');
const DEVTOOLS = process.argv.includes('--devtools');
const argOf = (prefix) => {
  const hit = process.argv.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
};
const ARG_SERVER = normalizeServerUrl(argOf('--server-url='));

let mainWindow = null;
let tray = null;
let staticServer = null;
let settingsWindow = null;
let localOrigin = '';
let quitting = false;
let injectedServerUrl = '';
let notifyCount = 0;

const userDataDir = () => app.getPath('userData');
const readConfig = () => loadConfig(userDataDir());
const writeConfig = (patch) => saveConfig(userDataDir(), patch);

const iconPath = () =>
  app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : path.join(__dirname, '..', 'resources', 'icon.png');

function webDistDir() {
  return app.isPackaged ? path.join(process.resourcesPath, 'web') : path.resolve(__dirname, '..', '..', 'web', 'dist');
}

/* ----------------------------- 本地服务器 ----------------------------- */

async function ensureServer() {
  if (staticServer) return staticServer;
  staticServer = await startStaticServer({ root: webDistDir() });
  localOrigin = staticServer.url.replace(/\/$/, '');
  return staticServer;
}

/* ------------------------------- 主窗口 ------------------------------- */

function createMainWindow() {
  const config = readConfig();
  const bounds = config.windowBounds || {};
  const options = {
    width: bounds.width || 1280,
    height: bounds.height || 820,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: APP_TITLE,
    backgroundColor: '#F7F8FA',
    autoHideMenuBar: false,
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: false,
      additionalArguments: [`--youzhong-app-version=${app.getVersion()}`],
    },
  };
  if (typeof bounds.x === 'number' && typeof bounds.y === 'number') {
    options.x = bounds.x;
    options.y = bounds.y;
  }

  mainWindow = new BrowserWindow(options);
  if (config.maximized) mainWindow.maximize();

  const startHidden = process.argv.includes('--hidden') && !SMOKE;
  mainWindow.once('ready-to-show', () => {
    if (!SMOKE && !startHidden) mainWindow.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    void syncServerUrlToPage();
  });

  // 站内跳转放行，站外（例如安装包下载页）交给系统浏览器
  const isInternal = (url) => url.startsWith(localOrigin) || url.startsWith('http://localhost') || url.startsWith('devtools://');
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isInternal(url)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) && !url.startsWith(localOrigin)) void shell.openExternal(url);
    else if (url.startsWith(localOrigin)) return { action: 'allow' };
    return { action: 'deny' };
  });

  // 退出前记住窗口位置
  mainWindow.on('close', (event) => {
    const state = readConfig();
    if (!quitting && state.closeToTray && tray) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }
    saveWindowState();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('unresponsive', () => {
    if (SMOKE) return;
    void dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: APP_TITLE,
      message: '界面无响应',
      detail: '可以尝试「视图 → 重新加载」，或退出后重新打开。',
      buttons: ['继续等待', '重新加载'],
      defaultId: 0,
      cancelId: 0,
    }).then((result) => {
      if (result.response === 1 && mainWindow) mainWindow.reload();
    });
  });

  void mainWindow.loadURL(`${localOrigin}/`);
  if (DEVTOOLS) mainWindow.webContents.openDevTools({ mode: 'detach' });
  if (SMOKE) {
    mainWindow.webContents.on('console-message', (_event, level, message) => {
      console.log(`[renderer:${level}] ${message}`);
    });
    session.defaultSession.webRequest.onErrorOccurred((details) => {
      console.log(`[net-error] ${details.error} ${details.method} ${details.url}`);
    });
  }
  return mainWindow;
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const maximized = mainWindow.isMaximized();
  const bounds = maximized ? readConfig().windowBounds : mainWindow.getNormalBounds();
  writeConfig({ maximized, windowBounds: bounds });
}

/** 把配置里的服务器地址写进页面 localStorage（网页端据此直连服务端） */
async function syncServerUrlToPage() {
  const target = SMOKE && ARG_SERVER ? ARG_SERVER : normalizeServerUrl(readConfig().serverUrl);
  if (!target || !mainWindow) return;
  if (injectedServerUrl === target) return;
  try {
    const current = await mainWindow.webContents.executeJavaScript("localStorage.getItem('youzhong-server-url') || ''", true);
    if (current !== target) {
      await mainWindow.webContents.executeJavaScript(
        `localStorage.setItem('youzhong-server-url', ${JSON.stringify(target)})`,
        true,
      );
      injectedServerUrl = target;
      if (!SMOKE) mainWindow.webContents.reload();
      return;
    }
    injectedServerUrl = target;
  } catch {
    /* 页面还没就绪，下次 did-finish-load 再试 */
  }
}

/* ----------------------------- 服务器设置窗口 ----------------------------- */

async function pingServer(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${url}/api/ping`, { signal: controller.signal });
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
    const body = await response.json();
    return { ok: Boolean(body && body.ok), name: body && body.name, version: body && body.version };
  } catch (error) {
    return { ok: false, reason: error && error.name === 'AbortError' ? '连接超时' : String(error && error.message) };
  } finally {
    clearTimeout(timer);
  }
}

function openServerSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 268,
    parent: mainWindow || undefined,
    modal: Boolean(mainWindow),
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: '服务器地址',
    icon: iconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.setMenu(null);
  settingsWindow.once('ready-to-show', () => settingsWindow.show());
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  void settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
}

ipcMain.handle('youzhong:get-server-url', () => normalizeServerUrl(readConfig().serverUrl));
ipcMain.handle('youzhong:set-server-url', async (_event, value) => {
  const url = normalizeServerUrl(value);
  if (url && !/^https?:\/\/[^\s/]+/i.test(url)) return { ok: false, reason: '地址格式不对，应以 http:// 或 https:// 开头' };
  const previous = readConfig().serverUrl;
  writeConfig({ serverUrl: url });
  if (mainWindow) {
    injectedServerUrl = '';
    try {
      await mainWindow.webContents.executeJavaScript(
        url ? `localStorage.setItem('youzhong-server-url', ${JSON.stringify(url)})` : "localStorage.removeItem('youzhong-server-url')",
        true,
      );
    } catch {
      /* 页面未就绪时忽略，下次加载会再注入 */
    }
    setTimeout(() => mainWindow && mainWindow.reload(), 120);
  }
  if (!url) return { ok: true, pingOk: false, reason: '已清空，登录页可手动填写' };
  const probe = await pingServer(url);
  return {
    ok: true,
    pingOk: probe.ok,
    name: probe.name,
    version: probe.version,
    reason: probe.ok ? '' : probe.reason || '连接失败',
    previous,
  };
});
ipcMain.on('youzhong:open-server-settings', () => openServerSettings());
ipcMain.on('youzhong:close-server-settings', () => {
  if (settingsWindow) settingsWindow.close();
});

/* ------------------------------ 系统通知 ------------------------------ */

/**
 * Windows 上「打包成 zip / portable」时没有开始菜单快捷方式，Toast 会被系统丢掉。
 * 首次运行补一个带 AppUserModelID 的快捷方式，通知才稳定显示。
 */
function ensureWindowsShortcut() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  try {
    const programs = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    const link = path.join(programs, 'Youzhong.lnk');
    if (fs.existsSync(link)) return;
    fs.mkdirSync(programs, { recursive: true });
    shell.writeShortcutLink(link, 'create', {
      target: process.execPath,
      cwd: path.dirname(process.execPath),
      description: APP_TITLE,
      appUserModelId: 'app.youzhong.desktop',
      icon: iconPath(),
      iconIndex: 0,
    });
  } catch (error) {
    console.warn('[notify] 创建开始菜单快捷方式失败（Windows 通知依赖它）', error && error.message);
  }
}

/** 网页端把 SSE 通知转过来，这里弹真正的系统通知；点一下回到窗口 */
function showNativeNotification(payload) {
  const title = payload && payload.title ? String(payload.title) : APP_TITLE;
  const body = payload && payload.body ? String(payload.body) : '';
  notifyCount += 1;
  if (SMOKE) console.log(`[notify] ${title}${body ? ' | ' + body : ''}`);
  if (!Notification.isSupported()) {
    console.warn('[notify] 当前平台不支持系统通知');
    return;
  }
  try {
    const notification = new Notification({ title, body, icon: iconPath(), silent: false, timeoutType: 'default' });
    notification.on('click', () => showMainWindow());
    notification.show();
  } catch (error) {
    console.warn('[notify] 系统通知发送失败', error && error.message);
  }
}

ipcMain.on('youzhong:notify', (_event, payload) => showNativeNotification(payload));

/* -------------------------------- 菜单 -------------------------------- */

function applyLaunchAtLogin(enabled) {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return;
  // 开机自启时不弹窗，直接住在托盘里，到点照样能弹系统通知
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled), openAsHidden: true, args: ['--hidden'] });
}

function buildMenu() {
  const config = readConfig();
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '服务器地址…', accelerator: 'CmdOrCtrl+,', click: () => openServerSettings() },
        { type: 'separator' },
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => mainWindow && mainWindow.reload() },
        { label: '强制重新加载（忽略缓存）', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow && mainWindow.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        { label: '打开网页版', click: () => { const url = normalizeServerUrl(readConfig().serverUrl); if (url) void shell.openExternal(url); else void dialog.showMessageBox({ type: 'info', message: '还没配置服务器地址', detail: '先在「文件 → 服务器地址…」里填写。' }); } },
        { label: '打开配置文件所在目录', click: () => void shell.openPath(path.dirname(configFile(userDataDir()))) },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => { quitting = true; app.quit(); } },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        { type: 'separator' },
        {
          label: '最小化到托盘',
          type: 'checkbox',
          checked: Boolean(config.closeToTray),
          click: (item) => writeConfig({ closeToTray: item.checked }),
        },
        { label: '开发者工具', accelerator: 'F12', click: () => mainWindow && mainWindow.webContents.toggleDevTools() },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于' + APP_TITLE,
          click: () => {
            const state = readConfig();
            void dialog.showMessageBox({
              type: 'info',
              title: `关于 ${APP_TITLE}`,
              message: `${APP_TITLE} 桌面客户端 v${app.getVersion()}`,
              detail: [
                `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
                `服务器：${state.serverUrl || '未配置'}`,
                `配置目录：${userDataDir()}`,
              ].join('\n'),
              buttons: ['好'],
            });
          },
        },
        {
          label: '开机自动启动',
          type: 'checkbox',
          enabled: process.platform === 'win32' || process.platform === 'darwin',
          checked: Boolean(config.launchAtLogin),
          click: (item) => {
            writeConfig({ launchAtLogin: item.checked });
            applyLaunchAtLogin(item.checked);
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* -------------------------------- 托盘 -------------------------------- */

function buildTray() {
  let image = nativeImage.createFromPath(iconPath());
  if (image.isEmpty()) return;
  image = image.resize({ width: 20, height: 20 });
  tray = new Tray(image);
  tray.setToolTip(APP_TITLE);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主窗口', click: () => showMainWindow() },
      { label: '隐藏窗口', click: () => mainWindow && mainWindow.hide() },
      { type: 'separator' },
      { label: '服务器地址…', click: () => openServerSettings() },
      { type: 'separator' },
      { label: '退出', click: () => { quitting = true; app.quit(); } },
    ]),
  );
  tray.on('double-click', () => showMainWindow());
  tray.on('click', () => showMainWindow());
}

function showMainWindow() {
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/* ------------------------------ 下载 / 通知 ------------------------------ */

function setupSession() {
  const ses = session.defaultSession;
  const allowed = new Set(['notifications', 'fullscreen', 'clipboard-sanitized-write']);
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.has(permission)));
  ses.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));

  ses.on('will-download', (_event, item) => {
    const name = item.getFilename() || 'download';
    item.setSavePath(path.join(app.getPath('downloads'), name));
    item.once('done', (_e, state) => {
      if (state === 'completed' && !SMOKE) shell.showItemInFolder(item.getSavePath());
    });
  });
}

/* ------------------------------- 冒烟测试 ------------------------------- */

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function waitForLoad(timeoutMs = 15000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      mainWindow.webContents.removeListener('did-finish-load', onLoad);
      resolve(value);
    };
    const onLoad = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    mainWindow.webContents.once('did-finish-load', onLoad);
  });
}

async function runSmoke() {
  await waitMs(2500);
  const login = argOf('--login=');

  const probeScript = `(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const out = {
      title: document.title,
      href: location.href,
      rootChildren: (document.getElementById('root') || {}).childElementCount || 0,
      serverUrl: localStorage.getItem('youzhong-server-url') || '',
      hasDesktopBridge: Boolean(window.youzhongDesktop && window.youzhongDesktop.isDesktop),
      serviceWorkerDisabled: !('serviceWorker' in navigator) || navigator.serviceWorker === undefined,
      desktopVersion: window.youzhongDesktop ? window.youzhongDesktop.appVersion : '',
    };
    out.text = (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80);

    if (out.serverUrl) {
      for (let attempt = 0; attempt < 3 && !out.ping && !out.pingError; attempt += 1) {
        try {
          const response = await fetch(out.serverUrl + '/api/ping');
          out.ping = await response.json();
        } catch (error) {
          if (attempt === 2) out.pingError = String(error);
          else await wait(500);
        }
      }
    }

    if (window.youzhongDesktop && typeof window.youzhongDesktop.notify === 'function') {
      window.youzhongDesktop.notify({ title: '冒烟测试通知', body: '桌面客户端通知通道已连通' });
      out.notifySent = true;
    }

    const credentials = ${JSON.stringify(login)};
    if (credentials && out.ping && out.ping.ok) {
      const [username, password] = credentials.split(':');
      try {
        const response = await fetch(out.serverUrl + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const session = await response.json();
        if (session && session.token) {
          localStorage.setItem('youzhong-server-url', out.serverUrl);
          localStorage.setItem('youzhong-auth', JSON.stringify({ state: { serverUrl: out.serverUrl, token: session.token, user: session.user }, version: 0 }));
          out.sessionInjected = true;
        } else {
          out.loginError = JSON.stringify(session).slice(0, 120);
        }
      } catch (error) {
        out.loginError = String(error);
      }
    }
    return out;
  })()`;

  let result = {};
  try {
    result = await mainWindow.webContents.executeJavaScript(probeScript, true);
  } catch (error) {
    result = { error: String(error) };
  }

  if (result.sessionInjected) {
    const loaded = waitForLoad();
    mainWindow.webContents.reload();
    await loaded;
    await waitMs(2200);
    const interact = process.argv.includes('--interact');
    try {
      const shell = await mainWindow.webContents.executeJavaScript(
        `(async () => {
          const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const bodyText = () => (document.body.innerText || '').replace(/\\s+/g, ' ').trim();
          const out = {
            afterLogin: bodyText().slice(0, 200),
            loggedIn: /收件箱|添加任务|今天/.test(bodyText()) && !/首次使用请先填写服务器地址/.test(bodyText()),
            taskCount: (bodyText().match(/今天\\s*(\\d+)/) || [])[1] || null,
          };
          if (${JSON.stringify(interact)} && out.loggedIn) {
            const input = Array.from(document.querySelectorAll('input')).find((el) => (el.getAttribute('placeholder') || '').includes('添加任务'));
            if (!input) { out.interactError = '找不到快速添加输入框'; return out; }
            const title = '桌面端快速添加测试';
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, title + ' !高');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
            await wait(1800);
            out.afterAdd = bodyText().includes(title);
            out.countAfterAdd = (bodyText().match(/今天\\s*(\\d+)/) || [])[1] || null;

            // 清理：按标题删掉刚才创建的任务
            const auth = JSON.parse(localStorage.getItem('youzhong-auth') || '{}');
            const token = auth && auth.state && auth.state.token;
            if (token) {
              const snapshot = await fetch((localStorage.getItem('youzhong-server-url') || '') + '/api/snapshot', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
              const created = (snapshot.tasks || []).filter((task) => task.title === title);
              for (const task of created) {
                await fetch((localStorage.getItem('youzhong-server-url') || '') + '/api/tasks/' + task.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
              }
              out.cleaned = created.length;
            }
          }
          return out;
        })()`,
        true,
      );
      result = { ...result, ...shell };
    } catch (error) {
      result.shellError = String(error);
    }
  }

  await waitMs(400);
  const rendered = result.rootChildren > 0 && result.hasDesktopBridge;
  const loginOk = !login || result.loggedIn === true;
  const notifyOk = !result.notifySent || notifyCount > 0;
  console.log(`SMOKE_RESULT=${JSON.stringify(result)}`);
  console.log(`SMOKE_PING=${result.ping ? JSON.stringify(result.ping) : (result.pingError || 'skipped')}`);
  console.log(`SMOKE_NOTIFY=${notifyCount}`);
  const ok = rendered && loginOk && notifyOk;
  console.log(ok ? 'SMOKE=PASS' : 'SMOKE=FAIL');
  quitting = true;
  app.exit(ok ? 0 : 1);
}

/* -------------------------------- 启动 -------------------------------- */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());

  app.whenReady().then(async () => {
    app.setAppUserModelId('app.youzhong.desktop');
    ensureWindowsShortcut();
    setupSession();
    try {
      await ensureServer();
    } catch (error) {
      dialog.showErrorBox('启动失败', String(error && error.message ? error.message : error));
      app.quit();
      return;
    }
    buildMenu();
    if (!SMOKE) {
      buildTray();
      const state = readConfig();
      if (state.launchAtLogin) applyLaunchAtLogin(true);
    }
    createMainWindow();
    if (SMOKE) void runSmoke();
  });

  app.on('activate', () => showMainWindow());

  app.on('window-all-closed', () => {
    if (process.platform === 'darwin') return;
    if (!quitting && readConfig().closeToTray) return;
    quitting = true;
    app.quit();
  });

  app.on('before-quit', () => {
    quitting = true;
    saveWindowState();
    if (staticServer) void staticServer.close();
    staticServer = null;
  });
}
