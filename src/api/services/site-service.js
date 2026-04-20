/**
 * Site Service - Manajemen situs dan progress
 */
const { databaseService } = require('./database');
const { uuidv4 } = require('../utils/uuid');
const { getNowWIB } = require('../utils/time');

class SiteService {
    /**
     * Mendapatkan semua situs dengan progress per device
     * @param {string|null} deviceId - Device ID (opsional)
     * @returns {Promise<Array>} Array situs dengan progress
     */
    static async getAllSites(deviceId = null) {
        return new Promise((resolve, reject) => {
            databaseService.getDb().all(`SELECT * FROM sites ORDER BY sort_order ASC, created_at DESC`, [], (err, sites) => {
                if (err) return reject(err);
                
                if (!deviceId) {
                    resolve(sites);
                    return;
                }

                // Jika deviceId disediakan, filter hanya situs aktif dan tambahkan progress
                databaseService.getDb().all(`SELECT * FROM progress WHERE device_id = ?`, [deviceId], (err2, progressRows) => {
                    if (err2) return reject(err2);

                    const progressMap = {};
                    progressRows.forEach((row) => {
                        progressMap[row.site_id] = row;
                    });

                    // Filter situs aktif dan tambahkan progress
                    const enrichedSites = sites
                        .filter(site => site.is_active !== 0)
                        .map((site) => ({
                            ...site,
                            progress: progressMap[site.id] || { last_index: 0, normal_count: 0, error_count: 0 }
                        }));

                    resolve(enrichedSites);
                });
            });
        });
    }

    /**
     * Membuat situs baru
     * @param {string} name - Nama situs
     * @param {string} links - Links (dipisahkan newline)
     * @returns {Promise<Object>} Object situs yang dibuat
     */
    static async createSite(name, links) {
        const id = uuidv4();
        const now = getNowWIB();

        return new Promise((resolve, reject) => {
            databaseService.getDb().run(
                `INSERT INTO sites (id, name, links, created_at) VALUES (?, ?, ?, ?)`, 
                [id, name, links, now], 
                (err) => {
                    if (err) return reject(err);

                    const count = links.split('\n').filter((l) => l.trim()).length;
                    
                    // Simpan ke history
                    databaseService.getDb().run(
                        `INSERT INTO history (action, site_name, diff_summary, diff_details, created_at) VALUES (?, ?, ?, ?, ?)`,
                        [
                            'ADD',
                            name,
                            `Memasukkan database baru dengan ${count} link.`,
                            JSON.stringify({ added: links.split('\n').filter((l) => l.trim()), removed: [] }),
                            now
                        ]
                    );

                    resolve({ id, name, links });
                }
            );
        });
    }

    /**
     * Update situs
     * @param {string} siteId - ID situs
     * @param {string} name - Nama situs baru
     * @param {string} links - Links baru
     * @returns {Promise<boolean>} True jika berhasil
     */
    static async updateSite(siteId, name, links) {
        const now = getNowWIB();

        return new Promise((resolve, reject) => {
            databaseService.getDb().get(`SELECT * FROM sites WHERE id = ?`, [siteId], (err, row) => {
                if (err || !row) return reject(err ? err : new Error('Tidak ditemukan'));

                const oldLinks = row.links.split('\n').map((l) => l.trim()).filter((l) => l);
                const newLinks = links.split('\n').map((l) => l.trim()).filter((l) => l);

                const added = newLinks.filter((l) => !oldLinks.includes(l)).length;
                const removed = oldLinks.filter((l) => !newLinks.includes(l)).length;

                const diff = [];
                if (added > 0) diff.push(`+${added} link`);
                if (removed > 0) diff.push(`-${removed} link hapus`);
                const diff_summary = diff.length > 0 
                    ? diff.join(', ') 
                    : 'Memperbarui identitas/susunan teks (jumlah link tetap).';

                const diff_details = JSON.stringify({
                    added: newLinks.filter((l) => !oldLinks.includes(l)),
                    removed: oldLinks.filter((l) => !newLinks.includes(l))
                });

                databaseService.getDb().run(
                    `UPDATE sites SET name = ?, links = ? WHERE id = ?`, 
                    [name, links, siteId], 
                    (err2) => {
                        if (err2) return reject(err2);

                        // Simpan ke history
                        databaseService.getDb().run(
                            `INSERT INTO history (action, site_name, diff_summary, diff_details, created_at) VALUES (?, ?, ?, ?, ?)`,
                            ['EDIT', name, diff_summary, diff_details, now]
                        );

                        resolve(true);
                    }
                );
            });
        });
    }

