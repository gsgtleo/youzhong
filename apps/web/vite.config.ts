import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const BUILD_ID = new Date().toISOString().slice(0, 16).replace('T', ' ');

/** 子路径部署前缀，始终以 / 结尾（根路径时就是 '/'） */
const BASE = (() => {
  const raw = process.env.VITE_BASE_PATH || '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
})();

export default defineConfig({
  // 子路径部署（如 https://host:19993/youzhong）时用 VITE_BASE_PATH=/youzhong/ 构建
  base: BASE,
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: '有终 · 靡不有初，鲜克有终',
        short_name: '有终',
        description: '有终（靡不有初，鲜克有终）：自托管任务管理客户端，含日历与四象限视图',
        lang: 'zh-CN',
        theme_color: '#0E9F8A',
        background_color: '#F7F8FA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: `${BASE}today`,
        scope: BASE,
        icons: [
          { src: `${BASE}icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: `${BASE}icon-maskable.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: `${BASE}index.html`,
        navigateFallbackDenylist: [/\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@youzhong/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:10078',
        changeOrigin: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
});
