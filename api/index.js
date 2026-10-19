require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1);

/**
 * CORS: aplikasi ini same-origin (Express juga menyajikan halaman statis).
 * Origin tambahan hanya dari ALLOWED_ORIGINS (dipisah koma).
 */
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

app.use(
    cors({
        origin(origin, cb) {
            if (!origin) return cb(null, true); // same-origin / non-browser
            if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
            try {
                const host = new URL(origin).host;
                if (host === ALLOWED_ORIGINS[0]) return cb(null, true);
            } catch (e) {}
            return cb(null, false);
        }
    })
);
app.use(express.json({ limit: '10mb' }));

/** Root proyek: di Vercel, includeFiles membawa file ke /var/task. */
function resolveProjectRoot() {
    // 1. Coba dari process.cwd() (seringkali root di Vercel)
    const cwd = process.cwd();
    if (fs.existsSync(path.join(cwd, 'index.html'))) return cwd;

    // 2. Coba naik dari __dirname (jika di api/index.js)
    let dir = path.resolve(__dirname);
    if (dir.endsWith('api')) dir = path.dirname(dir);
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;

    // 3. Fallback standar
    return path.resolve(path.join(__dirname, '..'));
}
const ROOT = resolveProjectRoot();
console.log(`📂 Project ROOT set to: ${ROOT}`);

/** Hostname / path fragment redirect halaman blokir (Kominfo / operator) */
const BLOCK_PAGE_FRAGMENTS = [
    'internet-positif',
    'internetpositif',
    'trustpositif',
    'nawala',
    'merdeka.com/block',
    'blockpage.xlaxiata',
    'xlaxiata.co.id/block',
    'aduankonten',
    'lamanlabuh',
    'komdigi',
    'kominfo',
    'walled-garden',
    'walledgarden',
    'captive.apple',
    'telkomsel.com/block',
    'indihome.co.id/block',
    'axis.net/block',
    'access-denied'
];

function urlLooksBlocked(urlStr) {
    try {
        const u = new URL(urlStr);
        const h = (u.hostname + u.pathname).toLowerCase();
        return BLOCK_PAGE_FRAGMENTS.some((f) => h.includes(f));
    } catch {
        return false;
    }
}

/** Pola di HTML halaman blokir (domain bisa tetap “normal”, isi yang memberi tahu) */
const BLOCK_HTML_MARKERS = [
    'internet-positif',
    'internet positif',
    'internetpositif',
    'trustpositif',
    'trust positif',
    'lamanlabuh',
    'aduankonten',
    'blockpage',
    'situs yang anda buka',
    'tidak dapat diakses',
    'negative content',
    'konten yang melanggar',
    'pembatasan akses',
    'nawala',
    'internet sehat',
    'filtered access',
    'access to this site',
    'diblokir',
    'halaman pemblokiran',
    'walled garden',
    'captive portal',
    'komdigi'
];

function htmlLooksBlocked(html) {
    if (!html || typeof html !== 'string') return false;
    const s = html.slice(0, 24000).toLowerCase();
    return BLOCK_HTML_MARKERS.some((m) => s.includes(m));
}

async function readResponseBodyPrefix(res, maxChars) {
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

async function resolveUrlWithRedirects(startUrl, maxMs) {
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
            htmlPrefix = await readResponseBodyPrefix(res, 24000);
        }
        const urlHit = urlLooksBlocked(finalUrl);
        const bodyHit = htmlLooksBlocked(htmlPrefix);
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

const isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_URL) || process.env.VERCEL_ENV === 'production';
const dbFolder = isVercel ? '/tmp' : path.join(ROOT, 'data');
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
}
const dbPath = path.join(dbFolder, 'database.sqlite');

if (isVercel && !fs.existsSync(dbPath)) {
    const bundledDb = path.join(ROOT, 'data', 'database.sqlite');
    if (fs.existsSync(bundledDb)) {
        fs.copyFileSync(bundledDb, dbPath);
        console.log('💾 Copied bundled SQLite DB to /tmp for Vercel');
    }
}

const db = new sqlite3.Database(dbPath);

