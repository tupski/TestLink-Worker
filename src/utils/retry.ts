/**
 * Retry Utility Module
 * 
 * Provides retry logic for failed operations, particularly database connections.
 * Implements exponential backoff strategy for resilient connection handling.
 * 
 * **Validates: Requirements 11.1, 11.3, 11.5**
 */

import { logger } from './logger';

export interface RetryOptions {
    /** Maximum number of retry attempts */
    maxRetries: number;
    /** Initial delay in milliseconds before first retry */
    initialDelayMs: number;
    /** Maximum delay in milliseconds between retries */
    maxDelayMs: number;
    /** Multiplier for exponential backoff */
    backoffMultiplier: number;
    /** Optional callback for each retry attempt */
    onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
    const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
    return Math.min(exponentialDelay + jitter, options.maxDelayMs);
}


/**
 * Execute an async operation with retry logic
 * 
 * Uses exponential backoff with jitter to avoid thundering herd problem.
 * 
 * @param operation Async function to execute
 * @param options Retry configuration options
 * @returns Promise resolving to operation result
 * @throws Last error if all retries fail
 * 
 * **Validates: Requirements 11.1, 11.3**
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
): Promise<T> {
    const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt > opts.maxRetries) {
                logger.error('[Retry] All retry attempts exhausted', {
                    attempts: attempt - 1,
                    error: lastError.message
                });
                throw lastError;
            }

            const delayMs = calculateDelay(attempt, opts);

            logger.logConnection('retry', {
                attempt,
                maxRetries: opts.maxRetries,
                nextDelayMs: Math.round(delayMs),
                error: lastError.message
            });

            if (opts.onRetry) {
                opts.onRetry(attempt, lastError, delayMs);
            }

            await sleep(delayMs);
        }
    }

    throw lastError;
}

/**
 * Check if an error is retryable
 * 
 * Determines if a database error should trigger a retry attempt.
 * 
 * @param error Error to check
 * @returns true if the error is retryable
 */
export function isRetryableError(error: Error): boolean {
    const retryablePatterns = [
        /ECONNREFUSED/i,
        /ECONNRESET/i,
        /ETIMEDOUT/i,
        /ENOTFOUND/i,
        /connection.*lost/i,
        /connection.*closed/i,
        /too many connections/i,
        /deadlock/i,
        /lock wait timeout/i,
        /server has gone away/i,
        /lost connection/i
    ];

    const message = error.message || '';
    return retryablePatterns.some(pattern => pattern.test(message));
}


/**
 * User-friendly error messages for common database errors
 * 
 * **Validates: Requirements 11.5**
 */
export const USER_FRIENDLY_ERRORS: Record<string, string> = {
    ECONNREFUSED: 'Tidak dapat terhubung ke database. Pastikan server database berjalan.',
    ECONNRESET: 'Koneksi ke database terputus. Silakan coba lagi.',
    ETIMEDOUT: 'Koneksi ke database timeout. Periksa koneksi jaringan Anda.',
    ENOTFOUND: 'Server database tidak ditemukan. Periksa konfigurasi host.',
    ER_ACCESS_DENIED_ERROR: 'Akses ditolak. Periksa username dan password database.',
    ER_BAD_DB_ERROR: 'Database tidak ditemukan. Pastikan database sudah dibuat.',
    ER_TOO_MANY_CONNECTIONS: 'Terlalu banyak koneksi ke database. Coba lagi nanti.',
    ER_LOCK_WAIT_TIMEOUT: 'Database sedang sibuk. Silakan coba lagi.',
    SQLITE_CANTOPEN: 'Tidak dapat membuka file database SQLite.',
    SQLITE_BUSY: 'Database SQLite sedang digunakan. Coba lagi nanti.',
    DEFAULT: 'Terjadi kesalahan pada database. Silakan coba lagi.'
};

/**
 * Get user-friendly error message from database error
 * 
 * @param error Database error
 * @returns User-friendly error message in Indonesian
 * 
 * **Validates: Requirements 11.5**
 */
export function getUserFriendlyError(error: Error): string {
    const message = error.message || '';
    const code = (error as any).code || '';

    // Check for specific error codes
    if (USER_FRIENDLY_ERRORS[code]) {
        return USER_FRIENDLY_ERRORS[code];
    }

    // Check for error patterns in message
    for (const [key, friendlyMessage] of Object.entries(USER_FRIENDLY_ERRORS)) {
        if (message.includes(key) || code.includes(key)) {
            return friendlyMessage;
        }
    }

    // Check for common patterns
    if (/connection.*refused/i.test(message)) {
        return USER_FRIENDLY_ERRORS.ECONNREFUSED!;
    }
    if (/access.*denied/i.test(message)) {
        return USER_FRIENDLY_ERRORS.ER_ACCESS_DENIED_ERROR!;
    }
    if (/timeout/i.test(message)) {
        return USER_FRIENDLY_ERRORS.ETIMEDOUT!;
    }

    return USER_FRIENDLY_ERRORS.DEFAULT!;
}

/**
 * Database error class with user-friendly message
 */
export class DatabaseError extends Error {
    public readonly userMessage: string;
    public readonly originalError: Error;
    public readonly isRetryable: boolean;

    constructor(originalError: Error) {
        super(originalError.message);
        this.name = 'DatabaseError';
        this.originalError = originalError;
        this.userMessage = getUserFriendlyError(originalError);
        this.isRetryable = isRetryableError(originalError);
    }
}
