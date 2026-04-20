/**
 * Settings Routes - Route untuk manajemen pengaturan
 */
const express = require('express');
const router = express.Router();
const { AuthMiddleware } = require('../middleware/auth');
const { SettingsService } = require('../services/settings-service');

/**
 * GET /api/settings
 * Mendapatkan semua settings
 */
router.get('/', async (req, res) => {
    try {
        const isAdmin = AuthMiddleware.isAdmin(req);
        const settings = await SettingsService.getAllSettings(isAdmin);
        res.json({ settings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/settings
 * Update settings (hanya admin)
 */
router.put('/', AuthMiddleware.requireAdmin, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        await SettingsService.updateSettings(body);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;