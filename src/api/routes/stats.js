/**
 * Stats Routes - Route untuk statistik
 */
const express = require('express');
const router = express.Router();
const { AuthMiddleware } = require('../middleware/auth');
const { SiteService } = require('../services/site-service');

/**
 * GET /api/admin/stats
 * Mendapatkan statistik (hanya admin)
 */
router.get('/', AuthMiddleware.requireAdmin, async (req, res) => {
    try {
        const stats = await SiteService.getStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;