/**
 * Settings Service - Manajemen pengaturan aplikasi
 */
const { databaseService } = require('./database');
const { SETTINGS_KEYS } = require('../config/constants');

class SettingsService {
    /**
     * Mendapatkan semua settings
     * @param {boolean} isAdmin - Apakah user adalah admin (untuk include sensitive settings)
     * @returns {Promise<Object>} Object settings
     */
    static async getAllSettings(isAdmin = false) {
        return new Promise((resolve, reject) => {
            databaseService.getDb().all(`SELECT key, value FROM kv_settings`, [], (err, rows) => {
                if (err) return reject(err);
                
                const settings = {};
                rows.forEach((r) => {
                    // Sembunyikan gsb_api_key dari non-admin
                    if (r.key === 'gsb_api_key' && !isAdmin) return;
                    settings[r.key] = r.value;
                });
                
                resolve(settings);
            });
        });
    }

    /**
     * Update settings
     * @param {Object} body - Object berisi key-value settings yang akan diupdate
     * @returns {Promise<boolean>} True jika berhasil
     */
    static async updateSettings(body) {
        const entries = Object.entries(body).filter(([k]) => SETTINGS_KEYS.has(k));
        
        if (entries.length === 0) {
            throw new Error('Tidak ada pengaturan yang valid.');
        }

        return new Promise((resolve, reject) => {
            const stmt = databaseService.getDb().prepare(`INSERT INTO kv_settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
            
            databaseService.getDb().serialize(() => {
                entries.forEach(([k, v]) => {
                    let out = v;
                    
                    // Validasi dan sanitasi nilai berdasarkan key
                    if (k === 'default_interval') {
                        out = String(Math.max(1, parseInt(String(v), 10) || 3));
                    }
                    if (k === 'maintenance_mode') {
                        out = v === true || v === '1' || v === 1 ? '1' : '0';
                    }
                    if (k === 'gsb_active') {
                        out = v === true || v === '1' || v === 1 ? '1' : '0';
                    }
                    if (k === 'gsb_api_key') {
                        out = String(v).slice(0, 300);
                    }
                    if (k === 'maintenance_message' || k === 'app_tagline' || k === 'app_title' || k === 'about_page_title') {
                        out = String(v).slice(0, 500);
                    }
                    if (k === 'about_page_body') {
                        out = String(v).slice(0, 12000);
                    }
                    
                    stmt.run(k, out);
                });
                
                stmt.finalize((e2) => {
                    if (e2) return reject(e2);
                    resolve(true);
                });
            });
        });
    }

    /**
     * Mendapatkan nilai setting tertentu
     * @param {string} key - Key setting
     * @returns {Promise<string|null>} Value setting
     */
    static async getSetting(key) {
        return new Promise((resolve) => {
            databaseService.getDb().get(
                `SELECT value FROM kv_settings WHERE key = ?`, 
                [key], 
                (err, row) => {
                    resolve(row ? row.value : null);
                }
            );
        });
    }
}

module.exports = {
    SettingsService
};