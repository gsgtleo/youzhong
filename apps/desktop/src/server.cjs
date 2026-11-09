'use strict';

/**
 * 本地静态服务器：把打包进来的网页端（apps/web/dist）用 http://127.0.0.1:port 提供出来。
 * 走 http 而不是 file:// 的原因：
 *  - 前端用 history 路由（/today、/calendar），file:// 下刷新会 404；
 *  - 服务端 CORS 只放行 localhost 来源，从 http://127.0.0.1:port 直连才是同策略的；
 *  - Service Worker / Web Notifications 在 file:// 下不可用。
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** 不缓存的固定文件名：外壳、Service Worker、manifest */
const NO_CACHE = new Set(['index.html', 'sw.js', 'manifest.webmanifest', 'registerSW.js']);

function statOf(file) {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}

function startStaticServer({ root, host = '127.0.0.1', port = 0 }) {
  const rootDir = path.resolve(root);
  const indexFile = path.join(rootDir, 'index.html');
  if (!statOf(indexFile)) {
    throw new Error(`网页端产物不存在：${indexFile}（先执行 npm run build:web）`);
  }

  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end('method not allowed');
      return;
    }

    let pathname = '/';
    try {
      pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('bad request');
      return;
    }

    // 供冒烟测试 / 排障用：确认本地壳已起来
    if (pathname === '/__local/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, root: rootDir }));
      return;
    }

    let file = path.resolve(rootDir, `.${pathname}`);
    if (file !== rootDir && !file.startsWith(rootDir + path.sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    let stat = statOf(file);
    if (stat && stat.isDirectory()) {
      file = path.join(file, 'index.html');
      stat = statOf(file);
    }

    // SPA 回退：/today 这类前端路由交给 index.html
    if (!stat || !stat.isFile()) {
      file = indexFile;
      stat = statOf(file);
    }
    if (!stat) {
      res.writeHead(404).end('not found');
      return;
    }

    const ext = path.extname(file).toLowerCase();
    const name = path.basename(file);
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Cache-Control': NO_CACHE.has(name) ? 'no-cache' : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const actual = server.address();
      const address = typeof actual === 'object' && actual ? actual.port : port;
      resolve({
        port: address,
        url: `http://${host}:${address}/`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

module.exports = { startStaticServer };
