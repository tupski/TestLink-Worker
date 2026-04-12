/* Minimal SW — cache shell app; bump CACHE untuk invalidate */
const CACHE = 'testlink-v2';
const ASSETS = ['/', '/index.html', '/about.html', '/css/styles.css', '/js/app.js', '/js/countdown-worker.js', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const u = new URL(e.request.url);
    if (u.origin !== self.location.origin) return;
    if (e.request.method !== 'GET') return;
    if (u.pathname.startsWith('/api')) return;
    e.respondWith(
        caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
            const copy = res.clone();
            if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
            return res;
        }))
    );
});
