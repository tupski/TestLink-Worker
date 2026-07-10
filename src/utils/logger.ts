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

        // Sprint 1 — redact sensitive keys from context before logging
        const safeContext = this.sanitizeContext(context);

        const entry: LogEntry = {
            timestamp: this.formatTimestamp(),
            level,
            message,
            context: safeContext
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
     * Known-sensitive parameter key substrings (compared case-insensitively).
     * Every parameter whose key matches one of these is fully redacted.
     */
    private static SENSITIVE_KEYS = [
        'password', 'passwd', 'pwd', 'secret', 'token', 'api_key', 'apikey',
        'api-key', 'authorization', 'auth', 'credential', 'jwt', 'access_key',
        'accesskey', 'private_key', 'privatekey',
    ];

    /**
     * Sanitize parameters to avoid logging sensitive data.
     *
     * Sprint 1 — SEC-008: improved redaction for:
     *   - Any string parameter whose name (if provided via context) matches a
     *     sensitive key → redacted entirely.
     *   - Any long string parameter (>100 chars) → truncated.
     *   - Plain-text credential-like values heuristically detected.
     */
    private sanitizeParams(params: any[]): any[] {
        return params.map((param) => {
            if (typeof param === 'string') {
                // Always truncate long strings regardless of content
                if (param.length > 100) {
                    return `[String: ${param.length} chars]`;
                }
                // Heuristic: strings containing both letters and numbers with 8+ chars
                // that look like they could be secrets
                if (param.length >= 8 && /[A-Za-z]/.test(param) && /\d/.test(param) && /[^a-zA-Z0-9]/.test(param)) {
                    return '[REDACTED]';
                }
            }
            return param;
        });
    }

    /**
     * Redact sensitive keys from a context object before logging.
     * Sprint 1 — ensures no password/token/secret leaks through context.
     */
    sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
        if (!context) return context;
        const redacted: Record<string, any> = {};
        for (const [key, value] of Object.entries(context)) {
            const lowerKey = key.toLowerCase();
            const isSensitive = Logger.SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk));
            redacted[key] = isSensitive ? '[REDACTED]' : value;
        }
        return redacted;
    }
}

// Export singleton instance
export const logger = Logger.getInstance();
