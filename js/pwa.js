/**
 * PWA: registrasi service worker + banner "versi baru tersedia".
 * Dipakai oleh index.html dan admin.html.
 */
(function () {
    if (!('serviceWorker' in navigator)) return;

    // Banner update (dibuat sekali, tersembunyi)
    function ensureBanner() {
        let el = document.getElementById('appUpdateBanner');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'appUpdateBanner';
        el.className = 'hidden fixed left-1/2 -translate-x-1/2 bottom-4 z-[3000] w-[calc(100%-2rem)] max-w-sm card !p-4 flex items-center gap-3';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.innerHTML = `
            <p class="text-sm text-slate-300 flex-1">Versi baru TestLink tersedia.</p>
            <button type="button" id="appUpdateReload" class="btn btn--primary !min-h-0 !py-2 !px-3 text-xs">Muat ulang</button>
            <button type="button" id="appUpdateDismiss" class="btn btn--ghost !min-h-0 !p-2" aria-label="Tutup">×</button>`;
        document.body.appendChild(el);
        el.querySelector('#appUpdateReload').addEventListener('click', () => {
            navigator.serviceWorker.getRegistration().then((reg) => {
                const waiting = reg && reg.waiting;
                if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
                setTimeout(() => window.location.reload(), 150);
            });
        });
        el.querySelector('#appUpdateDismiss').addEventListener('click', () => el.classList.add('hidden'));
        return el;
    }

    function showBanner() {
        const el = ensureBanner();
        el.classList.remove('hidden');
    }

    navigator.serviceWorker.addEventListener('message', (ev) => {
        if (ev.data && ev.data.type === 'APP_UPDATED') showBanner();
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .then((reg) => {
                if (reg.waiting) showBanner();
                reg.addEventListener('updatefound', () => {
                    const sw = reg.installing;
                    if (!sw) return;
                    sw.addEventListener('statechange', () => {
                        if (sw.state === 'installed' && navigator.serviceWorker.controller) showBanner();
                    });
                });
            })
            .catch(() => {});
    });
})();
