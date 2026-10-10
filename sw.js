// ============================================================
// Service Worker لتطبيق كزدورة — العمل بدون اتصال
// ============================================================

const CACHE_NAME = 'kzdora-v1';
const TILE_CACHE = 'kzdora-tiles-v1';
const ROUTE_CACHE = 'kzdora-routes-v1';

// الملفات الأساسية
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate.css',
  'https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate.js',
  'https://unpkg.com/osmbuildings@4.0.2/dist/OSMBuildings-Leaflet.js',
  'https://cdn.jsdelivr.net/npm/nosleep.js@0.12.0/dist/NoSleep.min.js'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_FILES).catch(err => {
        console.warn('Some core files failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// تفعيل SW وتنظيف الكاشات القديمة
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== TILE_CACHE && key !== ROUTE_CACHE)
            .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// اعتراض الطلبات
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. بلاطات الخريطة (OSM tiles) — Cache First
  if (url.hostname.includes('tile.openstreetmap.org') ||
      url.hostname.includes('basemaps.cartocdn.com')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(cache => {
        return cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) {
              // خزّن البلاطة (لا تنتظر الإكمال)
              cache.put(event.request, response.clone()).catch(() => {});
            }
            return response;
          }).catch(() => {
            // عند الفشل، أعد بلاطة رمادية
            return new Response('', { status: 503 });
          });
        });
      })
    );
    return;
  }

  // 2. طلبات OSRM (المسارات) — Network First مع تخزين
  if (url.hostname.includes('router.project-osrm.org')) {
    event.respondWith(
      caches.open(ROUTE_CACHE).then(cache => {
        return fetch(event.request).then(response => {
          if (response.ok) {
            cache.put(event.request, response.clone()).catch(() => {});
          }
          return response;
        }).catch(() => {
          return cache.match(event.request);
        });
      })
    );
    return;
  }

  // 3. باقي الطلبات — Network First مع Cache Fallback
  event.respondWith(
    fetch(event.request).then(response => {
      // خزّن النجاح فقط
      if (response.ok && event.request.method === 'GET') {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone).catch(() => {});
        });
      }
      return response;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});

// رسائل من التطبيق
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_TILES') {
    caches.delete(TILE_CACHE);
  }
  if (event.data && event.data.type === 'PREFETCH_AREA') {
    // يمكن استخدامها لتنزيل منطقة كاملة مسبقاً
    console.log('Prefetch requested for:', event.data);
  }
});
