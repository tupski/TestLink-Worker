/**
 * History Routes - Route untuk manajemen riwayat
 */
const express = require('express');
const router = express.Router();
const { AuthMiddleware } = require('../middleware/auth');
const { databaseService } = require('../services/database');

/**
 * GET /api/history
 * Mendapatkan riwayat aktivitas
 */
router.get('/', async (req, res) => {
    try {
        const history = await databaseService.query(
            `SELECT * FROM history ORDER BY created_at DESC LIMIT 50`
        );
        res.json({ history });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/history/meta
 * Mendapatkan metadata riwayat (ID terbaru)
 */
router.get('/meta', async (req, res) => {
    try {
        const row = await databaseService.query(
            `SELECT id, created_at FROM history ORDER BY id DESC LIMIT 1`
        );
        res.json({ 
            newestId: row && row.length > 0 ? row[0].id : 0, 
            newestAt: row && row.length > 0 ? row[0].created_at : null 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/history
 * Hapus semua riwayat (hanya admin)
 */
router.delete('/', AuthMiddleware.requireAdmin, async (req, res) => {
    try {
        const result = await databaseService.execute(`DELETE FROM history`);
        res.json({ success: true, deleted: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;