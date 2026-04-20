/**
 * Sites Routes - Route untuk manajemen situs
 */
const express = require('express');
const router = express.Router();
const { AuthMiddleware } = require('../middleware/auth');
const { SiteService } = require('../services/site-service');

/**
 * GET /api/sites
 * Mendapatkan semua situs (dengan progress jika deviceId disediakan)
 */
router.get('/', async (req, res) => {
    try {
        const deviceId = req.query.deviceId;
        const sites = await SiteService.getAllSites(deviceId);
        res.json({ sites });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/sites
 * Membuat situs baru (hanya admin)
 */
router.post('/', AuthMiddleware.requireAdmin, async (req, res) => {
    try {
        const { name, links, operation_mode, manual_validation, custom_interval } = req.body;
        const settings = { operation_mode, manual_validation, custom_interval };
        const result = await SiteService.createSite(name, links, settings);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/sites/:id
 * Update situs (hanya admin)
 */
router.put('/:id', AuthMiddleware.requireAdmin, async (req, res) => {
    try {
        const { name, links, operation_mode, manual_validation, custom_interval } = req.body;
        const settings = { operation_mode, manual_validation, custom_interval };
        await SiteService.updateSite(req.params.id, name, links, settings);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/sites/:id/toggle
 * Toggle status aktif situs (hanya admin)
 */
router.put('/:id/toggle', AuthMiddleware.requireAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        await SiteService.toggleActive(req.params.id, is_active);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/sites/order
 * Update urutan situs (hanya admin)
 */
router.put('/order', AuthMiddleware.requireAdmin, async (req, res) => {
    try {
        const { orders } = req.body;
        if (!Array.isArray(orders)) {
            return res.status(400).json({ error: 'Invalid data' });
        }
        await SiteService.updateOrder(orders);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/sites/:id
 * Hapus situs (hanya admin)
 */
router.delete('/:id', AuthMiddleware.requireAdmin, async (req, res) => {
    try {
        await SiteService.deleteSite(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;