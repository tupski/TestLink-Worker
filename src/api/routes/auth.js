/**
 * Auth Routes - Route untuk autentikasi admin
 */
const express = require('express');
const router = express.Router();
const { AuthMiddleware } = require('../middleware/auth');

/**
 * POST /api/auth
 * Verifikasi password admin
 */
router.post('/', AuthMiddleware.requireAdmin, (req, res) => {
    res.json({ success: true });
});

module.exports = router;