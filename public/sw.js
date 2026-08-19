const CACHE_NAME = 'rivet-roulette-v4';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'favicon.svg',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'manifest.webmanifest',
  'js/app.js',
  'js/deck.js',
  'js/lines.js',
  'js/prizes.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only intercept HTTP/S requests (avoids chrome-extension or data schemes)
  if (event.request.url.startsWith('http')) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
        if (cachedResponse) {
          // Perform a background fetch to update the cache (stale-while-revalidate)
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, networkResponse);
                });
              }
            })
            .catch(() => { /* Ignore network errors */ });
          return cachedResponse;
        }
        return fetch(event.request).catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('index.html', { ignoreSearch: true });
          }
          throw new Error('Offline asset unavailable');
        });
      })
    );
  }
});
