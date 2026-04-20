/**
 * TestLink API - Entry Point Utama
 * 
 * Struktur modular untuk maintainability dan testability yang lebih baik.
 * 
 * Struktur folder:
 * - config/     : Konfigurasi dan konstanta
 * - services/   : Business logic
 * - middleware/ : Middleware (auth, validation)
 * - routes/     : API routes
 * - utils/      : Utility functions
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import services
const { databaseService } = require('../src/api/services/database');
const { resolveProjectRoot } = require('../src/api/utils/project-root');

// Import routes
const authRoutes = require('../src/api/routes/auth');
const settingsRoutes = require('../src/api/routes/settings');
const sitesRoutes = require('../src/api/routes/sites');
const historyRoutes = require('../src/api/routes/history');
const checkBlockRoutes = require('../src/api/routes/check-block');
const progressRoutes = require('../src/api/routes/progress');
const statsRoutes = require('../src/api/routes/stats');

// Initialize Express app
const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Resolve project root
const ROOT = resolveProjectRoot();
console.log(`📂 Project ROOT set to: ${ROOT}`);

// Initialize database
async function initializeApp() {
    try {
        await databaseService.init();
        console.log('✅ Database initialized');
    } catch (err) {
        console.error('❌ Database initialization failed:', err);
        process.exit(1);
    }
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/check-block', checkBlockRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/admin/stats', statsRoutes);

// Static files & redirects
app.get(['/admin', '/admin/'], (req, res) => res.redirect(302, '/admin.html'));
app.get(['/about', '/about/'], (req, res) => res.redirect(302, '/about.html'));

app.get('/favicon.ico', (req, res) => {
    const icon = path.join(ROOT, 'icons', 'icon.svg');
    if (fs.existsSync(icon)) {
        res.type('image/svg+xml');
        return res.sendFile(icon);
    }
    res.status(204).end();
});

app.get('/CHANGELOG.md', (req, res) => {
    const changelogPath = path.join(ROOT, 'CHANGELOG.md');
    if (fs.existsSync(changelogPath)) {
        res.type('text/markdown; charset=utf-8');
        return res.sendFile(changelogPath);
    }
    res.status(404).json({ error: 'CHANGELOG.md tidak ditemukan' });
});

app.get('/', (req, res, next) => {
    const indexPath = path.join(ROOT, 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath, (err) => (err ? next(err) : undefined));
    }
    next();
});

app.use(express.static(ROOT));

// 404 handler
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint-nya nyasar, nih. Cek lagi URL-nya.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(404).send('Not found');
    }
    res.status(404).sendFile(path.join(ROOT, '404.html'), (err) => {
        if (err) res.status(404).send('Not found');
    });
});

// Start server
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    initializeApp().then(() => {
        app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    });
} else {
    // For Vercel, initialize app but don't start server
    initializeApp();
}

module.exports = app;