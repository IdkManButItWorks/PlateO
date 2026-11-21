// Service worker for PlateO.
// Keeps the app working offline: the page and its icons are cached on install,
// and Google Fonts are cached the first time they load.
// Bump VERSION whenever you want every installed copy to drop its old cache.
const VERSION = 'v4';
const APP_CACHE = 'flex-plate-app-' + VERSION;
const FONT_CACHE = 'flex-plate-fonts-' + VERSION;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Remove caches left over from older versions.
self.addEventListener('activate', event => {
  const keep = [APP_CACHE, FONT_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // The page itself: try the network first so new deploys show up right away,
  // and fall back to the cached copy when offline.
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(APP_CACHE).then(cache => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Google Fonts: the stylesheet is refreshed in the background, the font files are
  // served from cache once saved (they never change at a given URL).
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(req).then(cached => {
          const network = fetch(req)
            .then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; })
            .catch(() => cached);
          return url.hostname === 'fonts.gstatic.com' && cached ? cached : (cached || network);
        })
      )
    );
    return;
  }

  // Everything else from this site (manifest, icons): cache first, then network.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(APP_CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      }))
    );
  }
});
