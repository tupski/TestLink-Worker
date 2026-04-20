/**
 * Authentication Middleware - Middleware untuk autentikasi admin
 */

class AuthMiddleware {
    /**
     * Middleware untuk memverifikasi password admin
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     * @param {Function} next - Next middleware
     */
    static requireAdmin(req, res, next) {
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rahasia123';
        const reqPass = req.headers['x-admin-password'] || '';
        
        if (reqPass !== ADMIN_PASSWORD) {
            return res.status(403).json({ error: 'Password Admin Salah atau Akses Ditolak.' });
        }
        
        next();
    }

    /**
     * Middleware untuk mengecek apakah user adalah admin
     * @param {Object} req - Request object
     * @returns {boolean} True jika user adalah admin
     */
    static isAdmin(req) {
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rahasia123';
        const reqPass = req.headers['x-admin-password'] || '';
        return reqPass === ADMIN_PASSWORD;
    }
}

module.exports = {
    AuthMiddleware
};