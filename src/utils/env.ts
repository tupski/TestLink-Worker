/**
 * Environment Variable Validation Module
 *
 * Centralized validation of all required environment variables using Zod.
 * Fails fast during startup if required variables are missing or invalid.
 *
 * Sprint 1 — SEC-003: Environment validation
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema definitions
// ---------------------------------------------------------------------------

const envSchema = z.object({
    // Application
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),
    PORT: z
        .string()
        .default('3000')
        .transform((v) => parseInt(v, 10))
        .pipe(z.number().int().min(1).max(65535)),
    LOG_LEVEL: z
        .enum(['debug', 'info', 'warn', 'error'])
        .optional(),

    // Database type
    DB_TYPE: z
        .enum(['sqlite', 'mysql'])
        .default('sqlite'),

    // MySQL (required when DB_TYPE=mysql)
    DB_HOST: z.string().optional(),
    DB_PORT: z
        .string()
        .transform((v) => parseInt(v, 10))
        .pipe(z.number().int().min(1).max(65535))
        .optional(),
    DB_USER: z.string().optional(),
    DB_PASSWORD: z.string().optional(),
    DB_NAME: z.string().optional(),
    DB_CONNECTION_LIMIT: z
        .string()
        .transform((v) => parseInt(v, 10))
        .pipe(z.number().int().min(1))
        .optional(),

    // SQLite (required when DB_TYPE=sqlite)
    SQLITE_PATH: z.string().optional(),

    // Admin authentication — REQUIRED in production
    ADMIN_PASSWORD: z.string().min(1, 'ADMIN_PASSWORD is required'),

    // CORS
    ALLOW_ORIGINS: z.string().optional(),

    // Google Safe Browsing (optional)
    GOOGLE_SAFE_BROWSING_API_KEY: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Parsed configuration type
// ---------------------------------------------------------------------------

export type EnvConfig = z.infer<typeof envSchema>;

// ---------------------------------------------------------------------------
// Validation + conditional checks
// ---------------------------------------------------------------------------

let _parsed: EnvConfig | null = null;

/**
 * Validate environment variables and return a typed config object.
 *
 * Call once at application startup.  Throws on invalid / missing variables
 * so the process fails fast instead of running with insecure defaults.
 */
export function validateEnv(): EnvConfig {
    if (_parsed) return _parsed; // memoize after first call

    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const issues = result.error.issues.map(
            (i) => `  • ${i.path.join('.')}: ${i.message}`
        );
        throw new Error(
            `Environment validation failed:\n${issues.join('\n')}`
        );
    }

    const env = result.data;

    // Conditional: when DB_TYPE=mysql the MySQL fields are required
    if (env.DB_TYPE === 'mysql') {
        const missing: string[] = [];
        if (!env.DB_HOST) missing.push('DB_HOST');
        if (!env.DB_USER) missing.push('DB_USER');
        if (!env.DB_PASSWORD) missing.push('DB_PASSWORD');
        if (!env.DB_NAME) missing.push('DB_NAME');
        if (missing.length > 0) {
            throw new Error(
                `MySQL configuration requires: ${missing.join(', ')}`
            );
        }
    }

    // Production guard: ADMIN_PASSWORD must not be a placeholder
    if (
        env.NODE_ENV === 'production' &&
        (env.ADMIN_PASSWORD === 'your_admin_password' ||
            env.ADMIN_PASSWORD === 'admin123' ||
            env.ADMIN_PASSWORD === 'rahasia123')
    ) {
        throw new Error(
            'ADMIN_PASSWORD is set to an insecure placeholder value. ' +
                'Set a strong, unique password in production.'
        );
    }

    _parsed = env;
    return env;
}

/**
 * Returns the already-validated config (must call validateEnv() first).
 */
export function getEnv(): EnvConfig {
    if (!_parsed) {
        throw new Error('validateEnv() must be called before getEnv()');
    }
    return _parsed;
}

/**
 * Reset cached config (useful for testing).
 */
export function resetEnv(): void {
    _parsed = null;
}
