#!/usr/bin/env ts-node
/**
 * SQLite to MySQL Migration Script
 * 
 * Standalone executable script that migrates all data from SQLite to MySQL.
 * Reads all data from SQLite database and writes to MySQL in batches with
 * transaction support.
 * 
 * Usage:
 *   npx ts-node src/scripts/migrate.ts
 *   
 * Environment Variables Required:
 *   - SQLITE_PATH: Path to source SQLite database (default: ./data/database.sqlite)
 *   - DB_HOST: MySQL host
 *   - DB_PORT: MySQL port (default: 3306)
 *   - DB_USER: MySQL username
 *   - DB_PASSWORD: MySQL password
 *   - DB_NAME: MySQL database name
 * 
 * **Validates: Requirements 2.1, 2.2, 2.4, 2.6**
 */

import 'dotenv/config';
import * as readline from 'readline';
import { SQLiteAdapter } from '../database/sqlite-adapter';
import { MySQLAdapter } from '../database/mysql-adapter';
import { DatabaseConfig, Site, Progress, History, KVSetting, MigrationResult } from '../types/database';

// Batch size for data transfer
const BATCH_SIZE = 100;

/**
 * Create readline interface for user prompts
 */
function createReadlineInterface(): readline.Interface {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
    const rl = createReadlineInterface();

    return new Promise((resolve) => {
        rl.question(`${message} (y/N): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

/**
 * Display progress bar
 */
function displayProgress(current: number, total: number, label: string): void {
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filled = Math.round((current / total) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

    process.stdout.write(`\r  ${label}: [${bar}] ${percentage}% (${current}/${total})`);

    if (current === total) {
        process.stdout.write('\n');
    }
}

/**
 * Load SQLite configuration
 */
function loadSQLiteConfig(): DatabaseConfig {
    return {
        type: 'sqlite',
        database: process.env.SQLITE_PATH || './data/database.sqlite'
    };
}

/**
 * Load MySQL configuration from environment
 */
function loadMySQLConfig(): DatabaseConfig {
    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;

    if (!host || !user || !password || !database) {
        throw new Error(
            'Missing required MySQL configuration.\n' +
            'Please set DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME environment variables.'
        );
    }

    return {
        type: 'mysql',
        host,
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user,
        password,
        database,
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10)
    };
}

/**
 * Check if MySQL database has existing data
 */
async function checkExistingData(mysql: MySQLAdapter): Promise<{ sites: number; progress: number; history: number; settings: number }> {
    const [sitesResult] = await mysql.query<{ count: number }>('SELECT COUNT(*) as count FROM sites');
    const [progressResult] = await mysql.query<{ count: number }>('SELECT COUNT(*) as count FROM progress');
    const [historyResult] = await mysql.query<{ count: number }>('SELECT COUNT(*) as count FROM history');
    const [settingsResult] = await mysql.query<{ count: number }>('SELECT COUNT(*) as count FROM kv_settings');

    return {
        sites: sitesResult?.count || 0,
        progress: progressResult?.count || 0,
        history: historyResult?.count || 0,
        settings: settingsResult?.count || 0
    };
}

/**
 * Clear existing data from MySQL tables
 */
async function clearMySQLData(mysql: MySQLAdapter): Promise<void> {
    console.log('  Clearing existing MySQL data...');

    const transaction = await mysql.beginTransaction();

    try {
        // Delete in order respecting foreign keys
        await transaction.execute('DELETE FROM progress');
        await transaction.execute('DELETE FROM history');
        await transaction.execute('DELETE FROM kv_settings');
        await transaction.execute('DELETE FROM sites');

        await transaction.commit();
        console.log('  ✅ Existing data cleared');
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * Migrate sites table
 */
async function migrateSites(sqlite: SQLiteAdapter, mysql: MySQLAdapter): Promise<number> {
    const sites = await sqlite.query<Site>('SELECT * FROM sites ORDER BY id');

    if (sites.length === 0) {
        console.log('  Sites: No data to migrate');
        return 0;
    }

    console.log(`  Migrating ${sites.length} sites...`);

    let migrated = 0;

    for (let i = 0; i < sites.length; i += BATCH_SIZE) {
        const batch = sites.slice(i, i + BATCH_SIZE);
        const transaction = await mysql.beginTransaction();

        try {
            for (const site of batch) {
                await transaction.execute(
                    `INSERT INTO sites (id, name, links, created_at, sort_order, is_active) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        site.id,
                        site.name,
                        site.links,
                        site.created_at,
                        site.sort_order || 0,
                        site.is_active ?? 1
                    ]
                );
                migrated++;
            }

            await transaction.commit();
            displayProgress(Math.min(i + BATCH_SIZE, sites.length), sites.length, 'Sites');
        } catch (error) {
            await transaction.rollback();
            throw new Error(`Failed to migrate sites batch at index ${i}: ${error}`);
        }
    }

    return migrated;
}

