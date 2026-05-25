/**
 * TestLink Worker - TypeScript API Server
 * 
 * Migrated from api/index.js to TypeScript with database abstraction layer.
 * Supports both SQLite (local development) and MySQL (production) databases.
 * 
 * **Validates: Requirements 1.1, 9.1, 10.6, 11.6**
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createDatabaseAdapterFromEnv } from './database/factory';
import { DatabaseAdapter, Site, Progress, History, KVSetting, AdminStats, HistoryMeta, SiteWithProgress } from './types/database';

// Load environment variables
dotenv.config();

// ============================================================================
// Constants and Configuration
// ============================================================================

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rahasia123';

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


/** Hostname / path fragment redirect halaman blokir (Kominfo / operator) */
const BLOCK_PAGE_FRAGMENTS = [
    'internet-positif', 'internetpositif', 'trustpositif', 'nawala',
    'merdeka.com/block', 'blockpage.xlaxiata', 'xlaxiata.co.id/block',
    'aduankonten', 'lamanlabuh', 'komdigi', 'kominfo', 'walled-garden',
    'walledgarden', 'captive.apple', 'telkomsel.com/block',
    'indihome.co.id/block', 'axis.net/block', 'access-denied'
];

/** Pola di HTML halaman blokir */
const BLOCK_HTML_MARKERS = [
    'internet-positif', 'internet positif', 'internetpositif', 'trustpositif',
    'trust positif', 'lamanlabuh', 'aduankonten', 'blockpage',
    'situs yang anda buka', 'tidak dapat diakses', 'negative content',
    'konten yang melanggar', 'pembatasan akses', 'nawala', 'internet sehat',
    'filtered access', 'access to this site', 'diblokir', 'halaman pemblokiran',
    'walled garden', 'captive portal', 'komdigi'
];

// ============================================================================
// Helper Functions
// ============================================================================

/** Root proyek resolver */
function resolveProjectRoot(): string {
    const cwd = process.cwd();
    if (fs.existsSync(path.join(cwd, 'index.html'))) return cwd;
    let dir = path.resolve(__dirname);
    if (dir.endsWith('src')) dir = path.dirname(dir);
    if (dir.endsWith('dist')) dir = path.dirname(dir);
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
    return path.resolve(path.join(__dirname, '..'));
}

const ROOT = resolveProjectRoot();


/** Fungsi untuk mendapatkan waktu saat ini dalam zona WIB (UTC+7) */
function getNowWIB(): string {
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

/** Generate UUID v4 */
function uuidv4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/** Check if URL looks blocked */
function urlLooksBlocked(urlStr: string): boolean {
    try {
        const u = new URL(urlStr);
        const h = (u.hostname + u.pathname).toLowerCase();
        return BLOCK_PAGE_FRAGMENTS.some((f) => h.includes(f));
    } catch {
        return false;
    }
}

/** Check if HTML content looks blocked */
function htmlLooksBlocked(html: string | null): boolean {
    if (!html || typeof html !== 'string') return false;
    const s = html.slice(0, 24000).toLowerCase();
    return BLOCK_HTML_MARKERS.some((m) => s.includes(m));
}


/** Read response body prefix */
async function readResponseBodyPrefix(res: globalThis.Response, maxChars: number): Promise<string> {
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
                    try { await reader.cancel(); } catch (e) { /* ignore */ }
                    break;
                }
            }
        }
        return out;
    } catch (e) {
        return '';
    }
}

interface ResolveResult {
    ok: boolean;
    finalUrl: string;
    status?: number;
    blocked?: boolean;
    urlHit?: boolean;
    bodyHit?: boolean;
    error?: string;
}

