/**
 * Backup Routes - Route untuk backup & restore database
 */
const express = require('express');
const router = express.Router();
const { AuthMiddleware } = require('../middleware/auth');
const { databaseService } = require('../services/database');

/**
 * GET /api/backup
 * Export database ke JSON format
 */
router.get('/', AuthMiddleware.requireAdmin, async (req, res) => {
    try {
        const db = databaseService.getDb();
        
        // Get all tables data
        const sites = await databaseService.query('SELECT * FROM sites ORDER BY sort_order ASC, created_at DESC');
        const progress = await databaseService.query('SELECT * FROM progress');
        const history = await databaseService.query('SELECT * FROM history ORDER BY created_at DESC');
        const settings = await databaseService.query('SELECT * FROM kv_settings');
        
        const backupData = {
            version: '1.0',
            exported_at: new Date().toISOString(),
            database_type: 'sqlite',
            tables: {
                sites: sites,
                progress: progress,
                history: history,
                kv_settings: settings
            },
            stats: {
                site_count: sites.length,
                progress_count: progress.length,
                history_count: history.length,
                settings_count: settings.length
            }
        };
        
        res.json(backupData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/backup/download
 * Download backup sebagai file JSON
 */
router.get('/download', AuthMiddleware.requireAdmin, async (req, res) => {
    try {
        const db = databaseService.getDb();
        
        // Get all tables data
        const sites = await databaseService.query('SELECT * FROM sites ORDER BY sort_order ASC, created_at DESC');
        const progress = await databaseService.query('SELECT * FROM progress');
        const history = await databaseService.query('SELECT * FROM history ORDER BY created_at DESC');
        const settings = await databaseService.query('SELECT * FROM kv_settings');
        
        const backupData = {
            version: '1.0',
            exported_at: new Date().toISOString(),
            database_type: 'sqlite',
            tables: {
                sites: sites,
                progress: progress,
                history: history,
                kv_settings: settings
            },
            stats: {
                site_count: sites.length,
                progress_count: progress.length,
                history_count: history.length,
                settings_count: settings.length
            }
        };
        
        const filename = `testlink-backup-${new Date().toISOString().slice(0, 10)}.json`;
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(backupData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/backup/restore
 * Restore database from JSON backup
 */
router.post('/restore', AuthMiddleware.requireAdmin, express.json({ limit: '50mb' }), async (req, res) => {
    try {
        const backupData = req.body;
        
        // Validate backup format
        if (!backupData.version || !backupData.tables) {
            return res.status(400).json({ error: 'Format backup tidak valid. Harus memiliki version dan tables.' });
        }
        
        if (backupData.version !== '1.0') {
            return res.status(400).json({ error: `Versi backup '${backupData.version}' tidak didukung.` });
        }
        
        const db = databaseService.getDb();
        const tables = backupData.tables;
        
        // Perform restore in transaction
        await databaseService.transaction(async () => {
            // Clear existing data (order matters due to foreign keys)
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM progress', (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
            
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM history', (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
            
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM sites', (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
            
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM kv_settings', (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
            
            // Restore kv_settings
            if (tables.kv_settings && tables.kv_settings.length > 0) {
                const stmt = db.prepare('INSERT OR REPLACE INTO kv_settings (key, value) VALUES (?, ?)');
                for (const setting of tables.kv_settings) {
                    await new Promise((resolve, reject) => {
                        stmt.run([setting.key, setting.value], (err) => {
                            if (err) return reject(err);
                            resolve();
                        });
                    });
                }
                stmt.finalize();
            }
            
            // Restore sites
            if (tables.sites && tables.sites.length > 0) {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO sites 
                    (id, name, links, created_at, sort_order, is_active, operation_mode, manual_validation, custom_interval) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                for (const site of tables.sites) {
                    await new Promise((resolve, reject) => {
                        stmt.run([
                            site.id,
                            site.name,
                            site.links,
                            site.created_at,
                            site.sort_order || 0,
                            site.is_active !== undefined ? site.is_active : 1,
                            site.operation_mode || 0,
                            site.manual_validation || 0,
                            site.custom_interval || null
                        ], (err) => {
                            if (err) return reject(err);
                            resolve();
                        });
                    });
                }
                stmt.finalize();
            }
            
            // Restore progress
            if (tables.progress && tables.progress.length > 0) {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO progress 
                    (device_id, site_id, last_index, normal_count, error_count) 
                    VALUES (?, ?, ?, ?, ?)
                `);
                for (const prog of tables.progress) {
                    await new Promise((resolve, reject) => {
                        stmt.run([
                            prog.device_id,
                            prog.site_id,
                            prog.last_index || 0,
                            prog.normal_count || 0,
                            prog.error_count || 0
                        ], (err) => {
                            if (err) return reject(err);
                            resolve();
                        });
                    });
                }
                stmt.finalize();
            }
            
            // Restore history
            if (tables.history && tables.history.length > 0) {
                const stmt = db.prepare(`
                    INSERT INTO history (action, site_name, diff_summary, diff_details, created_at) 
                    VALUES (?, ?, ?, ?, ?)
                `);
                for (const hist of tables.history) {
                    await new Promise((resolve, reject) => {
                        stmt.run([
                            hist.action,
                            hist.site_name,
                            hist.diff_summary,
                            hist.diff_details,
                            hist.created_at
                        ], (err) => {
                            if (err) return reject(err);
                            resolve();
                        });
                    });
                }
                stmt.finalize();
            }
        });
        
        // Log the restore action
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO history (action, site_name, diff_summary, diff_details, created_at) VALUES (?, ?, ?, ?, ?)`,
                [
                    'RESTORE',
                    'System',
                    `Database restored from backup (${backupData.exported_at || 'unknown'}).`,
                    JSON.stringify({
                        restored_by: 'admin',
                        backup_date: backupData.exported_at,
                        stats: backupData.stats
                    }),
                    now
                ],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
        
        res.json({
            success: true,
            message: 'Database berhasil di-restore!',
            restored: {
                sites: tables.sites ? tables.sites.length : 0,
                progress: tables.progress ? tables.progress.length : 0,
                history: tables.history ? tables.history.length : 0,
                settings: tables.kv_settings ? tables.kv_settings.length : 0
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Gagal restore database: ' + err.message });
    }
});

/**
 * GET /api/backup/info
 * Mendapatkan info backup terakhir
 */
router.get('/info', AuthMiddleware.requireAdmin, async (req, res) => {
    try {
        const db = databaseService.getDb();
        
        // Get stats
        const sitesCount = await databaseService.query('SELECT COUNT(*) as count FROM sites');
        const historyCount = await databaseService.query('SELECT COUNT(*) as count FROM history');
        const lastHistory = await databaseService.query('SELECT created_at FROM history ORDER BY id DESC LIMIT 1');
        
        // Check for recent changes (last 24 hours)
        const recentChanges = await databaseService.query(
            `SELECT COUNT(*) as count FROM history WHERE created_at >= datetime('now', '-1 day', '+7 hours')`
        );
        
        res.json({
            database_type: 'sqlite',
            last_backup: null, // Would need to track in file system
            stats: {
                sites: sitesCount[0] ? sitesCount[0].count : 0,
                history: historyCount[0] ? historyCount[0].count : 0,
                recent_changes_24h: recentChanges[0] ? recentChanges[0].count : 0
            },
            last_activity: lastHistory[0] ? lastHistory[0].created_at : null,
            has_recent_changes: (recentChanges[0] ? recentChanges[0].count : 0) > 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;