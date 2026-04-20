/**
 * Check Block Routes - Route untuk pengecekan blokir URL
 */
const express = require('express');
const router = express.Router();
const { BlockDetector } = require('../services/block-detector');
const { GSBService } = require('../services/gsb-service');

/**
 * POST /api/check-block
 * Cek apakah URL diblokir
 */
router.post('/', async (req, res) => {
    try {
        let target = (req.body && req.body.url) || '';
        
        // Normalisasi URL
        target = BlockDetector.normalizeUrl(target);
        
        if (!target) {
            return res.status(400).json({ error: 'URL kosong.' });
        }

        // Cek dengan BlockDetector (URL & HTML analysis)
        const out = await BlockDetector.resolveUrlWithRedirects(target, 12000);
        
        // Cek dengan Google Safe Browsing
        let gsbBlocked = false;
        if (out.ok || !out.ok) {
            gsbBlocked = await GSBService.checkThreat(target);
        }

        // Format response
        if (!out.ok) {
            if (gsbBlocked) {
                return res.json({ blocked: true, finalUrl: target, status: 0, fromGSB: true });
            }
            return res.json({ blocked: false, unreachable: true, finalUrl: out.finalUrl, note: out.error });
        }

        res.json({
            blocked: !!out.blocked || gsbBlocked,
            finalUrl: out.finalUrl,
            status: out.status,
            fromUrl: !!out.urlHit,
            fromBody: !!out.bodyHit,
            fromGSB: gsbBlocked
        });
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

module.exports = router;