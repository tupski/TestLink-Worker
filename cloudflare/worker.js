/**
 * Reverse proxy penuh ke backend (mis. deployment Vercel).
 *
 * Tanpa ini, Worker yang hanya meneruskan /api/* membuat GET / dan /sw.js jadi 404
 * walau /api/settings tetap 200 (sama seperti log Anda).
 *
 * Setup:
 *   cd cloudflare
 *   npx wrangler deploy
 *   npx wrangler secret put BACKEND_URL
 *   (isi: https://nama-proyek-anda.vercel.app  tanpa slash di akhir)
 *
 * Atau di dashboard Workers: Variables → BACKEND_URL
 */

export default {
    async fetch(request, env) {
        const base = String(env.BACKEND_URL || '')
            .trim()
            .replace(/\/$/, '');
        if (!base.startsWith('http')) {
            return new Response(
                'Worker: set secret BACKEND_URL = https://testlink-worker.vercel.app',
                { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }
            );
        }

        const incoming = new URL(request.url);
        const target = `${base}${incoming.pathname}${incoming.search}`;

        const headers = new Headers(request.headers);
        const backendHost = new URL(base).host;
        headers.set('Host', backendHost);
        headers.set('X-Forwarded-Host', incoming.host);
        headers.set('X-Forwarded-Proto', incoming.protocol.replace(':', ''));

        return fetch(target, {
            method: request.method,
            headers,
            body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
            redirect: 'follow'
        });
    }
};