console.log(`💾 Using ${isVercel ? 'Vercel /tmp' : 'Local'} SQLite Database at: ${dbPath}`);
if (isVercel) {
    console.warn('⚠️ Warning: Data stored in /tmp will be lost when the server restarts on Vercel.');
}

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        name TEXT,
        links TEXT,
        created_at DATETIME
    )`, (err) => {
        if (!err) {
            db.run(`ALTER TABLE sites ADD COLUMN sort_order INTEGER DEFAULT 0`, () => {});
            db.run(`ALTER TABLE sites ADD COLUMN is_active INTEGER DEFAULT 1`, () => {});
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS progress (
        device_id TEXT,
        site_id TEXT,
        last_index INTEGER DEFAULT 0,
        normal_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        PRIMARY KEY (device_id, site_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT,
        site_name TEXT,
        diff_summary TEXT,
        diff_details TEXT,
        created_at DATETIME
    )`, (err) => {
        if (!err) {
            db.run(`ALTER TABLE history ADD COLUMN diff_details TEXT`, () => {});
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS kv_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )`, () => {
        const seeds = [
            ['app_title', 'Test Link'],
            ['app_tagline', 'Runner link & cek koneksi, satu layar.'],
            ['default_interval', '3'],
            ['maintenance_mode', '0'],
            ['maintenance_message', ''],
            ['about_page_title', 'Tentang Test Link'],
            [
                'about_page_body',
                'Test Link membantu tim menjalankan daftar URL dengan progres per perangkat, cek koneksi/DNS, dan riwayat perubahan dari admin.\n\nGunakan mode fokus-tab untuk validasi manual, atau mode jeda otomatis untuk throughput lebih tinggi di tab yang sama.'
            ]
        ];
        seeds.forEach(([k, v]) => {
            db.run(`INSERT OR IGNORE INTO kv_settings (key, value) VALUES (?, ?)`, [k, v]);
        });
    });
});

/** Fungsi untuk mendapatkan waktu saat ini dalam zona WIB (UTC+7) */
function getNowWIB() {
    const now = new Date();
    const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
    const year = wibTime.getFullYear();
    const month = String(wibTime.getMonth() + 1).padStart(2, '0');
    const day = String(wibTime.getDate()).padStart(2, '0');
    const hours = String(wibTime.getHours()).padStart(2, '0');
    const minutes = String(wibTime.getMinutes()).padStart(2, '0');
    const seconds = String(wibTime.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Backup/restore kategori + link.
 * Normalisasi & validasi payload dijalankan di server agar hasil restore konsisten
 * baik file dibuat oleh versi ini maupun file lama/manual.
 */

/** Ubah link (string dokumen atau array) jadi array URL bersih, satu per entri. */
function normalizeLinkList(raw) {
    let items = [];
    if (Array.isArray(raw)) items = raw;
    else if (typeof raw === 'string') items = raw.split(/\r?\n/);
    return items
        .map((l) => String(l == null ? '' : l).trim())
        .filter(Boolean)
        .map((l) => (/^[a-z][a-z0-9+.-]*:\/\//i.test(l) ? l : `https://${l}`));
}

/**
 * Validasi payload backup jadi { entries, skipped }.
 * Tiap entri: { id, name, links: string[], isActive, sortOrder }.
 */
function normalizeBackupPayload(payload) {
    const rawSites = Array.isArray(payload) ? payload : payload && Array.isArray(payload.sites) ? payload.sites : null;
    if (!rawSites) throw new Error('Format backup tidak dikenali (butuh field "sites").');

    const entries = [];
    let skipped = 0;
    rawSites.slice(0, 1000).forEach((site) => {
        if (!site || typeof site !== 'object') {
            skipped++;
            return;
        }
        const name = String(site.name == null ? '' : site.name)
            .trim()
            .slice(0, 200);
        const links = normalizeLinkList(site.links);
        if (!name || links.length === 0) {
            skipped++;
            return;
        }
        const activeRaw = site.is_active != null ? site.is_active : site.isActive;
        const orderRaw = site.sort_order != null ? site.sort_order : site.sortOrder;
        entries.push({
            id: typeof site.id === 'string' && site.id.trim() ? site.id.trim().slice(0, 100) : null,
            name,
            links,
            isActive: activeRaw === 0 || activeRaw === false || activeRaw === '0' ? 0 : 1,
            sortOrder: Number.isFinite(Number(orderRaw)) ? Number(orderRaw) : null
        });
    });
    return { entries, skipped };
}