/**
 * Migrate progress table
 */
async function migrateProgress(sqlite: SQLiteAdapter, mysql: MySQLAdapter): Promise<number> {
    const progress = await sqlite.query<Progress>('SELECT * FROM progress ORDER BY device_id, site_id');

    if (progress.length === 0) {
        console.log('  Progress: No data to migrate');
        return 0;
    }

    console.log(`  Migrating ${progress.length} progress records...`);

    let migrated = 0;

    for (let i = 0; i < progress.length; i += BATCH_SIZE) {
        const batch = progress.slice(i, i + BATCH_SIZE);
        const transaction = await mysql.beginTransaction();

        try {
            for (const p of batch) {
                await transaction.execute(
                    `INSERT INTO progress (device_id, site_id, last_index, normal_count, error_count) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        p.device_id,
                        p.site_id,
                        p.last_index || 0,
                        p.normal_count || 0,
                        p.error_count || 0
                    ]
                );
                migrated++;
            }

            await transaction.commit();
            displayProgress(Math.min(i + BATCH_SIZE, progress.length), progress.length, 'Progress');
        } catch (error) {
            await transaction.rollback();
            throw new Error(`Failed to migrate progress batch at index ${i}: ${error}`);
        }
    }

    return migrated;
}

/**
 * Migrate history table
 */
async function migrateHistory(sqlite: SQLiteAdapter, mysql: MySQLAdapter): Promise<number> {
    const history = await sqlite.query<History>('SELECT * FROM history ORDER BY id');

    if (history.length === 0) {
        console.log('  History: No data to migrate');
        return 0;
    }

    console.log(`  Migrating ${history.length} history records...`);

    let migrated = 0;

    for (let i = 0; i < history.length; i += BATCH_SIZE) {
        const batch = history.slice(i, i + BATCH_SIZE);
        const transaction = await mysql.beginTransaction();

        try {
            for (const h of batch) {
                await transaction.execute(
                    `INSERT INTO history (id, action, site_name, diff_summary, diff_details, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        h.id,
                        h.action,
                        h.site_name,
                        h.diff_summary,
                        h.diff_details,
                        h.created_at
                    ]
                );
                migrated++;
            }

            await transaction.commit();
            displayProgress(Math.min(i + BATCH_SIZE, history.length), history.length, 'History');
        } catch (error) {
            await transaction.rollback();
            throw new Error(`Failed to migrate history batch at index ${i}: ${error}`);
        }
    }

    return migrated;
}

/**
 * Migrate kv_settings table
 */
async function migrateSettings(sqlite: SQLiteAdapter, mysql: MySQLAdapter): Promise<number> {
    const settings = await sqlite.query<KVSetting>('SELECT * FROM kv_settings ORDER BY key');

    if (settings.length === 0) {
        console.log('  Settings: No data to migrate');
        return 0;
    }

    console.log(`  Migrating ${settings.length} settings...`);

    let migrated = 0;
    const transaction = await mysql.beginTransaction();

    try {
        for (const setting of settings) {
            // Use REPLACE to overwrite default settings with SQLite values
            await transaction.execute(
                `REPLACE INTO kv_settings (\`key\`, value) VALUES (?, ?)`,
                [setting.key, setting.value]
            );
            migrated++;
            displayProgress(migrated, settings.length, 'Settings');
        }

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw new Error(`Failed to migrate settings: ${error}`);
    }

    return migrated;
}

/**
 * Verify migration by comparing record counts
 * 
 * **Validates: Requirements 2.3**
 */
