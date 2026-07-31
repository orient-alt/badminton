// Deliberately minimal service worker: it exists so the app is installable
// (Add to Home Screen) and opens instantly on flaky gym wifi, without ever
// serving a stale copy of the app when a new version has been deployed.
//
// Strategy: network-first for page loads (fresh deploys always win), with the
// last good copy as an offline fallback. Static icons are cached on first use.
const CACHE = 'badminton-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Page navigations: try the network, fall back to the cached page offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Same-origin static assets (icons, manifest): cache-first, they rarely change.
  const url = new URL(req.url);
  if (url.origin === location.origin && (url.pathname.includes('/icons/') || url.pathname.endsWith('.webmanifest'))) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
  }
});
