/**
 * SQLite Database Adapter
 * 
 * Implements DatabaseAdapter interface for SQLite database.
 * Maintains backward compatibility with existing SQLite functionality
 * for local development and testing.
 * 
 * **Validates: Requirements 1.6, 9.1**
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { DatabaseAdapter, DatabaseConfig, DatabaseTransaction } from '../types/database';

/**
 * SQLite implementation of DatabaseAdapter interface
 * Provides backward compatibility for local development
 */
export class SQLiteAdapter implements DatabaseAdapter {
    config: DatabaseConfig;
    private db: sqlite3.Database | null = null;

    constructor(config: DatabaseConfig) {
        this.config = config;
    }

    /**
     * Initialize SQLite database connection and create tables
     * Creates database file if it doesn't exist
     */
    async initialize(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            try {
                // Ensure database directory exists
                const dbPath = this.config.database;
                const dbDir = path.dirname(dbPath);

                if (!fs.existsSync(dbDir)) {
                    fs.mkdirSync(dbDir, { recursive: true });
                }

                // Open database connection
                this.db = new sqlite3.Database(dbPath, (err) => {
                    if (err) {
                        console.error('❌ SQLite connection error:', err.message);
                        reject(err);
                        return;
                    }

                    console.log(`✅ SQLite database connected: ${dbPath}`);

                    // Create tables
                    this.createTables()
                        .then(() => resolve(true))
                        .catch(reject);
                });
            } catch (error) {
                console.error('❌ SQLite initialization error:', error);
                reject(error);
            }
        });
    }

    /**
     * Create all required tables if they don't exist
     * Maintains compatibility with existing schema
     */
    private async createTables(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            this.db!.serialize(() => {
                // Create sites table
                this.db!.run(`CREATE TABLE IF NOT EXISTS sites (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    links TEXT NOT NULL,
                    created_at DATETIME NOT NULL,
                    sort_order INTEGER DEFAULT 0,
                    is_active INTEGER DEFAULT 1
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating sites table:', err.message);
                        reject(err);
                        return;
                    }
                });

                // Create progress table
                this.db!.run(`CREATE TABLE IF NOT EXISTS progress (
                    device_id TEXT NOT NULL,
                    site_id TEXT NOT NULL,
                    last_index INTEGER DEFAULT 0,
                    normal_count INTEGER DEFAULT 0,
                    error_count INTEGER DEFAULT 0,
                    PRIMARY KEY (device_id, site_id)
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating progress table:', err.message);
                        reject(err);
                        return;
                    }
                });

                // Create history table
                this.db!.run(`CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action TEXT NOT NULL,
                    site_name TEXT NOT NULL,
                    diff_summary TEXT,
                    diff_details TEXT,
                    created_at DATETIME NOT NULL
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating history table:', err.message);
                        reject(err);
                        return;
                    }
                });

                // Create kv_settings table
                this.db!.run(`CREATE TABLE IF NOT EXISTS kv_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating kv_settings table:', err.message);
                        reject(err);
                        return;
                    }

                    // Seed default settings
                    this.seedDefaultSettings()
                        .then(() => {
                            console.log('✅ SQLite tables created successfully');
                            resolve();
                        })
                        .catch(reject);
                });
            });
        });
    }

    /**
     * Seed default settings into kv_settings table
     * Uses INSERT OR IGNORE to avoid duplicates
     */
    private async seedDefaultSettings(): Promise<void> {
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

        const promises = seeds.map(([key, value]) =>
            this.execute(
                'INSERT OR IGNORE INTO kv_settings (key, value) VALUES (?, ?)',
                [key, value]
            )
        );

        await Promise.all(promises);
    }

    /**
     * Execute a SELECT query and return results
     * @param sql SQL query string with ? placeholders
     * @param params Array of parameters to bind to query
     * @returns Promise resolving to array of result rows
     */
    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            this.db!.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('❌ SQLite query error:', err.message);
                    console.error('   SQL:', sql);
                    console.error('   Params:', params);
                    reject(err);
                    return;
                }
                resolve(rows as T[]);
            });
        });
    }

    /**
     * Execute an INSERT, UPDATE, or DELETE statement
     * @param sql SQL statement with ? placeholders
     * @param params Array of parameters to bind to statement
     * @returns Promise resolving to true if successful
     */
    async execute(sql: string, params: any[] = []): Promise<boolean> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            this.db!.run(sql, params, function (err) {
                if (err) {
                    console.error('❌ SQLite execute error:', err.message);
                    console.error('   SQL:', sql);
                    console.error('   Params:', params);
                    reject(err);
                    return;
                }
                resolve(true);
            });
        });
    }

    /**
     * Begin a new transaction
     * @returns Promise resolving to DatabaseTransaction instance
     */
    async beginTransaction(): Promise<DatabaseTransaction> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        // Start transaction
        await this.execute('BEGIN TRANSACTION', []);

        const transaction: DatabaseTransaction = {
            commit: async () => {
                await this.execute('COMMIT', []);
            },
            rollback: async () => {
                await this.execute('ROLLBACK', []);
            },
            query: async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
                return this.query<T>(sql, params);
            },
            execute: async (sql: string, params: any[] = []): Promise<boolean> => {
                return this.execute(sql, params);
            }
        };

        return transaction;
    }

    /**
     * Close database connection and cleanup resources
     * @returns Promise resolving to true if successful
     */
    async close(): Promise<boolean> {
        if (!this.db) {
            return true;
        }

        return new Promise((resolve, reject) => {
            this.db!.close((err) => {
                if (err) {
                    console.error('❌ Error closing SQLite database:', err.message);
                    reject(err);
                    return;
                }
                console.log('✅ SQLite database connection closed');
                this.db = null;
                resolve(true);
            });
        });
    }
}
