const CACHE_NAME = 'divisas-bcv-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

// URLs que NO deben cachearse nunca (tasas/APIs/proxy)
const NO_CACHE_PATTERNS = [
  'corsproxy.io') || url.includes('allorigins.win/',
  'api.dolarvzla.com/',
  've.dolarapi.com/',
  'criptoya.com/',
  'open.er-api.com/',
  'cdn.jsdelivr.net/'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // limpiar caches viejas
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nunca cachear APIs/tasas (siempre red, sin store)
  if (NO_CACHE_PATTERNS.some(p => url.href.includes(p))) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // Navegación: network-first para que GitHub Pages entregue index actualizado
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match('./index.html');
        return cached || caches.match('./');
      }
    })());
    return;
  }

  // Estáticos: cache-first
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
