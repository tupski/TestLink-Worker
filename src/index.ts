/**
 * TestLink Worker - Main Entry Point
 * 
 * This is the TypeScript entry point for the application.
 * Supports both SQLite (local development) and MySQL (production) databases.
 * 
 * **Validates: Requirements 1.1, 9.1**
 * 
 * Sprint 1 — Environment validation runs first. If any required environment
 * variable is missing or invalid, the process fails immediately with a clear
 * error message instead of running with insecure defaults.
 */

import { validateEnv } from './utils/env';
import TestLinkServer from './server';

// Validate environment variables BEFORE anything else
// This ensures we fail fast on missing/invalid configuration
validateEnv();

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = new TestLinkServer();
server.start(PORT).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

export default server;