/** Baca semua site (+ progress satu device) untuk dijadikan file backup. */
function loadBackupData(deviceId, cb) {
    db.all(`SELECT * FROM sites ORDER BY sort_order ASC, created_at DESC`, [], (err, rows) => {
        if (err) return cb(err);
        const sites = (rows || []).map((row) => ({
            id: row.id,
            name: row.name,
            links: normalizeLinkList(row.links),
            is_active: row.is_active === 0 ? 0 : 1,
            sort_order: Number(row.sort_order) || 0
        }));
        if (!deviceId) return cb(null, { sites, progress: [] });
        db.all(`SELECT * FROM progress WHERE device_id = ?`, [deviceId], (err2, progRows) => {
            if (err2) return cb(err2);
            cb(null, {
                sites,
                progress: (progRows || []).map((p) => ({
                    site_id: p.site_id,
                    last_index: p.last_index,
                    normal_count: p.normal_count,
                    error_count: p.error_count
                }))
            });
        });
    });
}

/**
 * Keamanan admin:
 * - ADMIN_PASSWORD wajib di produksi (tanpa fallback hardcoded).
 * - Di dev tanpa env, hanya localhost yang boleh memakai sandi dev.
 * - Rate limit sederhana per IP untuk mencegah brute force.
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' || process.env.VERCEL ? '' : 'rahasia123');
const IS_DEV_FALLBACK = !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== 'production' && !process.env.VERCEL;

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 20;
const authAttempts = new Map();

function authRateLimited(ip) {
    const now = Date.now();
    const entry = authAttempts.get(ip);
    if (!entry || now - entry.start > AUTH_WINDOW_MS) {
        authAttempts.set(ip, { start: now, count: 1 });
        return false;
    }
    entry.count += 1;
    return entry.count > AUTH_MAX_ATTEMPTS;
}

const requireAdmin = (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (authRateLimited(ip)) {
        return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
    }
    if (!ADMIN_PASSWORD) {
        return res.status(503).json({ error: 'ADMIN_PASSWORD belum diatur di server.' });
    }
    const reqPass = req.headers['x-admin-password'] || '';
    if (reqPass !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Password Admin Salah atau Akses Ditolak.' });
    }
    next();
};

if (!process.env.ADMIN_PASSWORD) {
    console.warn(
        IS_DEV_FALLBACK
            ? '⚠ ADMIN_PASSWORD belum diatur: memakai sandi dev hanya untuk localhost.'
            : '⚠ ADMIN_PASSWORD belum diatur: endpoint admin dinonaktifkan (503).'
    );
}

function isLocalRequest(req) {
    const host = String(req.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

/** Tolak sandi dev bila permintaan datang dari host non-lokal. */
const requireLocalDevOnly = (req, res, next) => {
    if (IS_DEV_FALLBACK && !isLocalRequest(req)) {
        return res.status(503).json({ error: 'ADMIN_PASSWORD belum diatur di server.' });
    }
    next();
};

const SETTINGS_KEYS = new Set([
    'app_title',
    'app_tagline',
    'default_interval',
    'maintenance_mode',
    'maintenance_message',
    'about_page_title',
    'about_page_body',
    'gsb_active',
    'gsb_api_key'
]);

app.post('/api/auth', requireLocalDevOnly, requireAdmin, (req, res) => {
    res.json({ success: true });
});

app.get('/api/settings', (req, res) => {
    db.all(`SELECT key, value FROM kv_settings`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        const reqPass = req.headers['x-admin-password'] || '';
        const isAdmin = Boolean(ADMIN_PASSWORD) && reqPass === ADMIN_PASSWORD;
        rows.forEach((r) => {
            if (r.key === 'gsb_api_key' && !isAdmin) return;
            settings[r.key] = r.value;
        });
        res.json({ settings });
    });
});

