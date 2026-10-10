const CACHE_NAME = 'kzdora-v2';
const TILE_CACHE = 'kzdora-tiles-v3';
const ROUTE_CACHE = 'kzdora-routes-v3';

const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
  'https://cdn.jsdelivr.net/npm/nosleep.js@0.12.0/dist/NoSleep.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME && k !== TILE_CACHE && k !== ROUTE_CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone()).catch(() => {});
            return response;
          });
        })
      )
    );
    return;
  }

  if (url.hostname.includes('router.project-osrm.org') || url.hostname.includes('valhalla')) {
    event.respondWith(
      caches.open(ROUTE_CACHE).then(cache =>
        fetch(event.request).then(response => {
          if (response.ok) cache.put(event.request, response.clone()).catch(() => {});
          return response;
        }).catch(() => cache.match(event.request))
      )
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok && event.request.method === 'GET') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone).catch(() => {}));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
