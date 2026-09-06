/* SparkFlow Service Worker — Web Push + 离线缓存 */
const CACHE_NAME = 'sparkflow-v2';

/* ========== Push 事件 ========== */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'SparkFlow', body: event.data.text() };
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    data: data.data || {},
    vibrate: [200, 100, 200],
    tag: data.tag || 'sparkflow-default',
    renotify: true,
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

/* ========== 通知点击 → 打开 PWA ========== */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 已有打开窗口则聚焦
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // 无窗口则打开新页面
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});

/* ========== 基础离线缓存（Install / Activate / Fetch） ========== */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    }),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 只缓存同源 GET 请求，跳过 API 请求和第三方资源。
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.url.includes('/api/')) return;

  // 页面导航始终先取最新部署，离线时再退回缓存。
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || fetched;
    }),
  );
});
