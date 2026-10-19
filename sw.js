/* Minimal SW: cache shell app; bump CACHE untuk invalidate */
const CACHE = 'testlink-v20';
const ASSETS = ['/', '/index.html', '/admin.html', '/about.html', '/CHANGELOG.md', '/css/tailwind-built.css', '/css/components.css', '/css/styles.css', '/js/utils.js', '/js/dialog.js', '/js/app.js', '/js/admin.js', '/js/admin-links.js', '/js/pwa.js', '/js/install-banner.js', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/apple-touch-icon.png'];

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

self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/** Beri tahu semua tab saat SW versi baru mengambil alih. */
function notifyClients(message) {
    self.clients.matchAll({ type: 'window' }).then((list) => {
        list.forEach((client) => client.postMessage(message));
    });
}

self.addEventListener('activate', () => notifyClients({ type: 'APP_UPDATED' }));

self.addEventListener('fetch', (e) => {
    const u = new URL(e.request.url);
    if (u.origin !== self.location.origin) return;
    if (e.request.method !== 'GET') return;
    if (u.pathname.startsWith('/api')) return;
    // Halaman review index2.html + css v2: jangan di-cache sampai promosi
    if (u.pathname === '/index2.html' || u.pathname === '/css/v2.css') return;
    e.respondWith(
        caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
            const copy = res.clone();
            if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
            return res;
        }))
    );
});