async function verifyMigration(
    sqlite: SQLiteAdapter,
    mysql: MySQLAdapter
): Promise<{ success: boolean; details: string[] }> {
    const details: string[] = [];
    let success = true;

    // Get SQLite counts
    const sqliteSitesResult = await sqlite.query<{ count: number }>('SELECT COUNT(*) as count FROM sites');
    const sqliteProgressResult = await sqlite.query<{ count: number }>('SELECT COUNT(*) as count FROM progress');
    const sqliteHistoryResult = await sqlite.query<{ count: number }>('SELECT COUNT(*) as count FROM history');
    const sqliteSettingsResult = await sqlite.query<{ count: number }>('SELECT COUNT(*) as count FROM kv_settings');

    // Get MySQL counts
    const mysqlSitesResult = await mysql.query<{ count: number }>('SELECT COUNT(*) as count FROM sites');
    const mysqlProgressResult = await mysql.query<{ count: number }>('SELECT COUNT(*) as count FROM progress');
    const mysqlHistoryResult = await mysql.query<{ count: number }>('SELECT COUNT(*) as count FROM history');
    const mysqlSettingsResult = await mysql.query<{ count: number }>('SELECT COUNT(*) as count FROM kv_settings');

    const sqliteSitesCount = sqliteSitesResult[0]?.count ?? 0;
    const sqliteProgressCount = sqliteProgressResult[0]?.count ?? 0;
    const sqliteHistoryCount = sqliteHistoryResult[0]?.count ?? 0;
    const sqliteSettingsCount = sqliteSettingsResult[0]?.count ?? 0;

    const mysqlSitesCount = mysqlSitesResult[0]?.count ?? 0;
    const mysqlProgressCount = mysqlProgressResult[0]?.count ?? 0;
    const mysqlHistoryCount = mysqlHistoryResult[0]?.count ?? 0;
    const mysqlSettingsCount = mysqlSettingsResult[0]?.count ?? 0;

    // Compare counts
    if (sqliteSitesCount !== mysqlSitesCount) {
        details.push(`Sites mismatch: SQLite=${sqliteSitesCount}, MySQL=${mysqlSitesCount}`);
        success = false;
    } else {
        details.push(`✅ Sites: ${mysqlSitesCount} records`);
    }

    if (sqliteProgressCount !== mysqlProgressCount) {
        details.push(`Progress mismatch: SQLite=${sqliteProgressCount}, MySQL=${mysqlProgressCount}`);
        success = false;
    } else {
        details.push(`✅ Progress: ${mysqlProgressCount} records`);
    }

    if (sqliteHistoryCount !== mysqlHistoryCount) {
        details.push(`History mismatch: SQLite=${sqliteHistoryCount}, MySQL=${mysqlHistoryCount}`);
        success = false;
    } else {
        details.push(`✅ History: ${mysqlHistoryCount} records`);
    }

    // Settings might have more in MySQL due to default seeding
    if (sqliteSettingsCount > mysqlSettingsCount) {
        details.push(`Settings mismatch: SQLite=${sqliteSettingsCount}, MySQL=${mysqlSettingsCount}`);
        success = false;
    } else {
        details.push(`✅ Settings: ${mysqlSettingsCount} records (SQLite had ${sqliteSettingsCount})`);
    }

    return { success, details };
}

/**
 * Main migration function
 * 
 * **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.6**
 */