/** Resolve URL with redirects and check for blocks */
async function resolveUrlWithRedirects(startUrl: string, maxMs: number): Promise<ResolveResult> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), maxMs);
    try {
        const res = await fetch(startUrl, {
            method: 'GET',
            redirect: 'follow',
            signal: ac.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
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
        return { ok: true, finalUrl, status: res.status, blocked: urlHit || bodyHit, urlHit, bodyHit };
    } catch (err: any) {
        return { ok: false, error: String(err.message || err), finalUrl: startUrl };
    } finally {
        clearTimeout(t);
    }
}


// ============================================================================
// Server Class
// ============================================================================

export class TestLinkServer {
    private app: Express;
    private db: DatabaseAdapter | null = null;
    private server: ReturnType<Express['listen']> | null = null;

    constructor() {
        this.app = express();
        this.setupMiddleware();
    }

    private setupMiddleware(): void {
        this.app.set('trust proxy', 1);
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
    }

    /** Admin authentication middleware */
    private requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
        const reqPass = req.headers['x-admin-password'] || '';
        if (reqPass !== ADMIN_PASSWORD) {
            res.status(403).json({ error: 'Password Admin Salah atau Akses Ditolak.' });
            return;
        }
        next();
    };

    /** Get setting from database */
    private async getSetting(key: string): Promise<string | null> {
        if (!this.db) return null;
        const rows = await this.db.query<KVSetting>(
            'SELECT value FROM kv_settings WHERE `key` = ?', [key]
        );
        return rows.length > 0 && rows[0] ? rows[0].value : null;
    }

    /** Check URL with Google Safe Browsing */
    private async checkWithGSB(url: string): Promise<boolean> {
        try {
            const apiKey = await this.getSetting('gsb_api_key');
            const active = await this.getSetting('gsb_active');
            if (active !== '1' || !apiKey) return false;

            const res = await fetch(
                `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
                {
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
                }
            );
            if (!res.ok) return false;
            const data = await res.json() as { matches?: any[] };
            return !!(data && data.matches && data.matches.length > 0);
        } catch (e) {
            return false;
        }
    }


    /** Setup all API routes */
    private setupRoutes(): void {
        // Health check endpoint - Validates: Requirement 11.6
        this.app.get('/api/health', async (_req, res) => {
            try {
                // Check database connection
                if (this.db) {
                    await this.db.query('SELECT 1');
                }
                res.json({
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    database: this.db?.config.type || 'not connected',
                    environment: process.env.NODE_ENV || 'development'
                });
            } catch (error) {
                res.status(503).json({
                    status: 'error',
                    timestamp: new Date().toISOString(),
                    error: 'Database connection failed'
                });
            }
        });

        // Auth endpoint
        this.app.post('/api/auth', this.requireAdmin, (_req, res) => {
            res.json({ success: true });
        });

        // Get settings
        this.app.get('/api/settings', async (req, res) => {
            try {
                const rows = await this.db!.query<KVSetting>('SELECT `key`, value FROM kv_settings');
                const settings: Record<string, string> = {};
                const isAdmin = req.headers['x-admin-password'] === ADMIN_PASSWORD;
                rows.forEach((r) => {
                    if (r.key === 'gsb_api_key' && !isAdmin) return;
                    settings[r.key] = r.value;
                });
                res.json({ settings });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Update settings
        this.app.put('/api/settings', this.requireAdmin, async (req, res): Promise<void> => {
            try {
                const body = req.body && typeof req.body === 'object' ? req.body : {};
                const entries = Object.entries(body).filter(([k]) => SETTINGS_KEYS.has(k));
                if (entries.length === 0) {
                    res.status(400).json({ error: 'Tidak ada pengaturan yang valid.' });
                    return;
                }

                for (const [k, v] of entries) {
                    let out = String(v);
                    if (k === 'default_interval') out = String(Math.max(1, parseInt(String(v), 10) || 3));
                    if (k === 'maintenance_mode') out = v === true || v === '1' || v === 1 ? '1' : '0';
                    if (k === 'gsb_active') out = v === true || v === '1' || v === 1 ? '1' : '0';
                    if (k === 'gsb_api_key') out = String(v).slice(0, 300);
                    if (['maintenance_message', 'app_tagline', 'app_title', 'about_page_title'].includes(k)) {
                        out = String(v).slice(0, 500);
                    }
                    if (k === 'about_page_body') out = String(v).slice(0, 12000);

                    const sql = this.db!.config.type === 'mysql'
                        ? 'INSERT INTO kv_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)'
                        : 'INSERT INTO kv_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
                    await this.db!.execute(sql, [k, out]);
                }
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });


        // Admin stats
        this.app.get('/api/admin/stats', this.requireAdmin, async (_req, res) => {
            try {
                const sites = await this.db!.query<{ links: string }>('SELECT links FROM sites');
                let linkCount = 0;
                sites.forEach((row) => {
                    linkCount += row.links.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length;
                });
                const [historyRow] = await this.db!.query<{ c: number }>('SELECT COUNT(*) AS c FROM history');
                const [siteRow] = await this.db!.query<{ c: number }>('SELECT COUNT(*) AS c FROM sites');
                res.json({
                    siteCount: siteRow?.c || 0,
                    linkCount,
                    historyCount: historyRow?.c || 0
                } as AdminStats);
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // History metadata
        this.app.get('/api/history/meta', async (_req, res) => {
            try {
                const rows = await this.db!.query<{ id: number; created_at: string }>(
                    'SELECT id, created_at FROM history ORDER BY id DESC LIMIT 1'
                );
                const row = rows[0];
                res.json({ newestId: row ? row.id : 0, newestAt: row ? row.created_at : null } as HistoryMeta);
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Check block endpoint
        this.app.post('/api/check-block', async (req, res) => {
            let target = (req.body && req.body.url) || '';
            target = String(target).trim().slice(0, 2048);
            if (!target) return res.status(400).json({ error: 'URL kosong.' });
            if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
            try {
                const out = await resolveUrlWithRedirects(target, 12000);
                const gsbBlocked = await this.checkWithGSB(target);
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
            } catch (e: any) {
                return res.status(500).json({ error: String(e.message || e) });
            }
        });

        // Delete all history
        this.app.delete('/api/history', this.requireAdmin, async (_req, res) => {
            try {
                await this.db!.execute('DELETE FROM history');
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });


        // Get sites
        this.app.get('/api/sites', async (req, res): Promise<void> => {
            try {
                const deviceId = req.query.deviceId as string | undefined;
                const sites = await this.db!.query<Site>(
                    'SELECT * FROM sites ORDER BY sort_order ASC, created_at DESC'
                );
                if (!deviceId) {
                    res.json({ sites });
                    return;
                }

                const progressRows = await this.db!.query<Progress>(
                    'SELECT * FROM progress WHERE device_id = ?', [deviceId]
                );
                const progressMap: Record<string, Progress> = {};
                progressRows.forEach((row) => { progressMap[row.site_id] = row; });

                const enrichedSites: SiteWithProgress[] = sites
                    .filter(site => site.is_active !== 0)
                    .map((site) => ({
                        ...site,
                        progress: progressMap[site.id] || { last_index: 0, normal_count: 0, error_count: 0 }
                    }));
                res.json({ sites: enrichedSites });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get history
        this.app.get('/api/history', async (_req, res) => {
            try {
                const history = await this.db!.query<History>(
                    'SELECT * FROM history ORDER BY created_at DESC LIMIT 50'
                );
                res.json({ history });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Create site
        this.app.post('/api/sites', this.requireAdmin, async (req, res) => {
            try {
                const { name, links } = req.body;
                const id = uuidv4();
                const now = getNowWIB();
                await this.db!.execute(
                    'INSERT INTO sites (id, name, links, created_at) VALUES (?, ?, ?, ?)',
                    [id, name, links, now]
                );
                const count = links.split('\n').filter((l: string) => l.trim()).length;
                await this.db!.execute(
                    'INSERT INTO history (action, site_name, diff_summary, diff_details, created_at) VALUES (?, ?, ?, ?, ?)',
                    ['ADD', name, `Memasukkan database baru dengan ${count} link.`,
                        JSON.stringify({ added: links.split('\n').filter((l: string) => l.trim()), removed: [] }), now]
                );
                res.json({ id, name, links });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });


        // Update site order
        this.app.put('/api/sites/order', this.requireAdmin, async (req, res): Promise<void> => {
            try {
                const { orders } = req.body;
                if (!Array.isArray(orders)) {
                    res.status(400).json({ error: 'Invalid data' });
                    return;
                }
                const transaction = await this.db!.beginTransaction();
                try {
                    for (const o of orders) {
                        await transaction.execute('UPDATE sites SET sort_order = ? WHERE id = ?', [o.order, o.id]);
                    }
                    await transaction.commit();
                    res.json({ success: true });
                } catch (error) {
                    await transaction.rollback();
                    throw error;
                }
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Toggle site active status
        this.app.put('/api/sites/:id/toggle', this.requireAdmin, async (req, res) => {
            try {
                const { is_active } = req.body;
                await this.db!.execute(
                    'UPDATE sites SET is_active = ? WHERE id = ?',
                    [is_active ? 1 : 0, req.params.id]
                );
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Update site
        this.app.put('/api/sites/:id', this.requireAdmin, async (req, res): Promise<void> => {
            try {
                const { name, links } = req.body;
                const now = getNowWIB();
                const rows = await this.db!.query<Site>('SELECT * FROM sites WHERE id = ?', [req.params.id]);
                if (rows.length === 0 || !rows[0]) {
                    res.status(404).json({ error: 'Tidak ditemukan' });
                    return;
                }
                const row = rows[0];

                const oldLinks = row.links.split('\n').map((l) => l.trim()).filter((l) => l);
                const newLinks = links.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
                const added = newLinks.filter((l: string) => !oldLinks.includes(l)).length;
                const removed = oldLinks.filter((l) => !newLinks.includes(l)).length;

                const diff = [];
                if (added > 0) diff.push(`+${added} link`);
                if (removed > 0) diff.push(`-${removed} link hapus`);
                const diff_summary = diff.length > 0 ? diff.join(', ') : 'Memperbarui identitas/susunan teks (jumlah link tetap).';
                const diff_details = JSON.stringify({
                    added: newLinks.filter((l: string) => !oldLinks.includes(l)),
                    removed: oldLinks.filter((l) => !newLinks.includes(l))
                });

                await this.db!.execute('UPDATE sites SET name = ?, links = ? WHERE id = ?', [name, links, req.params.id]);
                await this.db!.execute(
                    'INSERT INTO history (action, site_name, diff_summary, diff_details, created_at) VALUES (?, ?, ?, ?, ?)',
                    ['EDIT', name, diff_summary, diff_details, now]
                );
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });


        // Delete site
        this.app.delete('/api/sites/:id', this.requireAdmin, async (req, res): Promise<void> => {
            try {
                const rows = await this.db!.query<Site>('SELECT name, links FROM sites WHERE id = ?', [req.params.id]);
                if (rows.length === 0 || !rows[0]) {
                    res.status(404).json({ error: 'Situs tidak ditemukan' });
                    return;
                }
                const name = rows[0].name;
                const now = getNowWIB();

                const transaction = await this.db!.beginTransaction();
                try {
                    await transaction.execute('DELETE FROM sites WHERE id = ?', [req.params.id]);
                    await transaction.execute('DELETE FROM progress WHERE site_id = ?', [req.params.id]);
                    await transaction.execute(
                        'INSERT INTO history (action, site_name, diff_summary, diff_details, created_at) VALUES (?, ?, ?, ?, ?)',
                        ['DELETE', name, 'Menghapus database situs beserta seluruh riwayat progressnya.',
                            JSON.stringify({ added: [], removed: [] }), now]
                    );
                    await transaction.commit();
                    res.json({ success: true });
                } catch (error) {
                    await transaction.rollback();
                    throw error;
                }
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Update progress
        this.app.post('/api/progress', async (req, res) => {
            try {
                const { deviceId, siteId, lastIndex, normalCount, errorCount } = req.body;
                const sql = this.db!.config.type === 'mysql'
                    ? `INSERT INTO progress (device_id, site_id, last_index, normal_count, error_count) 
                       VALUES (?, ?, ?, ?, ?)
                       ON DUPLICATE KEY UPDATE 
                           last_index = VALUES(last_index),
                           normal_count = VALUES(normal_count),
                           error_count = VALUES(error_count)`
                    : `INSERT INTO progress (device_id, site_id, last_index, normal_count, error_count) 
                       VALUES (?, ?, ?, ?, ?)
                       ON CONFLICT(device_id, site_id) 
                       DO UPDATE SET 
                           last_index = excluded.last_index,
                           normal_count = excluded.normal_count,
                           error_count = excluded.error_count`;
                await this.db!.execute(sql, [deviceId, siteId, lastIndex, normalCount, errorCount]);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });


        // Static file routes
        this.app.get(['/admin', '/admin/'], (_req, res) => res.redirect(302, '/admin.html'));
        this.app.get(['/about', '/about/'], (_req, res) => res.redirect(302, '/about.html'));

        this.app.get('/favicon.ico', (_req, res) => {
            const icon = path.join(ROOT, 'icons', 'icon.svg');
            if (fs.existsSync(icon)) {
                res.type('image/svg+xml');
                return res.sendFile(icon);
            }
            res.status(204).end();
        });

        this.app.get('/CHANGELOG.md', (_req, res) => {
            const changelogPath = path.join(ROOT, 'CHANGELOG.md');
            if (fs.existsSync(changelogPath)) {
                res.type('text/markdown; charset=utf-8');
                return res.sendFile(changelogPath);
            }
            res.status(404).json({ error: 'CHANGELOG.md tidak ditemukan' });
        });

        this.app.get('/', (_req, res, next) => {
            const indexPath = path.join(ROOT, 'index.html');
            if (fs.existsSync(indexPath)) {
                return res.sendFile(indexPath, (err) => (err ? next(err) : undefined));
            }
            next();
        });

        this.app.use(express.static(ROOT));

        // 404 handler
        this.app.use((req, res): void => {
            if (req.path.startsWith('/api')) {
                res.status(404).json({ error: 'Endpoint-nya nyasar, nih. Cek lagi URL-nya.' });
                return;
            }
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                res.status(404).send('Not found');
                return;
            }
            res.status(404).sendFile(path.join(ROOT, '404.html'), (err) => {
                if (err) res.status(404).send('Not found');
            });
        });
    }


    /** Initialize database and start server */
    async start(port: number = 3000): Promise<void> {
        console.log(`📂 Project ROOT set to: ${ROOT}`);

        // Initialize database
        console.log('🔌 Initializing database...');
        try {
            this.db = await createDatabaseAdapterFromEnv();
            console.log(`✅ Database connected (${this.db.config.type})`);
        } catch (error) {
            console.error('❌ Failed to initialize database:', error);
            throw error;
        }

        // Setup routes after database is ready
        this.setupRoutes();

        // Start server
        this.server = this.app.listen(port, () => {
            console.log(`🚀 Server running on http://localhost:${port}`);
            console.log(`📊 Health check: http://localhost:${port}/api/health`);
        });

        // Setup graceful shutdown - Validates: Requirement 10.6
        this.setupGracefulShutdown();
    }

    /** Setup graceful shutdown handlers */
    private setupGracefulShutdown(): void {
        const shutdown = async (signal: string) => {
            console.log(`\n📴 Received ${signal}. Shutting down gracefully...`);

            // Close HTTP server
            if (this.server) {
                this.server.close(() => {
                    console.log('✅ HTTP server closed');
                });
            }

            // Close database connection
            if (this.db) {
                try {
                    await this.db.close();
                    console.log('✅ Database connection closed');
                } catch (error) {
                    console.error('❌ Error closing database:', error);
                }
            }

            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    /** Get Express app instance (for testing) */
    getApp(): Express {
        return this.app;
    }

    /** Get database adapter (for testing) */
    getDatabase(): DatabaseAdapter | null {
        return this.db;
    }
}


// ============================================================================
// Main Entry Point
// ============================================================================

const PORT = parseInt(process.env.PORT || '3000', 10);

// Only start server if not in test mode and not imported as module
if (process.env.NODE_ENV !== 'test' && require.main === module) {
    const server = new TestLinkServer();
    server.start(PORT).catch((error) => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}

export default TestLinkServer;
