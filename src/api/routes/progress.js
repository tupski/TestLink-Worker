/**
 * Progress Routes - Route untuk update progress
 */
const express = require('express');
const router = express.Router();
const { SiteService } = require('../services/site-service');

/**
 * POST /api/progress
 * Update progress pengetesan
 */
router.post('/', async (req, res) => {
    try {
        const { deviceId, siteId, lastIndex, normalCount, errorCount } = req.body;
        
        await SiteService.updateProgress(deviceId, siteId, lastIndex, normalCount, errorCount);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;