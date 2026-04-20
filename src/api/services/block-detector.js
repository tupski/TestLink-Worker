/**
 * Block Detector Service - Mendeteksi apakah URL/content diblokir
 */
const { BLOCK_PAGE_FRAGMENTS, BLOCK_HTML_MARKERS } = require('../config/constants');

class BlockDetector {
    /**
     * Cek apakah URL terlihat seperti halaman blokir berdasarkan URL-nya
     * @param {string} urlStr - URL string untuk dicek
     * @returns {boolean} True jika URL terlihat seperti halaman blokir
     */
    static detectByUrl(urlStr) {
        try {
            const u = new URL(urlStr);
            const h = (u.hostname + u.pathname).toLowerCase();
            return BLOCK_PAGE_FRAGMENTS.some((f) => h.includes(f));
        } catch {
            return false;
        }
    }

    /**
     * Cek apakah HTML content terlihat seperti halaman blokir
     * @param {string} html - HTML content untuk dicek
     * @returns {boolean} True jika HTML terlihat seperti halaman blokir
     */
    static detectByHtml(html) {
        if (!html || typeof html !== 'string') return false;
        const s = html.slice(0, 24000).toLowerCase();
        return BLOCK_HTML_MARKERS.some((m) => s.includes(m));
    }

    /**
     * Baca prefix response body (maksimal maxChars)
     * @param {Response} res - Response object dari fetch
     * @param {number} maxChars - Maksimal karakter yang dibaca
     * @returns {Promise<string>} Prefix content
     */
    static async readResponseBodyPrefix(res, maxChars) {
        try {
            if (!res.body) return '';
            const len = res.headers.get('content-length');
            if (len && parseInt(len, 10) > 600000) return '';
            
            const reader = res.body.getReader();
            const dec = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
            let out = '';
            
            while (out.length < maxChars) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value && value.length) {
                    out += dec.decode(value, { stream: true });
                    if (out.length >= maxChars) {
                        out = out.slice(0, maxChars);
                        try {
                            await reader.cancel();
                        } catch (e) {}
                        break;
                    }
                }
            }
            return out;
        } catch (e) {
            return '';
        }
    }

    /**
     * Resolve URL dengan mengikuti redirects
     * @param {string} startUrl - URL awal
     * @param {number} maxMs - Timeout maksimal dalam milidetik
     * @returns {Promise<Object>} Hasil pengecekan
     */
    static async resolveUrlWithRedirects(startUrl, maxMs = 12000) {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), maxMs);
        
        try {
            const res = await fetch(startUrl, {
                method: 'GET',
                redirect: 'follow',
                signal: ac.signal,
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            
            const finalUrl = res.url || startUrl;
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            let htmlPrefix = '';
            
            if (ct.includes('text/html') || ct.includes('application/xhtml') || ct.includes('text/plain') || !ct) {
                htmlPrefix = await this.readResponseBodyPrefix(res, 24000);
            }
            
            const urlHit = this.detectByUrl(finalUrl);
            const bodyHit = this.detectByHtml(htmlPrefix);
            
            return {
                ok: true,
                finalUrl,
                status: res.status,
                blocked: urlHit || bodyHit,
                urlHit,
                bodyHit
            };
        } catch (err) {
            return { ok: false, error: String(err.message || err), finalUrl: startUrl };
        } finally {
            clearTimeout(t);
        }
    }

    /**
     * Normalisasi URL (tambahkan https:// jika perlu)
     * @param {string} url - URL untuk dinormalisasi
     * @returns {string} URL yang dinormalisasi
     */
    static normalizeUrl(url) {
        url = String(url).trim().slice(0, 2048);
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        return url;
    }
}

module.exports = {
    BlockDetector
};