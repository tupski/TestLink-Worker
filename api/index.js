require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1);
app.use(cors());
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

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV || process.env.VERCEL_URL;
const dbFolder = isVercel ? '/tmp' : path.join(ROOT, 'data');
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
}
const dbPath = path.join(dbFolder, 'database.sqlite');
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rahasia123';
const requireAdmin = (req, res, next) => {
    const reqPass = req.headers['x-admin-password'] || '';
    if (reqPass !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Password Admin Salah atau Akses Ditolak.' });
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

app.post('/api/auth', requireAdmin, (req, res) => {
    res.json({ success: true });
});

app.get('/api/settings', (req, res) => {
    db.all(`SELECT key, value FROM kv_settings`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        const isAdmin = req.headers['x-admin-password'] === ADMIN_PASSWORD || req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
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

app.put('/api/settings', requireAdmin, (req, res) => {
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

app.get('/api/admin/stats', requireAdmin, (req, res) => {
    db.all(`SELECT links FROM sites`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        let linkCount = 0;
        rows.forEach((row) => {
            linkCount += row.links.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length;
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

app.delete('/api/history', requireAdmin, (req, res) => {
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

app.post('/api/sites', requireAdmin, (req, res) => {
    const { name, links } = req.body;
    const id = uuidv4();

    db.run(`INSERT INTO sites (id, name, links) VALUES (?, ?, ?)`, [id, name, links], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        const count = links.split('\n').filter((l) => l.trim()).length;
        db.run(
            `INSERT INTO history (action, site_name, diff_summary, diff_details) VALUES (?, ?, ?, ?)`,
            [
                'ADD',
                name,
                `Memasukkan database baru dengan ${count} link.`,
                JSON.stringify({ added: links.split('\n').filter((l) => l.trim()), removed: [] })
            ]
        );

        res.json({ id, name, links });
    });
});

app.put('/api/sites/order', requireAdmin, (req, res) => {
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

app.put('/api/sites/:id/toggle', requireAdmin, (req, res) => {
    const { is_active } = req.body;
    db.run(`UPDATE sites SET is_active = ? WHERE id = ?`, [is_active ? 1 : 0, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.put('/api/sites/:id', requireAdmin, (req, res) => {
    const { name, links } = req.body;

    db.get(`SELECT * FROM sites WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: err ? err.message : 'Tidak ditemukan' });

        const oldLinks = row.links.split('\n').map((l) => l.trim()).filter((l) => l);
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
                `INSERT INTO history (action, site_name, diff_summary, diff_details) VALUES (?, ?, ?, ?)`,
                ['EDIT', name, diff_summary, diff_details]
            );

            res.json({ success: true });
        });
    });
});

app.delete('/api/sites/:id', requireAdmin, (req, res) => {
    db.get(`SELECT name, links FROM sites WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'Situs tidak ditemukan' });

        const name = row.name;
        db.serialize(() => {
            db.run(`DELETE FROM sites WHERE id = ?`, [req.params.id]);
            db.run(`DELETE FROM progress WHERE site_id = ?`, [req.params.id]);
            db.run(
                `INSERT INTO history (action, site_name, diff_summary, diff_details) VALUES (?, ?, ?, ?)`,
                [
                    'DELETE',
                    name,
                    'Menghapus database situs beserta seluruh riwayat progressnya.',
                    JSON.stringify({ added: [], removed: [] })
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
    const icon = path.join(ROOT, 'icons', 'icon.svg');
    if (fs.existsSync(icon)) {
        res.type('image/svg+xml');
        return res.sendFile(icon);
    }
    res.status(204).end();
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
