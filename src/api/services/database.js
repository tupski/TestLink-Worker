/**
 * Database service untuk manajemen koneksi dan inisialisasi SQLite
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { resolveProjectRoot } = require('../utils/project-root');

class DatabaseService {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_URL) || process.env.VERCEL_ENV === 'production';
        this.dbFolder = this.isVercel ? '/tmp' : path.join(resolveProjectRoot(), 'data');
        this.dbPath = path.join(this.dbFolder, 'database.sqlite');
    }

    /**
     * Inisialisasi database
     */
    async init() {
        if (this.isInitialized) return;

        // Buat folder database jika belum ada
        if (!fs.existsSync(this.dbFolder)) {
            fs.mkdirSync(this.dbFolder, { recursive: true });
        }

        // Copy database template di Vercel jika perlu
        if (this.isVercel && !fs.existsSync(this.dbPath)) {
            const bundledDb = path.join(resolveProjectRoot(), 'data', 'database.sqlite');
            if (fs.existsSync(bundledDb)) {
                fs.copyFileSync(bundledDb, this.dbPath);
                console.log('💾 Copied bundled SQLite DB to /tmp for Vercel');
            }
        }

        // Inisialisasi koneksi database
        this.db = new sqlite3.Database(this.dbPath);
        
        // Setup tabel-tabel
        await this.createTables();
        
        this.isInitialized = true;
        console.log(`💾 Using ${this.isVercel ? 'Vercel /tmp' : 'Local'} SQLite Database at: ${this.dbPath}`);
        if (this.isVercel) {
            console.warn('⚠️ Warning: Data stored in /tmp will be lost when the server restarts on Vercel.');
        }
    }

    /**
     * Membuat tabel-tabel yang diperlukan
     */
    createTables() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Tabel sites
                this.db.run(`CREATE TABLE IF NOT EXISTS sites (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    links TEXT,
                    created_at DATETIME,
                    sort_order INTEGER DEFAULT 0,
                    is_active INTEGER DEFAULT 1
                )`, (err) => {
                    if (err) return reject(err);
                    
                    // Tambahkan kolom jika belum ada (backward compatibility)
                    this.db.run(`ALTER TABLE sites ADD COLUMN sort_order INTEGER DEFAULT 0`, () => {});
                    this.db.run(`ALTER TABLE sites ADD COLUMN is_active INTEGER DEFAULT 1`, () => {});
                    this.db.run(`ALTER TABLE sites ADD COLUMN operation_mode INTEGER DEFAULT 0`, () => {});
                    this.db.run(`ALTER TABLE sites ADD COLUMN manual_validation INTEGER DEFAULT 0`, () => {});
                    this.db.run(`ALTER TABLE sites ADD COLUMN custom_interval INTEGER DEFAULT NULL`, () => {});
                });

                // Tabel progress
                this.db.run(`CREATE TABLE IF NOT EXISTS progress (
                    device_id TEXT,
                    site_id TEXT,
                    last_index INTEGER DEFAULT 0,
                    normal_count INTEGER DEFAULT 0,
                    error_count INTEGER DEFAULT 0,
                    PRIMARY KEY (device_id, site_id)
                )`);

                // Tabel history
                this.db.run(`CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action TEXT,
                    site_name TEXT,
                    diff_summary TEXT,
                    diff_details TEXT,
                    created_at DATETIME
                )`, (err) => {
                    if (err) return reject(err);
                    
                    // Tambahkan kolom jika belum ada (backward compatibility)
                    this.db.run(`ALTER TABLE history ADD COLUMN diff_details TEXT`, () => {});
                });

                // Tabel kv_settings
                this.db.run(`CREATE TABLE IF NOT EXISTS kv_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )`, (err) => {
                    if (err) return reject(err);
                    
                    // Seed data default
                    this.seedDefaultSettings();
                    resolve();
                });
            });
        });
    }

    /**
     * Seed data default settings
     */
    seedDefaultSettings() {
        const { DEFAULT_SETTINGS } = require('../config/constants');
        
        this.db.serialize(() => {
            const stmt = this.db.prepare(`INSERT OR IGNORE INTO kv_settings (key, value) VALUES (?, ?)`);
            DEFAULT_SETTINGS.forEach(([k, v]) => {
                stmt.run(k, v);
            });
            stmt.finalize();
        });
    }

    /**
     * Mendapatkan instance database
     * @returns {sqlite3.Database} Database instance
     */
    getDb() {
        if (!this.isInitialized) {
            throw new Error('Database not initialized. Call init() first.');
        }
        return this.db;
    }

    /**
     * Menjalankan query SELECT
     * @param {string} sql - Query SQL
     * @param {Array} params - Parameter query
     * @returns {Promise<Array>} Hasil query
     */
    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    /**
     * Menjalankan query INSERT/UPDATE/DELETE
     * @param {string} sql - Query SQL
     * @param {Array} params - Parameter query
     * @returns {Promise<number>} Jumlah baris yang terpengaruh
     */
    async execute(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) return reject(err);
                resolve(this.changes);
            });
        });
    }

    /**
     * Menjalankan query dengan transaksi
     * @param {Function} callback - Callback async yang menerima db instance
     * @returns {Promise} Hasil callback
     */
    async transaction(callback) {
        const db = this.db;
        return new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) return reject(err);
                
                // Execute async callback
                callback(db)
                    .then((result) => {
                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) return reject(commitErr);
                            resolve(result);
                        });
                    })
                    .catch((callbackErr) => {
                        db.run('ROLLBACK', (rollbackErr) => {
                            if (rollbackErr) return reject(rollbackErr);
                            reject(callbackErr);
                        });
                    });
            });
        });
    }

    /**
     * Menutup koneksi database
     */
    close() {
        if (this.db) {
            this.db.close();
            this.isInitialized = false;
        }
    }
}

// Singleton instance
const databaseService = new DatabaseService();

module.exports = {
    DatabaseService,
    databaseService
};