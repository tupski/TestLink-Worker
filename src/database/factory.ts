/**
 * Database Factory Module
 * 
 * Factory function to instantiate the correct database adapter
 * based on configuration loaded from environment variables.
 * 
 * **Validates: Requirements 1.5, 3.2**
 */

import { DatabaseAdapter, DatabaseConfig, DatabaseType } from '../types/database.js';

/**
 * Load database configuration from environment variables
 * 
 * Reads configuration from process.env and constructs a DatabaseConfig object.
 * Validates required fields based on database type.
 * 
 * @returns DatabaseConfig object populated from environment variables
 * @throws Error if required environment variables are missing or invalid
 */
export function loadDatabaseConfig(): DatabaseConfig {
    const dbType = (process.env.DB_TYPE || 'sqlite') as DatabaseType;

    // Validate database type
    if (dbType !== 'sqlite' && dbType !== 'mysql') {
        throw new Error(`Invalid DB_TYPE: ${dbType}. Must be 'sqlite' or 'mysql'`);
    }

    // Base configuration
    const config: DatabaseConfig = {
        type: dbType,
        database: '',
    };

    if (dbType === 'mysql') {
        // MySQL configuration - validate required fields
        const host = process.env.DB_HOST;
        const user = process.env.DB_USER;
        const password = process.env.DB_PASSWORD;
        const database = process.env.DB_NAME;

        if (!host || !user || !password || !database) {
            throw new Error(
                'Missing required MySQL configuration. ' +
                'Please set DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME environment variables.'
            );
        }

        // Parse port with validation
        const portStr = process.env.DB_PORT || '3306';
        const port = parseInt(portStr, 10);

        if (isNaN(port) || port < 1 || port > 65535) {
            throw new Error(`Invalid DB_PORT: ${portStr}. Must be a number between 1 and 65535.`);
        }

        // Parse connection limit with validation
        const connectionLimitStr = process.env.DB_CONNECTION_LIMIT || '10';
        const connectionLimit = parseInt(connectionLimitStr, 10);

        if (isNaN(connectionLimit) || connectionLimit < 1) {
            throw new Error(`Invalid DB_CONNECTION_LIMIT: ${connectionLimitStr}. Must be a positive number.`);
        }

        config.host = host;
        config.port = port;
        config.user = user;
        config.password = password;
        config.database = database;
        config.connectionLimit = connectionLimit;

    } else {
        // SQLite configuration
        const sqlitePath = process.env.SQLITE_PATH || './data/database.sqlite';
        config.database = sqlitePath;
    }

    return config;
}

/**
 * Create a database adapter instance based on configuration
 * 
 * Factory function that instantiates the appropriate DatabaseAdapter
 * implementation (MySQL or SQLite) based on the provided configuration.
 * 
 * @param config DatabaseConfig object specifying database type and connection details
 * @returns DatabaseAdapter instance (MySQLAdapter or SQLiteAdapter)
 * @throws Error if database type is not supported or adapter initialization fails
 */
export async function createDatabaseAdapter(config: DatabaseConfig): Promise<DatabaseAdapter> {
    let adapter: DatabaseAdapter;

    if (config.type === 'mysql') {
        // Dynamically import MySQL adapter
        const { MySQLAdapter } = await import('./mysql-adapter.js');
        adapter = new MySQLAdapter(config);
    } else if (config.type === 'sqlite') {
        // Dynamically import SQLite adapter
        const { SQLiteAdapter } = await import('./sqlite-adapter.js');
        adapter = new SQLiteAdapter(config);
    } else {
        throw new Error(`Unsupported database type: ${config.type}`);
    }

    // Initialize the adapter (create tables, establish connection, etc.)
    const initialized = await adapter.initialize();

    if (!initialized) {
        throw new Error(`Failed to initialize ${config.type} database adapter`);
    }

    return adapter;
}

/**
 * Create a database adapter using environment variable configuration
 * 
 * Convenience function that combines loadDatabaseConfig() and createDatabaseAdapter().
 * This is the primary entry point for application code.
 * 
 * @returns Promise resolving to initialized DatabaseAdapter instance
 * @throws Error if configuration is invalid or adapter initialization fails
 */
export async function createDatabaseAdapterFromEnv(): Promise<DatabaseAdapter> {
    const config = loadDatabaseConfig();
    return createDatabaseAdapter(config);
}

/**
 * Validate database configuration without creating an adapter
 * 
 * Useful for configuration validation during application startup
 * or in configuration management tools.
 * 
 * @param config DatabaseConfig object to validate
 * @returns true if configuration is valid
 * @throws Error with descriptive message if configuration is invalid
 */
export function validateDatabaseConfig(config: DatabaseConfig): boolean {
    // Validate type
    if (config.type !== 'sqlite' && config.type !== 'mysql') {
        throw new Error(`Invalid database type: ${config.type}`);
    }

    // Validate database name/path
    if (!config.database || config.database.trim() === '') {
        throw new Error('Database name or path is required');
    }

    // MySQL-specific validation
    if (config.type === 'mysql') {
        if (!config.host || config.host.trim() === '') {
            throw new Error('MySQL host is required');
        }

        if (!config.user || config.user.trim() === '') {
            throw new Error('MySQL user is required');
        }

        if (!config.password || config.password.trim() === '') {
            throw new Error('MySQL password is required');
        }

        if (config.port !== undefined) {
            if (config.port < 1 || config.port > 65535) {
                throw new Error(`Invalid port: ${config.port}. Must be between 1 and 65535`);
            }
        }

        if (config.connectionLimit !== undefined) {
            if (config.connectionLimit < 1) {
                throw new Error(`Invalid connection limit: ${config.connectionLimit}. Must be positive`);
            }
        }
    }

    return true;
}
