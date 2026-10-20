/**
 * Cek apakah runtime yang melayani sebuah URL sudah memuat endpoint backup/restore.
 *
 * Jalankan: node scripts/check-deploy.js https://tl.artupski.com
 *
 * Status 404 dari handler fallback = proses Node masih build lama (route belum ada).
 * Status 403/503 = route ada, hanya perlu sandi admin yang benar.
 */
const http = require('http');
const https = require('https');

const base = String(process.argv[2] || '').trim().replace(/\/$/, '');
if (!/^https?:\/\//i.test(base)) {
    console.error('Pakai: node scripts/check-deploy.js https://domain-anda');
    process.exit(2);
}

function probe(path) {
    const url = new URL(base + path);
    const lib = url.protocol === 'https:' ? https : http;
    return new Promise((resolve) => {
        const req = lib.request(
            {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port || undefined,
                path: url.pathname + url.search,
                method: 'GET',
                timeout: 15000
            },
            (res) => {
                let body = '';
                res.on('data', (c) => (body += c));
                res.on('end', () => resolve({ status: res.statusCode, body: body.slice(0, 300) }));
            }
        );
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', (e) => resolve({ status: 0, body: String(e.message || e) }));
        req.end();
    });
}

(async () => {
    const checks = [
        ['/api/backup', (s) => (s === 404 ? 'route belum ada di runtime' : 'route ada')],
        ['/api/sites', (s) => (s === 200 ? 'route inti hidup' : 'route inti bermasalah')]
    ];
    let stale = false;
    for (const [path, verdict] of checks) {
        const r = await probe(path);
        console.log(`${path} -> ${r.status || 'ERR'} (${verdict(r.status)})`);
        if (path === '/api/backup' && r.status === 404) {
            stale = true;
            console.log(`   body: ${r.body}`);
        }
    }
    console.log(
        stale
            ? '\nHASIL: runtime masih build lama. Pull kode terbaru lalu restart proses Node di server.'
            : '\nHASIL: endpoint backup/restore sudah terpasang di runtime.'
    );
    process.exitCode = stale ? 1 : 0;
})();