function getSetting(key) {
    return new Promise((resolve) => {
        db.get(`SELECT value FROM kv_settings WHERE key = ?`, [key], (err, row) => {
            resolve(row ? row.value : null);
        });
    });
}

async function checkWithGSB(url) {
    try {
        const apiKey = await getSetting('gsb_api_key');
        const active = await getSetting('gsb_active');
        if (active !== '1' || !apiKey) return false;

        const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client: { clientId: "testlink", clientVersion: "1.0.0" },
                threatInfo: {
                    threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                    platformTypes: ["ANY_PLATFORM"],
                    threatEntryTypes: ["URL"],
                    threatEntries: [{ url }]
                }
            })
        });
        if (!res.ok) return false;
        const data = await res.json();
        return data && data.matches && data.matches.length > 0;
    } catch (e) {
        return false;
    }
}

app.put('/api/settings', requireLocalDevOnly, requireAdmin, (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const entries = Object.entries(body).filter(([k]) => SETTINGS_KEYS.has(k));
    if (entries.length === 0) {
        return res.status(400).json({ error: 'Tidak ada pengaturan yang valid.' });
    }
    const stmt = db.prepare(`INSERT INTO kv_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
    db.serialize(() => {
        entries.forEach(([k, v]) => {
            let out = v;
            if (k === 'default_interval') out = String(Math.max(1, parseInt(String(v), 10) || 3));
            if (k === 'maintenance_mode') out = v === true || v === '1' || v === 1 ? '1' : '0';
            if (k === 'gsb_active') out = v === true || v === '1' || v === 1 ? '1' : '0';
            if (k === 'gsb_api_key') out = String(v).slice(0, 300);
            if (k === 'maintenance_message' || k === 'app_tagline' || k === 'app_title' || k === 'about_page_title') {
                out = String(v).slice(0, 500);
            }
            if (k === 'about_page_body') {
                out = String(v).slice(0, 12000);
            }
            stmt.run(k, out);
        });
        stmt.finalize((e2) => {
            if (e2) return res.status(500).json({ error: e2.message });
            res.json({ success: true });
        });
    });
});

app.get('/api/admin/stats', requireLocalDevOnly, requireAdmin, (req, res) => {
    db.all(`SELECT links FROM sites`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        let linkCount = 0;
        rows.forEach((row) => {
            linkCount += String(row.links || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length;
        });
        db.get(`SELECT COUNT(*) AS c FROM history`, [], (e2, hrow) => {
            if (e2) return res.status(500).json({ error: e2.message });
            db.get(`SELECT COUNT(*) AS c FROM sites`, [], (e3, srow) => {
                if (e3) return res.status(500).json({ error: e3.message });
                res.json({
                    siteCount: srow.c || 0,
                    linkCount,
                    historyCount: hrow.c || 0
                });
            });
        });
    });
});

app.get('/api/history/meta', (req, res) => {
    db.get(`SELECT id, created_at FROM history ORDER BY id DESC LIMIT 1`, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ newestId: row ? row.id : 0, newestAt: row ? row.created_at : null });
    });
});

app.post('/api/check-block', async (req, res) => {
    let target = (req.body && req.body.url) || '';
    target = String(target).trim().slice(0, 2048);
    if (!target) return res.status(400).json({ error: 'URL kosong.' });
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
    try {
        const out = await resolveUrlWithRedirects(target, 12000);
        let gsbBlocked = false;
        
        // Cek GSB backend
        if (out.ok || !out.ok) {
            gsbBlocked = await checkWithGSB(target); 
        }

        if (!out.ok) {
            if (gsbBlocked) return res.json({ blocked: true, finalUrl: target, status: 0, fromGSB: true });
            return res.json({ blocked: false, unreachable: true, finalUrl: out.finalUrl, note: out.error });
        }
        return res.json({
            blocked: !!out.blocked || gsbBlocked,
            finalUrl: out.finalUrl,
            status: out.status,
            fromUrl: !!out.urlHit,
            fromBody: !!out.bodyHit,
            fromGSB: gsbBlocked
        });
    } catch (e) {
        return res.status(500).json({ error: String(e.message || e) });
    }
});

app.delete('/api/history', requireLocalDevOnly, requireAdmin, (req, res) => {
    db.run(`DELETE FROM history`, [], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, deleted: this.changes });
    });
});

app.get('/api/sites', (req, res) => {
    const deviceId = req.query.deviceId;

    db.all(`SELECT * FROM sites ORDER BY sort_order ASC, created_at DESC`, [], (err, sites) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!deviceId) return res.json({ sites });

        db.all(`SELECT * FROM progress WHERE device_id = ?`, [deviceId], (err2, progressRows) => {
            if (err2) return res.status(500).json({ error: err2.message });

            const progressMap = {};
            progressRows.forEach((row) => {
                progressMap[row.site_id] = row;
            });

            // If deviceId is provided (Worker app), filter out inactive sites
            const enrichedSites = sites
                .filter(site => site.is_active !== 0)
                .map((site) => ({
                    ...site,
                    progress: progressMap[site.id] || { last_index: 0, normal_count: 0, error_count: 0 }
                }));

            res.json({ sites: enrichedSites });
        });
    });
});

app.get('/api/history', (req, res) => {
    db.all(`SELECT * FROM history ORDER BY created_at DESC LIMIT 50`, [], (err, history) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ history });
    });
});

/* ---------- Backup & restore kategori + link ---------- */

function dbGet(sql, params) {
    return new Promise((resolve, reject) => {
        db.get(sql, params || [], (err, row) => (err ? reject(err) : resolve(row)));
    });
}

function dbRun(sql, params) {
    return new Promise((resolve, reject) => {
        db.run(sql, params || [], function (err) {
            if (err) return reject(err);
            resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

/** Unduh seluruh kategori + link (opsional: progress milik satu device). */
app.get('/api/backup', requireLocalDevOnly, requireAdmin, (req, res) => {
    const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId.slice(0, 120) : '';
    loadBackupData(deviceId, (err, data) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            format: 'testlink-backup',
            version: 1,
            exported_at: getNowWIB(),
            device_id: deviceId || null,
            sites: data.sites,
            progress: data.progress
        });
    });
});

/**
 * Restore dari file backup.
 * mode=merge   → kategori baru ditambahkan, nama yang sudah ada dilewati (default, tidak menghapus data).
 * mode=replace → semua kategori dihapus dulu, lalu isi file dipulihkan apa adanya.
 */
app.post('/api/restore', requireLocalDevOnly, requireAdmin, async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const mode = body.mode === 'replace' ? 'replace' : 'merge';
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 120) : '';

    let parsed;
    try {
        parsed = normalizeBackupPayload(body.payload != null ? body.payload : body);
    } catch (e) {
        return res.status(400).json({ error: e.message });
    }
    const { entries, skipped } = parsed;
    if (entries.length === 0) {
        return res.status(400).json({ error: 'Tidak ada kategori valid di file backup.' });
    }

    const now = getNowWIB();
    const summary = { mode, added: 0, skipped, deleted: 0, progressRestored: 0, restoredNames: [] };

    try {
        if (mode === 'replace') {
            const existing = await dbGet(`SELECT COUNT(*) AS n FROM sites`, []);
            summary.deleted = existing ? existing.n : 0;
            await dbRun(`DELETE FROM sites`, []);
            await dbRun(`DELETE FROM progress`, []);
        }

        let maxOrder = 0;
        if (mode === 'merge') {
            const row = await dbGet(`SELECT MAX(sort_order) AS m FROM sites`, []);
            maxOrder = row && Number.isFinite(Number(row.m)) ? Number(row.m) : 0;
        }

        for (const entry of entries) {
            let targetId = null;
            if (mode === 'merge') {
                const clash = await dbGet(`SELECT id FROM sites WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))`, [entry.name]);
                if (clash) continue; // merge tidak menimpa kategori yang sudah ada
                targetId = uuidv4();
            } else {
                // replace: pakai id lama bila masih unik agar progress bisa dipulihkan
                targetId = entry.id || uuidv4();
                const clash = await dbGet(`SELECT id FROM sites WHERE id = ?`, [targetId]);
                if (clash) targetId = uuidv4();
            }

            const order = mode === 'merge' ? ++maxOrder : entry.sortOrder != null ? entry.sortOrder : maxOrder++;
            await dbRun(`INSERT INTO sites (id, name, links, created_at, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)`, [
                targetId,
                entry.name,
                entry.links.join('\n'),
                now,
                order,
                entry.isActive
            ]);
            summary.added++;
            summary.restoredNames.push(entry.name);
        }

        const payloadProgress = body.payload && Array.isArray(body.payload.progress) ? body.payload.progress : [];
        if (deviceId && payloadProgress.length > 0) {
            for (const p of payloadProgress.slice(0, 2000)) {
                if (!p || typeof p.site_id !== 'string') continue;
                const site = await dbGet(`SELECT id FROM sites WHERE id = ?`, [p.site_id]);
                if (!site) continue;
                await dbRun(
                    `INSERT INTO progress (device_id, site_id, last_index, normal_count, error_count)
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(device_id, site_id) DO UPDATE SET
                        last_index=excluded.last_index,
                        normal_count=excluded.normal_count,
                        error_count=excluded.error_count`,
                    [deviceId, p.site_id, Number(p.last_index) || 0, Number(p.normal_count) || 0, Number(p.error_count) || 0]
                );
                summary.progressRestored++;
            }
        }

        await dbRun(`INSERT INTO history (action, site_name, diff_summary, diff_details, created_at) VALUES (?, ?, ?, ?, ?)`, [
            'RESTORE',
            'Backup',
            `Restore ${mode}: ${summary.added} kategori dipulihkan, ${summary.skipped} dilewati${
                mode === 'replace' ? `, ${summary.deleted} kategori lama dihapus` : ''
            }.`,
            JSON.stringify({ added: summary.restoredNames, removed: [] }),
            now
        ]);

        res.json(summary);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/sites', requireLocalDevOnly, requireAdmin, (req, res) => {
    const { name, links } = req.body;
    if (typeof name !== 'string' || typeof links !== 'string') {
        return res.status(400).json({ error: 'Invalid data' });
    }
    const id = uuidv4();
    const now = getNowWIB();

    db.run(`INSERT INTO sites (id, name, links, created_at) VALUES (?, ?, ?, ?)`, [id, name, links, now], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        const count = links.split('\n').filter((l) => l.trim()).length;
        db.run(
            `INSERT INTO history (action, site_name, diff_summary, diff_details, created_at) VALUES (?, ?, ?, ?, ?)`,
            [
                'ADD',
                name,
                `Memasukkan database baru dengan ${count} link.`,
                JSON.stringify({ added: links.split('\n').filter((l) => l.trim()), removed: [] }),
                now
            ]
        );

        res.json({ id, name, links });
    });
});

app.put('/api/sites/order', requireLocalDevOnly, requireAdmin, (req, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ error: 'Invalid data' });

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare('UPDATE sites SET sort_order = ? WHERE id = ?');
        orders.forEach((o) => stmt.run([o.order, o.id]));
        stmt.finalize();
        db.run('COMMIT');
    });
    res.json({ success: true });
});

app.put('/api/sites/:id/toggle', requireLocalDevOnly, requireAdmin, (req, res) => {
    const { is_active } = req.body;
    db.run(`UPDATE sites SET is_active = ? WHERE id = ?`, [is_active ? 1 : 0, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.put('/api/sites/:id', requireLocalDevOnly, requireAdmin, (req, res) => {
    const { name, links } = req.body;
    if (typeof name !== 'string' || typeof links !== 'string') {
        return res.status(400).json({ error: 'Invalid data' });
    }
    const now = getNowWIB();

    db.get(`SELECT * FROM sites WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: err ? err.message : 'Tidak ditemukan' });

        const oldLinks = String(row.links || '').split('\n').map((l) => l.trim()).filter((l) => l);
        const newLinks = links.split('\n').map((l) => l.trim()).filter((l) => l);

        const added = newLinks.filter((l) => !oldLinks.includes(l)).length;
        const removed = oldLinks.filter((l) => !newLinks.includes(l)).length;

        const diff = [];
        if (added > 0) diff.push(`+${added} link`);
        if (removed > 0) diff.push(`-${removed} link hapus`);
        const diff_summary =
            diff.length > 0 ? diff.join(', ') : 'Memperbarui identitas/susunan teks (jumlah link tetap).';

        const diff_details = JSON.stringify({
            added: newLinks.filter((l) => !oldLinks.includes(l)),
            removed: oldLinks.filter((l) => !newLinks.includes(l))
        });

        db.run(`UPDATE sites SET name = ?, links = ? WHERE id = ?`, [name, links, req.params.id], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });

            db.run(
                `INSERT INTO history (action, site_name, diff_summary, diff_details, created_at) VALUES (?, ?, ?, ?, ?)`,
                ['EDIT', name, diff_summary, diff_details, now]
            );

            res.json({ success: true });
        });
    });
});

