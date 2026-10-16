/* Bubble "Tersedia tampilan lain" (v1 & v2).
 * Ditampilkan di atas konten, di bawah topbar. Dismissable: klik X.
 * State disimpan di localStorage (key berbeda per arah) agar tidak muncul lagi.
 *
 * v1 → bubble mengarah ke index2.html (v2).
 * v2 → bubble mengarah ke /         (v1). */
(function () {
    'use strict';

    var isV2 = document.body.classList.contains('v2-body');
    var DISMISS_KEY = isV2 ? 'tlw.oldUiBubble.dismissed' : 'tlw.newUiBubble.dismissed';

    // Sudah ditutup sebelumnya? Jangan muncul lagi.
    if (localStorage.getItem(DISMISS_KEY)) return;

    function init() {
        if (document.getElementById('newUiBubble') || document.getElementById('oldUiBubble')) return;

        var bubble = document.createElement('div');
        var id;
        var iconPath, label, ctaLabel, target;
        if (isV2) {
            id = 'oldUiBubble';
            iconPath = '<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-3a1 1 0 011-1h2a1 1 0 011 1v3a1 1 0 001 1m-6 0h6"/>';
            label = 'Tersedia tampilan lama';
            ctaLabel = 'Buka';
            target = '/';
        } else {
            id = 'newUiBubble';
            iconPath = '<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z"/>';
            label = 'Tampilan baru tersedia';
            ctaLabel = 'Coba sekarang';
            target = '/index2.html';
        }

        bubble.id = id;
        bubble.className = 'new-ui-bubble';
        bubble.setAttribute('role', 'status');
        bubble.setAttribute('aria-label', label);
        bubble.innerHTML =
            '<span class="new-ui-bubble__icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            iconPath +
            '</svg>' +
            '</span>' +
            '<span class="new-ui-bubble__text">' + label + '</span>' +
            '<a href="' + target + '" class="new-ui-bubble__cta">' + ctaLabel + '</a>' +
            '<button type="button" class="new-ui-bubble__close" aria-label="Tutup notifikasi">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M18 6L6 18M6 6l12 12"/>' +
            '</svg>' +
            '</button>';
        document.body.appendChild(bubble);

        // Animasi masuk: slide-down + fade.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { bubble.classList.add('is-visible'); });
        });

        // Tutup handler.
        bubble.querySelector('.new-ui-bubble__close').addEventListener('click', function dismiss() {
            bubble.classList.remove('is-visible');
            setTimeout(function () { bubble.remove(); }, 300);
            try { localStorage.setItem(DISMISS_KEY, new Date().toISOString()); } catch (e) {}
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();