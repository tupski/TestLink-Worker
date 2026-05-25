/**
 * MySQL Schema Initialization Module
 * 
 * Provides schema creation and initialization for MySQL database.
 * Creates all required tables with proper indexes, foreign keys, and constraints.
 * 
 * **Validates: Requirements 1.2, 1.4, 10.3**
 */

import { DatabaseAdapter } from '../types/database';

/**
 * Create MySQL schema with all required tables
 * 
 * Creates the following tables:
 * - sites: Link categories with metadata
 * - progress: Testing progress per device per site
 * - history: Audit log of admin actions
 * - kv_settings: Key-value store for application settings
 * 
 * All tables use InnoDB engine with utf8mb4 charset for full Unicode support.
 * Indexes are added on frequently queried columns for optimal performance.
 * 
 * This function is idempotent - safe to run multiple times.
 * 
 * **Validates: Requirements 1.2, 1.4, 10.3**
 * 
 * @param db Initialized DatabaseAdapter instance (must be MySQL)
 * @returns Promise resolving to true if schema created successfully
 * @throws Error if database is not initialized or schema creation fails
 */
export async function createMySQLSchema(db: DatabaseAdapter): Promise<boolean> {
    if (db.config.type !== 'mysql') {
        throw new Error('createMySQLSchema() requires MySQL database adapter');
    }

    const transaction = await db.beginTransaction();

    try {
        // Create sites table
        // Stores link categories with metadata and ordering
        await transaction.execute(`
            CREATE TABLE IF NOT EXISTS sites (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                links TEXT NOT NULL,
                created_at DATETIME NOT NULL,
                sort_order INT DEFAULT 0,
                is_active TINYINT(1) DEFAULT 1,
                INDEX idx_sort_order (sort_order),
                INDEX idx_created_at (created_at),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `, []);

        console.log('[Schema] Created sites table');

        // Create progress table
        // Tracks testing progress per device per site
        await transaction.execute(`
            CREATE TABLE IF NOT EXISTS progress (
                device_id VARCHAR(255) NOT NULL,
                site_id VARCHAR(36) NOT NULL,
                last_index INT DEFAULT 0,
                normal_count INT DEFAULT 0,
                error_count INT DEFAULT 0,
                PRIMARY KEY (device_id, site_id),
                FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
                INDEX idx_device_id (device_id),
                INDEX idx_site_id (site_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `, []);

        console.log('[Schema] Created progress table');

        // Create history table
        // Audit log of admin actions with diff tracking
        await transaction.execute(`
            CREATE TABLE IF NOT EXISTS history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                action VARCHAR(50) NOT NULL,
                site_name VARCHAR(255) NOT NULL,
                diff_summary TEXT,
                diff_details TEXT,
                created_at DATETIME NOT NULL,
                INDEX idx_created_at (created_at),
                INDEX idx_action (action)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `, []);

        console.log('[Schema] Created history table');

        // Create kv_settings table
        // Key-value store for application settings
        await transaction.execute(`
            CREATE TABLE IF NOT EXISTS kv_settings (
                \`key\` VARCHAR(100) PRIMARY KEY,
                value TEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `, []);

        console.log('[Schema] Created kv_settings table');

        // Commit transaction
        await transaction.commit();

        console.log('[Schema] MySQL schema created successfully');
        return true;

    } catch (error) {
        // Rollback on error
        await transaction.rollback();
        console.error('[Schema] Failed to create MySQL schema:', error);
        throw error;
    }
}

/**
 * Seed default settings into kv_settings table
 * 
 * Inserts default application settings if they don't already exist.
 * Uses INSERT IGNORE to avoid duplicates on subsequent runs.
 * 
 * **Validates: Requirements 1.2, 9.6**
 * 
 * @param db Initialized DatabaseAdapter instance
 * @returns Promise resolving to true if seeding successful
 */
export async function seedDefaultSettings(db: DatabaseAdapter): Promise<boolean> {
    try {
        const seeds: [string, string][] = [
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

        // Use INSERT IGNORE for MySQL to avoid duplicates
        const insertSQL = db.config.type === 'mysql'
            ? 'INSERT IGNORE INTO kv_settings (`key`, value) VALUES (?, ?)'
            : 'INSERT OR IGNORE INTO kv_settings (key, value) VALUES (?, ?)';

        for (const [key, value] of seeds) {
            await db.execute(insertSQL, [key, value]);
        }

        console.log('[Schema] Default settings seeded successfully');
        return true;

    } catch (error) {
        console.error('[Schema] Failed to seed default settings:', error);
        throw error;
    }
}

/**
 * Initialize MySQL database with schema and seed data
 * 
 * Convenience function that creates schema and seeds default settings.
 * This is the main entry point for MySQL database initialization.
 * 
 * **Validates: Requirements 1.2, 1.4**
 * 
 * @param db Initialized DatabaseAdapter instance (must be MySQL)
 * @returns Promise resolving to true if initialization successful
 */
export async function initializeMySQLDatabase(db: DatabaseAdapter): Promise<boolean> {
    if (db.config.type !== 'mysql') {
        throw new Error('initializeMySQLDatabase() requires MySQL database adapter');
    }

    try {
        // Create schema
        await createMySQLSchema(db);

        // Seed default settings
        await seedDefaultSettings(db);

        console.log('[Schema] MySQL database initialized successfully');
        return true;

    } catch (error) {
        console.error('[Schema] Failed to initialize MySQL database:', error);
        throw error;
    }
}
