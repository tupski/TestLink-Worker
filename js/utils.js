/**
 * Utils bersama TestLink: satu sumber escape HTML/atribut + validasi skema URL.
 *
 * Dimuat sebagai classic script di ketiga halaman SEBELUM app.js/admin.js/admin-links.js.
 * Ekspor UMD-lite (`module.exports` bila tersedia) agar bisa diuji via `node:test`.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.escapeHtml = api.escapeHtml;
        root.escapeAttr = api.escapeAttr;
        root.isSafeHttpUrl = api.isSafeHttpUrl;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    /**
     * Escape untuk konteks teks HTML: & < > " '.
     * null/undefined -> '' (bukan string "null"/"undefined").
     */
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Escape untuk nilai yang dirender di dalam atribut ber-quote
     * (mis. `data-key="${escapeAttr(x)}"`). Saat ini sama ketat dengan escapeHtml;
     * dipisah agar perubahan aturan atribut ke depan tidak menyentuh konteks teks.
     */
    function escapeAttr(s) {
        return escapeHtml(s);
    }

    /**
     * true hanya untuk URL absolut dengan skema http/https.
     * Dipakai sebelum merender href yang bisa diklik (mis. Link Manager).
     */
    function isSafeHttpUrl(u) {
        if (typeof u !== 'string') return false;
        const v = u.trim();
        if (v === '') return false;
        try {
            const parsed = new URL(v);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    return { escapeHtml: escapeHtml, escapeAttr: escapeAttr, isSafeHttpUrl: isSafeHttpUrl };
});