app.delete('/api/sites/:id', requireLocalDevOnly, requireAdmin, (req, res) => {
    db.get(`SELECT name, links FROM sites WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'Situs tidak ditemukan' });

        const name = row.name;
        const now = getNowWIB();
        db.serialize(() => {
            db.run(`DELETE FROM sites WHERE id = ?`, [req.params.id]);
            db.run(`DELETE FROM progress WHERE site_id = ?`, [req.params.id]);
            db.run(
                `INSERT INTO history (action, site_name, diff_summary, diff_details, created_at) VALUES (?, ?, ?, ?, ?)`,
                [
                    'DELETE',
                    name,
                    'Menghapus database situs beserta seluruh riwayat progressnya.',
                    JSON.stringify({ added: [], removed: [] }),
                    now
                ]
            );
        });
        res.json({ success: true });
    });
});

app.post('/api/progress', (req, res) => {
    const { deviceId, siteId, lastIndex, normalCount, errorCount } = req.body;

    db.run(
        `INSERT INTO progress (device_id, site_id, last_index, normal_count, error_count) 
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(device_id, site_id) 
            DO UPDATE SET 
                last_index=excluded.last_index,
                normal_count=excluded.normal_count,
                error_count=excluded.error_count`,
        [deviceId, siteId, lastIndex, normalCount, errorCount],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// Halaman & aset statis (Vercel: semua traffic lewat /api + includeFiles membawa file ke bundle)
app.get(['/admin', '/admin/'], (req, res) => res.redirect(302, '/admin.html'));
app.get(['/about', '/about/'], (req, res) => res.redirect(302, '/about.html'));
app.get('/favicon.ico', (req, res) => {
    const candidates = [
        path.join(ROOT, 'icons', 'icon-192.png'),
        path.join(ROOT, 'icons', 'icon.svg')
    ];
    for (const icon of candidates) {
        if (fs.existsSync(icon)) {
            res.type(icon.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
            return res.sendFile(icon);
        }
    }
    res.status(204).end();
});

app.get('/CHANGELOG.md', (req, res) => {
    const changelogPath = path.join(ROOT, 'CHANGELOG.md');
    if (fs.existsSync(changelogPath)) {
        res.type('text/markdown; charset=utf-8');
        return res.sendFile(changelogPath);
    }
    res.status(404).json({ error: 'CHANGELOG.md tidak ditemukan' });
});

app.get('/', (req, res, next) => {
    const indexPath = path.join(ROOT, 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath, (err) => (err ? next(err) : undefined));
    }
    next();
});
app.use(express.static(ROOT));

app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint-nya nyasar, nih. Cek lagi URL-nya.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(404).send('Not found');
    }
    res.status(404).sendFile(path.join(ROOT, '404.html'), (err) => {
        if (err) res.status(404).send('Not found');
    });
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
