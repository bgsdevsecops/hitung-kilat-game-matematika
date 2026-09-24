const CACHE_NAME = 'hitung-kilat-v2-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
];

// Install: precache essential offline shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// Activate: clean up outdated caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Message listener: allow client to trigger skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: custom routing and offline resilience
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1. Only intercept GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 2. Only intercept same-origin requests
  if (url.origin !== self.location.origin) return;

  // 3. Strict Network-Only bypass for container runtime config and actuator
  if (
    url.pathname === '/firebase-config.js' ||
    url.pathname === '/actuator' ||
    url.pathname.startsWith('/actuator/')
  ) {
    return;
  }

  // 4. SPA Navigation requests (HTML documents) -> Network-First with cache fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            const cachePromise = caches.open(CACHE_NAME).then((cache) => {
              return cache.put('/index.html', responseClone);
            });
            event.waitUntil(cachePromise);
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // 5. Static Assets (/assets/*) -> Cache-First with dynamic caching
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            const cachePromise = caches.open(CACHE_NAME).then((cache) => {
              return cache.put(req, responseClone);
            });
            event.waitUntil(cachePromise);
          }
          return response;
        });
      })
    );
    return;
  }

  // 6. Other local static files (favicon, manifest, icons) -> Stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const revalidatePromise = fetch(req)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(req, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);

      event.waitUntil(revalidatePromise);
      return cached || revalidatePromise;
    })
  );
});
