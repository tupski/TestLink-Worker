/**
 * MySQL Database Adapter
 * 
 * Implements DatabaseAdapter interface for MySQL database with connection pooling.
 * Provides prepared statement support for all queries and transaction management.
 * Includes enhanced error handling, logging, and connection retry mechanism.
 * 
 * **Validates: Requirements 1.1, 1.3, 10.1, 10.2, 11.1, 11.2, 11.4, 10.5**
 */

import mysql from 'mysql2/promise';
import { DatabaseAdapter, DatabaseConfig, DatabaseTransaction } from '../types/database';
import { initializeMySQLDatabase } from './schema';
import { logger } from '../utils/logger';
import { withRetry, isRetryableError, DatabaseError } from '../utils/retry';

/**
 * MySQL implementation of DatabaseAdapter
 * Uses connection pooling for efficient resource management
 */
export class MySQLAdapter implements DatabaseAdapter {
    public config: DatabaseConfig;
    private pool: mysql.Pool | null = null;

    constructor(config: DatabaseConfig) {
        this.config = config;
    }

    /**
     * Initialize MySQL connection pool and verify connectivity
     * Includes retry logic for connection failures
     * 
     * **Validates: Requirements 1.3, 1.4, 10.2, 11.1, 11.3**
     */
    async initialize(): Promise<boolean> {
        // Validate configuration first (don't retry config errors)
        if (!this.config.host || !this.config.user || !this.config.password) {
            throw new Error('MySQL configuration requires host, user, and password');
        }

        return withRetry(async () => {
            try {
                this.pool = mysql.createPool({
                    host: this.config.host,
                    port: this.config.port || 3306,
                    user: this.config.user,
                    password: this.config.password,
                    database: this.config.database,
                    waitForConnections: true,
                    connectionLimit: this.config.connectionLimit || 10,
                    maxIdle: this.config.connectionLimit || 10,
                    idleTimeout: 60000,
                    queueLimit: 0,
                    enableKeepAlive: true,
                    keepAliveInitialDelay: 0
                });


                const connection = await this.pool.getConnection();
                await connection.ping();
                connection.release();

                logger.logConnection('connect', {
                    host: this.config.host,
                    port: this.config.port || 3306,
                    database: this.config.database,
                    connectionLimit: this.config.connectionLimit || 10
                });

                await initializeMySQLDatabase(this);
                return true;
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                logger.logConnection('error', { host: this.config.host, error: err.message });

                if (isRetryableError(err)) {
                    throw err;
                }
                throw new DatabaseError(err);
            }
        }, { maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 10000 });
    }

    /**
     * Execute a SELECT query with prepared statement support
     * **Validates: Requirements 10.1, 11.2, 11.4, 10.5**
     */
    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        if (!this.pool) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        const startTime = Date.now();

        try {
            const [rows] = await this.pool.execute(sql, params);
            const duration = Date.now() - startTime;
            logger.logQuery(sql, params, duration);
            return rows as T[];
        } catch (error) {
            const duration = Date.now() - startTime;
            const err = error instanceof Error ? error : new Error(String(error));
            logger.logQuery(sql, params, duration, err);
            throw new DatabaseError(err);
        }
    }


    /**
     * Execute an INSERT, UPDATE, or DELETE statement
     * **Validates: Requirements 10.1, 11.2, 11.4, 10.5**
     */
    async execute(sql: string, params: any[] = []): Promise<boolean> {
        if (!this.pool) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        const startTime = Date.now();

        try {
            await this.pool.execute(sql, params);
            const duration = Date.now() - startTime;
            logger.logQuery(sql, params, duration);
            return true;
        } catch (error) {
            const duration = Date.now() - startTime;
            const err = error instanceof Error ? error : new Error(String(error));
            logger.logQuery(sql, params, duration, err);
            throw new DatabaseError(err);
        }
    }

    /**
     * Begin a new database transaction
     * **Validates: Requirements 10.4**
     */
    async beginTransaction(): Promise<DatabaseTransaction> {
        if (!this.pool) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        const connection = await this.pool.getConnection();
        await connection.beginTransaction();

        return {
            async commit(): Promise<void> {
                try {
                    await connection.commit();
                } finally {
                    connection.release();
                }
            },

            async rollback(): Promise<void> {
                try {
                    await connection.rollback();
                } finally {
                    connection.release();
                }
            },


            async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
                const startTime = Date.now();
                try {
                    const [rows] = await connection.execute(sql, params);
                    const duration = Date.now() - startTime;
                    logger.logQuery(sql, params, duration);
                    return rows as T[];
                } catch (error) {
                    const duration = Date.now() - startTime;
                    const err = error instanceof Error ? error : new Error(String(error));
                    logger.logQuery(sql, params, duration, err);
                    throw error;
                }
            },

            async execute(sql: string, params: any[] = []): Promise<boolean> {
                const startTime = Date.now();
                try {
                    await connection.execute(sql, params);
                    const duration = Date.now() - startTime;
                    logger.logQuery(sql, params, duration);
                    return true;
                } catch (error) {
                    const duration = Date.now() - startTime;
                    const err = error instanceof Error ? error : new Error(String(error));
                    logger.logQuery(sql, params, duration, err);
                    throw error;
                }
            }
        };
    }

    /**
     * Close database connection pool
     * **Validates: Requirements 10.6**
     */
    async close(): Promise<boolean> {
        if (!this.pool) {
            return true;
        }

        try {
            await this.pool.end();
            this.pool = null;
            logger.logConnection('disconnect', { database: this.config.database });
            return true;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.logConnection('error', { error: err.message });
            throw error;
        }
    }

    /**
     * Get connection pool statistics
     */
    getPoolStats(): { totalConnections: number; activeConnections: number; idleConnections: number } | null {
        if (!this.pool) return null;
        return {
            totalConnections: this.config.connectionLimit || 10,
            activeConnections: 0,
            idleConnections: 0
        };
    }
}
