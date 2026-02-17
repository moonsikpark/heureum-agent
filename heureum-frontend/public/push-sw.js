/* Service Worker for native Web Push notifications */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Heureum', body: event.data.text() };
  }

  const title = payload.title || 'Heureum';
  const options = {
    body: payload.body || '',
    icon: '/favicon.svg',
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        if (clients.length > 0) {
          const client = clients[0];
          client.focus();
          if (event.notification.data) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: event.notification.data,
            });
          }
        } else {
          self.clients.openWindow('/');
        }
      }),
  );
});
