/* Divisas BCV Service Worker */
const VERSION = '4';
const CACHE_NAME = `divisas-bcv-shell-v${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

// Install: cache shell, activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL.map(u => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

// Activate: clean old caches + take control
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

// Messaging: allow app to request update checks or skipWaiting (optional)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch strategy:
// - App shell (navigation) -> network-first (so updates arrive), fallback to cache
// - Static assets in shell -> cache-first
// - API calls (rates) -> network-only (never cache, always fresh)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  const sameOrigin = url.origin === self.location.origin;

  // Never cache API/third-party fetches (rates need to stay fresh)
  if (!sameOrigin) {
    return; // Let browser handle normally
  }

  // Navigation requests: network-first
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(new Request('./index.html', { cache: 'no-store' }));
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match('./index.html');
        return cached || Response.error();
      }
    })());
    return;
  }

  // Cache-first for known shell files
  if (APP_SHELL.includes(url.pathname.startsWith('/') ? '.'+url.pathname : url.pathname) ||
      APP_SHELL.includes(url.pathname) ||
      APP_SHELL.includes(url.pathname.replace(/^\//,'./'))) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, fresh.clone());
      return fresh;
    })());
    return;
  }

  // Default: network-first (but do not cache)
  event.respondWith((async () => {
    try {
      return await fetch(req);
    } catch (e) {
      // If offline and something was cached incidentally, serve it
      const cached = await caches.match(req);
      return cached || Response.error();
    }
  })());
});