    /**
     * Hapus situs
     * @param {string} siteId - ID situs
     * @returns {Promise<boolean>} True jika berhasil
     */
    static async deleteSite(siteId) {
        return new Promise((resolve, reject) => {
            databaseService.getDb().get(`SELECT name FROM sites WHERE id = ?`, [siteId], (err, row) => {
                if (err || !row) return reject(err ? err : new Error('Situs tidak ditemukan'));

                const name = row.name;
                const now = getNowWIB();
                
                databaseService.getDb().serialize(() => {
                    databaseService.getDb().run(`DELETE FROM sites WHERE id = ?`, [siteId]);
                    databaseService.getDb().run(`DELETE FROM progress WHERE site_id = ?`, [siteId]);
                    databaseService.getDb().run(
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
                
                resolve(true);
            });
        });
    }

    /**
     * Update progress per device
     * @param {string} deviceId - Device ID
     * @param {string} siteId - Site ID
     * @param {number} lastIndex - Last index
     * @param {number} normalCount - Normal count
     * @param {number} errorCount - Error count
     * @returns {Promise<boolean>} True jika berhasil
     */
    static async updateProgress(deviceId, siteId, lastIndex, normalCount, errorCount) {
        return new Promise((resolve, reject) => {
            databaseService.getDb().run(
                `INSERT INTO progress (device_id, site_id, last_index, normal_count, error_count) 
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(device_id, site_id) 
                    DO UPDATE SET 
                        last_index=excluded.last_index,
                        normal_count=excluded.normal_count,
                        error_count=excluded.error_count`,
                [deviceId, siteId, lastIndex, normalCount, errorCount],
                (err) => {
                    if (err) return reject(err);
                    resolve(true);
                }
            );
        });
    }

    /**
     * Update urutan situs
     * @param {Array} orders - Array berisi {id, order}
     * @returns {Promise<boolean>} True jika berhasil
     */
    static async updateOrder(orders) {
        return new Promise((resolve, reject) => {
            databaseService.getDb().serialize(() => {
                databaseService.getDb().run('BEGIN TRANSACTION');
                const stmt = databaseService.getDb().prepare('UPDATE sites SET sort_order = ? WHERE id = ?');
                orders.forEach((o) => stmt.run([o.order, o.id]));
                stmt.finalize();
                databaseService.getDb().run('COMMIT');
            });
            
            resolve(true);
        });
    }

    /**
     * Toggle status aktif situs
     * @param {string} siteId - Site ID
     * @param {boolean} isActive - Status aktif
     * @returns {Promise<boolean>} True jika berhasil
     */
    static async toggleActive(siteId, isActive) {
        return new Promise((resolve, reject) => {
            databaseService.getDb().run(
                `UPDATE sites SET is_active = ? WHERE id = ?`, 
                [isActive ? 1 : 0, siteId], 
                (err) => {
                    if (err) return reject(err);
                    resolve(true);
                }
            );
        });
    }

    /**
     * Mendapatkan statistik
     * @returns {Promise<Object>} Object statistik
     */
    static async getStats() {
        return new Promise((resolve, reject) => {
            databaseService.getDb().all(`SELECT links FROM sites`, [], (err, rows) => {
                if (err) return reject(err);
                
                let linkCount = 0;
                rows.forEach((row) => {
                    linkCount += row.links.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length;
                });
                
                databaseService.getDb().get(`SELECT COUNT(*) AS c FROM history`, [], (e2, hrow) => {
                    if (e2) return reject(e2);
                    
                    databaseService.getDb().get(`SELECT COUNT(*) AS c FROM sites`, [], (e3, srow) => {
                        if (e3) return reject(e3);
                        
                        resolve({
                            siteCount: srow.c || 0,
                            linkCount,
                            historyCount: hrow.c || 0
                        });
                    });
                });
            });
        });
    }
}

module.exports = {
    SiteService
};