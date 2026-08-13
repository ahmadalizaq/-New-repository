/* ============================================================
   FEEL — sw.js (Service Worker)
   بيستقبل إشعارات الـ Push ويعرضها، حتى لو الموقع مسكّر بالكامل
   (بس التاب لازم يكون انفتح مرة واحدة قبل هيك حتى ينسجل).
   ============================================================ */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'FEEL', body: event.data ? event.data.text() : '' }; }

  const title = data.title || 'FEEL';
  const options = {
    body: data.body || '',
    icon: data.icon || 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2764.png',
    badge: data.badge || 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2764.png',
    data: { route: data.route || 'home', params: data.params || {} },
    dir: 'rtl',
    lang: 'ar',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const route = event.notification.data && event.notification.data.route ? event.notification.data.route : 'home';
  const params = event.notification.data && event.notification.data.params ? event.notification.data.params : {};
  const targetUrl = self.registration.scope + '?route=' + encodeURIComponent(route) + '&params=' + encodeURIComponent(JSON.stringify(params));

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'FEEL_NOTIFICATION_CLICK', route, params });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