async function migrate(): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║       SQLite to MySQL Migration Script                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Load configurations
    let sqliteConfig: DatabaseConfig;
    let mysqlConfig: DatabaseConfig;

    try {
        sqliteConfig = loadSQLiteConfig();
        console.log(`📂 Source SQLite: ${sqliteConfig.database}`);
    } catch (error) {
        console.error('❌ Failed to load SQLite configuration:', error);
        return {
            success: false,
            sitesCount: 0,
            progressCount: 0,
            historyCount: 0,
            settingsCount: 0,
            errors: [`SQLite config error: ${error}`],
            duration: Date.now() - startTime
        };
    }

    try {
        mysqlConfig = loadMySQLConfig();
        console.log(`🗄️  Target MySQL: ${mysqlConfig.host}:${mysqlConfig.port}/${mysqlConfig.database}`);
    } catch (error) {
        console.error('❌ Failed to load MySQL configuration:', error);
        return {
            success: false,
            sitesCount: 0,
            progressCount: 0,
            historyCount: 0,
            settingsCount: 0,
            errors: [`MySQL config error: ${error}`],
            duration: Date.now() - startTime
        };
    }

    // Initialize adapters
    let sqlite: SQLiteAdapter | null = null;
    let mysql: MySQLAdapter | null = null;

    try {
        console.log('\n📡 Connecting to databases...');

        sqlite = new SQLiteAdapter(sqliteConfig);
        await sqlite.initialize();
        console.log('  ✅ SQLite connected');

        mysql = new MySQLAdapter(mysqlConfig);
        await mysql.initialize();
        console.log('  ✅ MySQL connected');

        // Check for existing data in MySQL
        const existingData = await checkExistingData(mysql);
        const hasExistingData = existingData.sites > 0 || existingData.progress > 0 ||
            existingData.history > 0 || existingData.settings > 7; // 7 is default seed count

        if (hasExistingData) {
            console.log('\n⚠️  MySQL database contains existing data:');
            console.log(`   Sites: ${existingData.sites}`);
            console.log(`   Progress: ${existingData.progress}`);
            console.log(`   History: ${existingData.history}`);
            console.log(`   Settings: ${existingData.settings}`);

            const confirmed = await promptConfirmation('\nDo you want to overwrite existing data?');

            if (!confirmed) {
                console.log('\n❌ Migration cancelled by user.');
                return {
                    success: false,
                    sitesCount: 0,
                    progressCount: 0,
                    historyCount: 0,
                    settingsCount: 0,
                    errors: ['Migration cancelled by user'],
                    duration: Date.now() - startTime
                };
            }

            await clearMySQLData(mysql);
        }

        // Perform migration
        console.log('\n📦 Starting data migration...\n');

        const sitesCount = await migrateSites(sqlite, mysql);
        const progressCount = await migrateProgress(sqlite, mysql);
        const historyCount = await migrateHistory(sqlite, mysql);
        const settingsCount = await migrateSettings(sqlite, mysql);

        // Verify migration
        console.log('\n🔍 Verifying migration...');
        const verification = await verifyMigration(sqlite, mysql);

        verification.details.forEach(detail => console.log(`   ${detail}`));

        if (!verification.success) {
            errors.push('Migration verification failed');
        }

        const duration = Date.now() - startTime;

        // Display summary
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                    Migration Summary                       ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║  Sites migrated:     ${String(sitesCount).padStart(6)}                            ║`);
        console.log(`║  Progress migrated:  ${String(progressCount).padStart(6)}                            ║`);
        console.log(`║  History migrated:   ${String(historyCount).padStart(6)}                            ║`);
        console.log(`║  Settings migrated:  ${String(settingsCount).padStart(6)}                            ║`);
        console.log(`║  Duration:           ${String(duration + 'ms').padStart(6)}                            ║`);
        console.log(`║  Status:             ${verification.success ? '✅ SUCCESS' : '❌ FAILED '}                          ║`);
        console.log('╚════════════════════════════════════════════════════════════╝\n');

        return {
            success: verification.success && errors.length === 0,
            sitesCount,
            progressCount,
            historyCount,
            settingsCount,
            errors,
            duration
        };

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        errors.push(String(error));

        return {
            success: false,
            sitesCount: 0,
            progressCount: 0,
            historyCount: 0,
            settingsCount: 0,
            errors,
            duration: Date.now() - startTime
        };

    } finally {
        // Cleanup connections
        if (sqlite) {
            try {
                await sqlite.close();
            } catch (e) {
                console.error('Error closing SQLite:', e);
            }
        }
        if (mysql) {
            try {
                await mysql.close();
            } catch (e) {
                console.error('Error closing MySQL:', e);
            }
        }
    }
}

// Run migration if executed directly
if (require.main === module) {
    migrate()
        .then((result) => {
            process.exit(result.success ? 0 : 1);
        })
        .catch((error) => {
            console.error('Unexpected error:', error);
            process.exit(1);
        });
}

export { migrate, verifyMigration, loadSQLiteConfig, loadMySQLConfig };
