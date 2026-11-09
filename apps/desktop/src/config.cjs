'use strict';

/** 桌面端配置：存放在用户数据目录（Windows: %APPDATA%/Youzhong/config.json） */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = {
  /** 服务器地址，例如 http://192.168.1.10:10078 或 https://域名/youzhong；留空则在登录页手填 */
  serverUrl: '',
  /** 上次窗口位置与大小 */
  windowBounds: null,
  maximized: false,
  /** Windows 开机自启 */
  launchAtLogin: false,
  /** 关闭窗口时最小化到托盘 */
  closeToTray: false,
};

function configFile(userDataDir) {
  return path.join(userDataDir, 'config.json');
}

function load(userDataDir) {
  try {
    const raw = fs.readFileSync(configFile(userDataDir), 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(userDataDir, patch) {
  const next = { ...load(userDataDir), ...(patch || {}) };
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(configFile(userDataDir), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

/** 归一化：去空格、去尾斜杠、补全 http:// */
function normalizeServerUrl(value) {
  let url = String(value || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url.replace(/\/+$/, '');
}

module.exports = { DEFAULTS, load, save, configFile, normalizeServerUrl };
