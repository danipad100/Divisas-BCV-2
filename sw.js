/* Divisas BCV Service Worker — con sistema de versionado */
const VERSION = 'v1_2';
const CACHE_NAME = 'divisas-bcv-' + VERSION;

const URLS_TO_CACHE = [
  './',
  './index.html'
];

const URLS_OPTIONAL = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

// Install: cache shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(URLS_TO_CACHE);
      await Promise.allSettled(URLS_OPTIONAL.map(url =>
        cache.add(url).catch(e => console.warn('[SW] No se pudo cachear:', url, e.message))
      ));
    })
  );
});

// Activate: clean old caches + take control
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : null));
      await self.clients.claim();
    })()
  );
});

// Messages: SKIP_WAITING + GET_VERSION
self.addEventListener('message', event => {
  const data = event && event.data ? event.data : null;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (data.type === 'GET_VERSION') {
    try {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ type: 'VERSION', version: VERSION });
      }
    } catch(e) {}
  }
});

// Fetch: bypass API domains, cache-first for same-origin
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache API / third-party fetches (rates need to stay fresh)
  if (
    url.hostname.includes('dolarapi.com') ||
    url.hostname.includes('ve.dolarapi.com') ||
    url.hostname.includes('criptoya.com') ||
    url.hostname.includes('dolarvzla.com') ||
    url.hostname.includes('corsproxy.io') ||
    url.hostname.includes('open.er-api.com') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('allorigins.win') ||
    url.hostname.includes('bcv.org.ve') ||
    url.hostname.includes('codetabs.com')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Same-origin: cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(resp => {
        try {
          if (url.origin === self.location.origin) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
          }
        } catch(e) {}
        return resp;
      });
    })
  );
});
