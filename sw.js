// Service worker: recibe los avisos push y, al pulsarlos, abre directamente la incidencia.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let d = { title: '🔔 Mantenimiento', body: 'Nueva alerta', url: self.registration.scope };
  try { d = Object.assign(d, event.data.json()); } catch (e) { /* aviso sin datos */ }
  event.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: d.tag || d.url,            // evita duplicados del mismo aviso
    renotify: true,
    requireInteraction: d.urgency === 'CRITICA' || d.urgency === 'ALTA',   // las urgentes no se ocultan solas
    vibrate: d.urgency === 'CRITICA' ? [300, 120, 300, 120, 300] : [200],
    data: { url: d.url },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) {
        try { await c.focus(); if ('navigate' in c) await c.navigate(url); else c.postMessage({ goto: url }); return; } catch (e) { /* abrir nueva */ }
      }
    }
    await self.clients.openWindow(url);
  })());
});
