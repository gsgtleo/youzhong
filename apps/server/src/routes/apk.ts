import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { Router } from 'express';

/**
 * 安卓安装包下载：跟随主服务端口（默认 /apk），不再单开静态服务器。
 * 默认读取仓库 dist-packages，可用 APK_DIR 覆盖。
 */
const APK_DIR = process.env.APK_DIR
  ? resolve(process.env.APK_DIR)
  : resolve(process.cwd(), '../../dist-packages');

export const apkRouter = Router();

function listPackages(filter: (name: string) => boolean): { name: string; size: number; mtime: Date }[] {
  if (!existsSync(APK_DIR)) return [];
  return readdirSync(APK_DIR)
    .filter(filter)
    .map((file) => {
      const stat = statSync(resolve(APK_DIR, file));
      return { name: file, size: stat.size, mtime: stat.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

function listApks() {
  return listPackages((file) => file.endsWith('.apk'));
}

export interface ApkInfo {
  name: string;
  version: string | null;
  size: number;
  date: string;
  url: string;
}

/** 供 /api/version 使用：返回最新 APK 的版本信息 */
export function latestApk(): ApkInfo | null {
  const latest = listApks()[0];
  if (!latest) return null;
  return {
    name: latest.name,
    version: latest.name.match(/(\d+\.\d+\.\d+)/)?.[1] ?? null,
    size: latest.size,
    date: latest.mtime.toISOString(),
    url: `/apk/${encodeURIComponent(latest.name)}`,
  };
}

/** 桌面端（Windows）安装包：放在 APK_DIR 下的 *.zip，文件名带 desktop */
export function latestDesktop(): ApkInfo | null {
  const latest = listPackages((file) => /\.zip$/i.test(file) && /desktop/i.test(file))[0];
  if (!latest) return null;
  return {
    name: latest.name,
    version: latest.name.match(/(\d+\.\d+\.\d+)/)?.[1] ?? null,
    size: latest.size,
    date: latest.mtime.toISOString(),
    url: `/apk/${encodeURIComponent(latest.name)}`,
  };
}

const human = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

apkRouter.get('/apk', (_req, res) => {
  const files = listApks();
  const rows = files
    .map(
      (file) => `<li><a href="./apk/${encodeURIComponent(file.name)}">${file.name}</a>
        <span class="meta">${human(file.size)} · ${file.mtime.toLocaleDateString('zh-CN')}</span></li>`,
    )
    .join('');

  res.type('html').send(`<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>有终 · 安卓安装包</title>
<style>
  body{margin:0;padding:28px 20px;background:#f7f8fa;color:#1f2329;font-family:"PingFang SC",system-ui,-apple-system,sans-serif}
  .card{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:22px;box-shadow:0 10px 30px -18px rgba(16,24,40,.3)}
  .brand{display:flex;align-items:center;gap:10px;padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid #eef0f3}
  .brand svg{width:38px;height:38px;border-radius:10px;box-shadow:0 8px 18px -12px rgba(16,24,40,.6)}
  .brand b{display:block;font-size:14px;letter-spacing:-.01em}
  .brand span{display:block;font-size:11px;color:#98a2b3;font-family:"Songti SC","Noto Serif SC",serif}
  h1{font-size:18px;margin:0 0 4px}
  p.hint{font-size:12px;color:#98a2b3;margin:0 0 16px;line-height:1.6}
  ul{list-style:none;padding:0;margin:0}
  li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #eef0f3}
  li:last-child{border-bottom:0}
  a{color:#0E9F8A;font-weight:500;text-decoration:none;font-size:14px;word-break:break-all}
  .meta{color:#98a2b3;font-size:12px;white-space:nowrap}
  .empty{color:#98a2b3;font-size:13px;padding:12px 0}
</style></head>
<body><div class="card">
  <div class="brand">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="116" fill="#F3EDE2"/>
      <rect x="96" y="96" width="320" height="320" rx="40" fill="#B23A2E"/>
      <rect x="122" y="122" width="268" height="268" rx="26" fill="none"
            stroke="#F3EDE2" stroke-opacity="0.55" stroke-width="6"/>
      <path fill="#FBF4E8" d="M242.9 312.9 242.3 315.3C272.7 326.1 297.7 342.5 308.5 352.7C332.2 360.6 341.8 311.9 242.9 312.9ZM262.9 275.7 261.5 278.2C274.4 288.4 283.6 301.2 286.6 308.2C306.4 320.8 326.4 280.2 262.9 275.7ZM163.3 319 174.7 347.4C177 346.6 179 344.5 180 341.9C205.6 326.3 223.3 313.3 234.6 304.3L234.2 302.5C205.8 310 175.6 316.8 163.3 319ZM220.1 181.2 190.7 170.8C187.6 186.1 176.4 214.5 167.8 223.9C166 225.3 161.7 226.3 161.7 226.3L172.1 251.4C173.5 250.8 174.9 249.6 176.2 248.2C183.5 244.9 190.3 241.6 196.6 238.2C188.4 252.4 178.6 265.7 170.7 272.4C168.6 273.9 163.5 274.9 163.5 274.9L174.1 300.8C175.8 300 177.4 298.8 178.8 296.9C201.9 286.9 221.3 276.9 231.7 271L231.3 268.6C213.1 271.2 194.7 273.5 181.3 274.9C199.9 260.6 221.3 238.4 232.5 222.8C236.4 223.4 238.9 222 239.7 220L212.5 205.1C210.5 211 207.4 218.1 203.7 225.7C193.5 226.5 183.7 227.1 176.2 227.5C189.4 216.3 204.5 198.7 213.5 184.7C217.2 184.9 219.3 183.2 220.1 181.2ZM287.9 179.6 257.6 170.4C251.3 200.4 238.8 230.2 226 249L228.4 250.8C239.3 243 249.5 233.2 258.5 221.2C263.3 231.4 268.7 240.8 275.4 249.2C261.1 264.3 243.3 277.1 223.1 286.5L224.4 289C248.4 282.3 268.7 272.5 285.6 260.4C297.7 272.4 313.4 281.8 333.8 288.8C335.4 277.3 340.1 270.2 350.1 266.5L350.3 264.5C330.9 261 314 255.7 299.7 248.8C312.4 236.9 322.6 223.4 330.1 208.7C335 208.3 337.1 207.7 338.3 205.7L317.7 187.1L304.8 199.2H272.7C275.2 194.3 277.8 189.1 280.1 183.6C284.6 183.6 287.2 182 287.9 179.6ZM261.5 217.3C264.2 213.4 267 209.2 269.3 204.9H305C299.9 217.1 292.8 228.8 284 239.6C274.8 233.2 267.4 225.7 261.5 217.3Z"/>
    </svg>
    <div><b>有终</b><span>靡不有初，鲜克有终</span></div>
  </div>
  <h1>安卓安装包</h1>
  <p class="hint">手机浏览器打开本页点击下载，安装时允许「未知来源」。<br/>
  首次使用请在 App 内填写服务器地址，点「测试连接」后再登录。</p>
  ${files.length ? `<ul>${rows}</ul>` : '<p class="empty">还没有构建好的 APK。</p>'}
</div></body></html>`);
});

if (existsSync(APK_DIR)) {
  apkRouter.use('/apk', express.static(APK_DIR, { maxAge: '1h', fallthrough: true }));
}
