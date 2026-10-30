/**
 * DisasterReady India — Service Worker
 * Handles App Shell caching, offline navigation fallback, and offline static assets.
 */
const CACHE_NAME = 'disasterready-v1.2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/api-client.js',
  '/route-comparison.js',
  '/screens/01-language-location/index.html',
  '/screens/02-citizen-dashboard/index.html',
  '/screens/03-get-to-safety-step-1/index.html',
  '/screens/04-get-to-safety-step-2/index.html',
  '/screens/05-get-to-safety-step-4/index.html',
  '/screens/06-get-to-safety-step-5/index.html',
  '/screens/07-safe-places/index.html',
  '/screens/08-emergency-relief/index.html',
  '/screens/09-relief-tracking/index.html',
  '/screens/10-relief-tracking-alternative/index.html',
  '/screens/11-preparedness/index.html',
  '/screens/12-emergency-help/index.html',
  '/screens/13-staff-login/index.html',
  '/screens/14-authority-dashboard/index.html',
  '/screens/15-staff-tools-settings/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Best effort pre-caching of app shell assets
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('Some app shell files failed to pre-cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. NEVER cache staff authority APIs or sensitive admin mutation endpoints on shared devices
  if (url.pathname.includes('/authority/') || url.pathname.includes('/auth/')) {
    return; // Bypass Service Worker cache completely
  }

  // 2. Network-first with cache fallback for public civil data
  if (url.pathname.startsWith('/api/v1/')) {
    // Only GET requests for alerts/preparedness/facilities can be cached for offline fallback
    if (event.request.method === 'GET') {
      event.respondWith(
        fetch(event.request)
          .then((networkRes) => {
            if (networkRes.ok) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkRes;
          })
          .catch(async () => {
            const cached = await caches.match(event.request);
            if (cached) return cached;
            return new Response(
              JSON.stringify({
                success: false,
                error: { code: 'OFFLINE_NO_CACHE', message: 'You are currently offline and no cached version is available.' },
              }),
              { headers: { 'Content-Type': 'application/json' }, status: 503 }
            );
          })
      );
    }
    return;
  }

  // 3. Stale-while-revalidate for static scripts, fonts, stylesheets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkRes) => {
          if (networkRes.ok && event.request.method === 'GET') {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
