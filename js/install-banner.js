/**
 * PWA install banner: top-fixed, dismissable.
 * Ditampilkan hanya bila:
 *  - bukan sudah PWA (display-mode: standalone / minimal-ui / fullscreen / iOS standalone)
 *  - belum di-dismiss dalam 30 hari terakhir (localStorage)
 *  - browser sempat fire `beforeinstallprompt` (Chrome/Edge/Opera/Chromium).
 *
 * Banner di-inject via JS supaya tidak ada HTML duplikat di index.html / index2.html
 * dan tidak menambah beban initial render (DOM baru dibuat saat event fire).
 *
 * Style: lihat kelas .pwa-install* di styles.css (override v2 di v2.css).
 */
(function () {
    'use strict';

    if (!('serviceWorker' in navigator)) return;

    var STORAGE_KEY = 'tlw.installBanner.dismissedAt';
    var DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari
    var HIDE_ANIM_MS = 220;

    function isPwaInstalled() {
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
        if (window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches) return true;
        if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) return true;
        // iOS Safari: window.navigator.standalone === true saat PWA
        if (window.navigator && window.navigator.standalone === true) return true;
        return false;
    }

    function isDismissedRecently() {
        try {
            var ts = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
            if (!ts) return false;
            return (Date.now() - ts) < DISMISS_TTL_MS;
        } catch (e) {
            return false;
        }
    }

    function persistDismiss() {
        try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (e) {}
    }

    if (isPwaInstalled() || isDismissedRecently()) return;

    var deferredPrompt = null;
    var banner = null;

    function buildBanner() {
        var el = document.createElement('div');
        el.id = 'pwaInstallBanner';
        el.className = 'pwa-install';
        el.setAttribute('role', 'region');
        el.setAttribute('aria-label', 'Install aplikasi TestLink Worker');
        el.hidden = true;
        el.innerHTML =
            '<div class="pwa-install__inner">' +
                '<div class="pwa-install__icon" aria-hidden="true">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        '<rect x="5" y="3" width="14" height="14" rx="2"/>' +
                        '<path d="M9 7h6M9 11h6M9 15h3"/>' +
                        '<path d="M12 17v3M9.5 21.5h5"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="pwa-install__text">' +
                    '<strong class="pwa-install__title">Install TestLink Worker</strong>' +
                    '<span class="pwa-install__sub">Akses cepat dari layar utama &middot; jalan offline.</span>' +
                '</div>' +
                '<div class="pwa-install__actions">' +
                    '<button type="button" class="pwa-install__btn pwa-install__btn--primary" id="pwaInstallPrimary">Install</button>' +
                    '<button type="button" class="pwa-install__btn pwa-install__btn--ghost" id="pwaInstallDismiss" aria-label="Tutup notifikasi install">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                            '<line x1="18" y1="6" x2="6" y2="18"/>' +
                            '<line x1="6" y1="6" x2="18" y2="18"/>' +
                        '</svg>' +
                    '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(el);

        el.querySelector('#pwaInstallPrimary').addEventListener('click', onPrimary);
        el.querySelector('#pwaInstallDismiss').addEventListener('click', onDismiss);

        return el;
    }

    function show() {
        if (!banner) banner = buildBanner();
        if (!banner.hidden) return;
        banner.hidden = false;
        // Trigger reflow sebelum tambah kelas animasi
        // (pakai rAF supaya transition transform terjalan konsisten)
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                banner.classList.add('pwa-install--visible');
            });
        });
    }

    function hide(persist) {
        if (!banner) return;
        banner.classList.remove('pwa-install--visible');
        setTimeout(function () {
            if (banner) banner.hidden = true;
        }, HIDE_ANIM_MS);
        if (persist) persistDismiss();
    }

    async function onPrimary() {
        if (!deferredPrompt) {
            // Browser tidak support prompt (mis. iOS Safari) — sembunyikan & diam.
            hide(true);
            return;
        }
        try {
            deferredPrompt.prompt();
            var choice = await deferredPrompt.userChoice;
            // Apapun hasilnya (accepted/dismissed), jangan tampilkan lagi untuk sesi ini
            hide(true);
        } catch (e) {
            hide(true);
        }
        deferredPrompt = null;
    }

    function onDismiss() {
        hide(true);
    }

    // Tangkap event sebelum browser menampilkan prompt otomatis
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;
        // Pastikan body sudah siap (SW mungkin masih register)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', show, { once: true });
        } else {
            show();
        }
    });

    // Setelah user berhasil install dari banner
    window.addEventListener('appinstalled', function () {
        deferredPrompt = null;
        hide(false);
    });
})();
