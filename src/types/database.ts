/**
 * Database Type Definitions
 * 
 * Type definitions for database configuration and adapters
 * supporting both SQLite and MySQL databases.
 * 
 * **Validates: Requirements 1.1, 1.5**
 */

export type DatabaseType = 'sqlite' | 'mysql';

/**
 * Database configuration interface
 * Supports both SQLite (file-based) and MySQL (connection-based) databases
 */
export interface DatabaseConfig {
    type: DatabaseType;
    host?: string;              // MySQL host (required for mysql type)
    port?: number;              // MySQL port (required for mysql type, default: 3306)
    user?: string;              // MySQL username (required for mysql type)
    password?: string;          // MySQL password (required for mysql type)
    database: string;           // Database name or file path
    connectionLimit?: number;   // Max connections for MySQL pool (default: 10)
}

/**
 * Transaction interface for database operations
 * Provides commit and rollback capabilities
 */
export interface DatabaseTransaction {
    commit(): Promise<void>;
    rollback(): Promise<void>;
    query<T = any>(sql: string, params?: any[]): Promise<T[]>;
    execute(sql: string, params?: any[]): Promise<boolean>;
}

/**
 * Database adapter interface
 * Provides abstraction layer for database operations
 */
export interface DatabaseAdapter {
    config: DatabaseConfig;

    /**
     * Initialize database connection and create tables if needed
     * @returns Promise resolving to true if successful
     */
    initialize(): Promise<boolean>;

    /**
     * Execute a SELECT query and return results
     * @param sql SQL query string with ? placeholders
     * @param params Array of parameters to bind to query
     * @returns Promise resolving to array of result rows
     */
    query<T = any>(sql: string, params?: any[]): Promise<T[]>;

    /**
     * Execute an INSERT, UPDATE, or DELETE statement
     * @param sql SQL statement with ? placeholders
     * @param params Array of parameters to bind to statement
     * @returns Promise resolving to true if successful
     */
    execute(sql: string, params?: any[]): Promise<boolean>;

    /**
     * Begin a new transaction
     * @returns Promise resolving to DatabaseTransaction instance
     */
    beginTransaction(): Promise<DatabaseTransaction>;

    /**
     * Close database connection and cleanup resources
     * @returns Promise resolving to true if successful
     */
    close(): Promise<boolean>;
}

/**
 * Result of database migration operation
 */
export interface MigrationResult {
    success: boolean;
    sitesCount: number;
    progressCount: number;
    historyCount: number;
    settingsCount: number;
    errors: string[];
    duration: number;           // Duration in milliseconds
}

/**
 * Query result metadata
 */
export interface QueryResult {
    affectedRows?: number;
    insertId?: number;
    changedRows?: number;
}

/**
 * Connection pool statistics (for MySQL)
 */
export interface PoolStats {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    queuedRequests: number;
}

// ============================================================================
// Table Schema Interfaces
// ============================================================================

/**
 * Site table schema
 * Represents a category of links to test
 */
export interface Site {
    id: string;                 // UUID primary key
    name: string;               // Display name of the site category
    links: string;              // Newline-separated list of URLs
    created_at: string;         // ISO datetime string
    sort_order: number;         // Display order (lower = higher priority)
    is_active: number;          // 1 = active, 0 = inactive (boolean as integer)
}

/**
 * Progress table schema
 * Tracks testing progress per device per site
 */
export interface Progress {
    device_id: string;          // Device identifier (composite key)
    site_id: string;            // Site ID reference (composite key)
    last_index: number;         // Last tested link index
    normal_count: number;       // Count of successful tests
    error_count: number;        // Count of failed tests
}

/**
 * History table schema
 * Audit log of admin actions
 */
export interface History {
    id?: number;                // Auto-increment primary key
    action: string;             // Action type: 'ADD', 'EDIT', 'DELETE'
    site_name: string;          // Name of affected site
    diff_summary: string | null; // Human-readable summary of changes
    diff_details: string | null; // JSON string with detailed diff
    created_at: string;         // ISO datetime string
}

/**
 * KV Settings table schema
 * Key-value store for application settings
 */
export interface KVSetting {
    key: string;                // Setting key (primary key)
    value: string;              // Setting value (stored as string)
}

/**
 * Diff details structure (stored as JSON in history.diff_details)
 */
export interface DiffDetails {
    added: string[];            // Array of added links
    removed: string[];          // Array of removed links
}

/**
 * Site with progress information (enriched for worker app)
 */
export interface SiteWithProgress extends Site {
    progress: {
        last_index: number;
        normal_count: number;
        error_count: number;
    };
}

/**
 * Admin statistics response
 */
export interface AdminStats {
    siteCount: number;
    linkCount: number;
    historyCount: number;
}

/**
 * History metadata response
 */
export interface HistoryMeta {
    newestId: number;
    newestAt: string | null;
}
