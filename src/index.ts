/**
 * TestLink Worker - Main Entry Point
 * 
 * This is the TypeScript entry point for the application.
 * Supports both SQLite (local development) and MySQL (production) databases.
 * 
 * **Validates: Requirements 1.1, 9.1**
 */

import TestLinkServer from './server';

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = new TestLinkServer();
server.start(PORT).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

export default server;
