const VERSION = 'focusbell-v1.0.0';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const APP_SCOPE = new URL('./', self.location.href).pathname;
const SHELL = [
  APP_SCOPE,
  `${APP_SCOPE}index.html`,
  `${APP_SCOPE}manifest.json`,
  `${APP_SCOPE}icon-192.png`,
  `${APP_SCOPE}icon-512.png`
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => (key.startsWith('focusbell-') || key.startsWith('adv-life-assist')) && ![SHELL_CACHE, RUNTIME_CACHE].includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then(cache => cache.put(`${APP_SCOPE}index.html`, copy));
          return response;
        })
        .catch(() => caches.match(`${APP_SCOPE}index.html`))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok) caches.open(RUNTIME_CACHE).then(cache => cache.put(request, response.clone()));
        return response;
      }))
    );
    return;
  }

  if (url.hostname === 'www.gstatic.com' && url.pathname.includes('/firebasejs/')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async cache => {
        const cached = await cache.match(request);
        const network = fetch(request).then(response => {
          if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || `${APP_SCOPE}index.html`;
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return clients.openWindow ? clients.openWindow(target) : undefined;
    })
  );
});
