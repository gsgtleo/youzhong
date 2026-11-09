import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

/**
 * Service Worker 自更新：
 * 旧版本缓存会导致「界面没有新功能 + 接口 404/NetworkError」，因此这里
 * 1) 每次加载主动 update()；2) 发现新 SW 立即 skipWaiting；
 * 3) controllerchange 后自动 reload 一次，保证页面与 SW 版本一致。
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then((registration) => {
      void registration.update();
      setInterval(() => void registration.update(), 30 * 60 * 1000);
    })
    .catch((error) => console.error('[pwa] Service Worker 注册失败', error));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    window.location.reload();
  });
}
