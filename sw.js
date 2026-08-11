/**
 * Pixelary Service Worker — Phase 4 (User Uploads)
 * Cache-first for static assets, network-first for data, with offline fallback.
 * Range-request aware for video streaming (partial content).
 * Serves Wikimedia Commons, Internet Archive, and catbox.moe (user uploads).
 */

const CACHE_VERSION = 'pixelary-v4.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const VIDEO_CACHE = `${CACHE_VERSION}-videos`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './videos.html',
  './video.html',
  './reels.html',
  './photo.html',
  './about.html',
  './upload.html',
  './submit.html',
  './legal.html',
  './404.html',
  './assets/css/style.css',
  './assets/css/reels.css',
  './assets/css/upload.css',
  './assets/js/ui.js',
  './assets/js/db.js',
  './assets/js/app.js',
  './assets/js/photo.js',
  './assets/js/videos.js',
  './assets/js/video.js',
  './assets/js/video-player.js',
  './assets/js/reels.js',
  './assets/js/upload.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch((err) => console.warn('SW: cache addAll error', err)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== 'GET') return;

  // Skip cross-origin except fonts, wikimedia, Internet Archive, and catbox.moe (user uploads)
  const isSameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isWikimedia = url.hostname.endsWith('wikimedia.org') || url.hostname.endsWith('wikipedia.org');
  const isArchiveOrg = url.hostname === 'archive.org' || url.hostname.endsWith('.archive.org');
  const isCatbox = url.hostname === 'catbox.moe' || url.hostname === 'files.catbox.moe';
  const isGitHubApi = url.hostname === 'api.github.com';

  // Don't intercept GitHub API calls (they need their own auth headers)
  if (isGitHubApi) return;

  if (!isSameOrigin && !isFont && !isWikimedia && !isArchiveOrg && !isCatbox) return;

  // ---------- Range requests (video streaming) ----------
  // For video files from wikimedia or archive.org, we MUST respect the Range header.
  // Cache a small video segment only if it's a 206 response and small enough.
  const isVideoReq = (
    req.destination === 'video' ||
    (isWikimedia && (url.pathname.endsWith('.webm') || url.pathname.endsWith('.ogv') || url.pathname.endsWith('.mp4'))) ||
    (isArchiveOrg && url.pathname.endsWith('.mp4'))
  );

  if (isVideoReq) {
    // Network-first with range support; do NOT cache large videos
    event.respondWith(
      fetch(req, { headers: req.headers })
        .then((res) => {
          // Only cache small successful responses (under 5 MB)
          const size = parseInt(res.headers.get('content-length') || '0', 10);
          if (res.ok && size > 0 && size < 5 * 1024 * 1024 && res.status === 200) {
            const copy = res.clone();
            caches.open(VIDEO_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => {
          // Try cache fallback (may have partial content)
          return caches.match(req).then((cached) => cached || Response.error());
        })
    );
    return;
  }

  // ---------- Data: network-first ----------
  if (isSameOrigin && url.pathname.startsWith('/data/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(DATA_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // ---------- Images (wikimedia + archive.org + catbox.moe thumbnails): stale-while-revalidate ----------
  if ((isWikimedia || isArchiveOrg || isCatbox) && (req.destination === 'image' || url.pathname.includes('/thumb/') || url.pathname.match(/\.(jpg|jpeg|png|webp)$/i))) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req).then((res) => {
            cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // ---------- Catbox.moe video streaming (user uploads): network-first with range support ----------
  if (isCatbox && (req.destination === 'video' || url.pathname.match(/\.(mp4|webm|mov)$/i))) {
    event.respondWith(
      fetch(req, { headers: req.headers })
        .then((res) => {
          const size = parseInt(res.headers.get('content-length') || '0', 10);
          if (res.ok && size > 0 && size < 20 * 1024 * 1024 && res.status === 200) {
            const copy = res.clone();
            caches.open(VIDEO_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || Response.error()))
    );
    return;
  }

  // ---------- Static assets: cache-first ----------
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
