/**
 * Logger Utility Module
 * 
 * Provides structured logging for database operations, errors, and performance monitoring.
 * Supports different log levels and formats for development and production environments.
 * 
 * **Validates: Requirements 11.2, 11.4, 10.5**
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, any>;
}

export interface QueryLogEntry extends LogEntry {
    sql: string;
    params?: any[];
    duration?: number;
    error?: string;
}

/**
 * Logger class for structured logging
 */
export class Logger {
    private static instance: Logger;
    private logLevel: LogLevel;
    private isProduction: boolean;

    private constructor() {
        this.isProduction = process.env.NODE_ENV === 'production';
        this.logLevel = (process.env.LOG_LEVEL as LogLevel) || (this.isProduction ? 'info' : 'debug');
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
        return levels.indexOf(level) >= levels.indexOf(this.logLevel);
    }


    private formatTimestamp(): string {
        return new Date().toISOString();
    }

    private formatMessage(entry: LogEntry): string {
        const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
        let message = `${prefix} ${entry.message}`;

        if (entry.context && Object.keys(entry.context).length > 0) {
            if (this.isProduction) {
                // In production, use JSON format for easier parsing
                message += ` ${JSON.stringify(entry.context)}`;
            } else {
                // In development, use readable format
                message += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
            }
        }

        return message;
    }

    private log(level: LogLevel, message: string, context?: Record<string, any>): void {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            timestamp: this.formatTimestamp(),
            level,
            message,
            context
        };

        const formattedMessage = this.formatMessage(entry);

        switch (level) {
            case 'debug':
                console.debug(formattedMessage);
                break;
            case 'info':
                console.info(formattedMessage);
                break;
            case 'warn':
                console.warn(formattedMessage);
                break;
            case 'error':
                console.error(formattedMessage);
                break;
        }
    }

    debug(message: string, context?: Record<string, any>): void {
        this.log('debug', message, context);
    }

    info(message: string, context?: Record<string, any>): void {
        this.log('info', message, context);
    }

    warn(message: string, context?: Record<string, any>): void {
        this.log('warn', message, context);
    }

    error(message: string, context?: Record<string, any>): void {
        this.log('error', message, context);
    }


    /**
     * Log a database query with timing information
     * Logs warnings for slow queries (>1 second)
     * 
     * **Validates: Requirements 11.4, 10.5**
     */
    logQuery(sql: string, params: any[] = [], duration: number, error?: Error): void {
        const SLOW_QUERY_THRESHOLD = 1000; // 1 second

        const context: Record<string, any> = {
            sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
            params: this.sanitizeParams(params),
            durationMs: duration
        };

        if (error) {
            context.error = error.message;
            this.error('[Database] Query failed', context);
        } else if (duration > SLOW_QUERY_THRESHOLD) {
            this.warn(`[Database] Slow query detected (${duration}ms)`, context);
        } else {
            this.debug('[Database] Query executed', context);
        }
    }

    /**
     * Log a database connection event
     */
    logConnection(event: 'connect' | 'disconnect' | 'error' | 'retry', details?: Record<string, any>): void {
        const messages: Record<string, string> = {
            connect: '[Database] Connection established',
            disconnect: '[Database] Connection closed',
            error: '[Database] Connection error',
            retry: '[Database] Connection retry attempt'
        };

        const level: LogLevel = event === 'error' ? 'error' : event === 'retry' ? 'warn' : 'info';
        this.log(level, messages[event] || '[Database] Unknown event', details);
    }

    /**
     * Log an API request
     */
    logRequest(method: string, path: string, statusCode: number, duration: number, error?: string): void {
        const context: Record<string, any> = {
            method,
            path,
            statusCode,
            durationMs: duration
        };

        if (error) {
            context.error = error;
            this.error('[API] Request failed', context);
        } else if (statusCode >= 400) {
            this.warn('[API] Request error response', context);
        } else {
            this.debug('[API] Request completed', context);
        }
    }

    /**
     * Sanitize parameters to avoid logging sensitive data
     */
    private sanitizeParams(params: any[]): any[] {
        return params.map((param) => {
            if (typeof param === 'string' && param.length > 100) {
                return `[String: ${param.length} chars]`;
            }
            // Don't log potential passwords or API keys
            if (typeof param === 'string' &&
                (param.includes('password') || param.includes('api_key') || param.includes('secret'))) {
                return '[REDACTED]';
            }
            return param;
        });
    }
}

// Export singleton instance
export const logger = Logger.getInstance();
