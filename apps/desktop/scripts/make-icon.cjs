'use strict';

/**
 * 用 Electron 自带的 Chromium 把网页端 SVG 图标栅格化成 512x512 PNG，
 * 供 electron-builder 生成 Windows .ico / macOS .icns（避免依赖 ImageMagick）。
 * 用法：electron scripts/make-icon.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const SIZE = 512;

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const source = path.resolve(__dirname, '..', '..', 'web', 'public', 'icon.svg');
  const outDir = path.resolve(__dirname, '..', 'resources');
  const outFile = path.join(outDir, 'icon.png');

  if (!fs.existsSync(source)) {
    console.error(`缺少图标源文件：${source}`);
    app.exit(1);
    return;
  }

  const svg = fs.readFileSync(source, 'utf8');
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const html = `<html><body style="margin:0;background:transparent">
    <img src="${dataUrl}" width="${SIZE}" height="${SIZE}" style="display:block" />
  </body></html>`;

  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true, sandbox: false },
  });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise((resolve) => setTimeout(resolve, 600));

  const image = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  const png = image.toPNG();
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, png);
  console.log(`已生成 ${outFile}（${png.length} 字节，${image.getSize().width}x${image.getSize().height}）`);
  win.destroy();
  app.exit(0);
});
