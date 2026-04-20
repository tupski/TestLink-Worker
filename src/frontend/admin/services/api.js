/**
 * Admin API Service - Abstraksi API calls untuk admin panel
 */

class AdminAPIService {
    constructor() {
        this.baseURL = window.location.origin;
        this.headers = {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Set admin password header
     * @param {string} password - Admin password
     */
    setAuthPassword(password) {
        this.headers['X-Admin-Password'] = password;
    }

    /**
     * Get headers with auth
     * @returns {Object} Headers object
     */
    getHeaders() {
        return { ...this.headers };
    }

    /**
     * Authenticate admin
     * @param {string} password - Admin password
     * @returns {Promise<Object>} Response
     */
    async auth(password) {
        const response = await fetch(`${this.baseURL}/api/auth`, {
            method: 'POST',
            headers: { 'X-Admin-Password': password }
        });
        
        if (!response.ok) {
            throw new Error('Akses kredensial tertolak.');
        }
        
        return response.json();
    }

    /**
     * Get all settings
     * @returns {Promise<Object>} Settings object
     */
    async getSettings() {
        const response = await fetch(`${this.baseURL}/api/settings`);
        
        if (!response.ok) {
            throw new Error('Gagal memuat pengaturan.');
        }
        
        return response.json();
    }

    /**
     * Update settings
     * @param {Object} settings - Settings to update
     * @returns {Promise<Object>} Response
     */
    async updateSettings(settings) {
        const response = await fetch(`${this.baseURL}/api/settings`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(settings)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Gagal menyimpan pengaturan.');
        }
        
        return data;
    }

    /**
     * Get all sites
     * @returns {Promise<Object>} Sites response
     */
    async getSites() {
        const response = await fetch(`${this.baseURL}/api/sites`);
        
        if (!response.ok) {
            throw new Error('Gagal memuat data situs.');
        }
        
        return response.json();
    }

    /**
     * Create new site
     * @param {string} name - Site name
     * @param {string} links - Links (newline separated)
     * @returns {Promise<Object>} Response
     */
    async createSite(name, links) {
        const response = await fetch(`${this.baseURL}/api/sites`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ name, links })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Gagal membuat situs.');
        }
        
        return data;
    }

    /**
     * Update site
     * @param {string} siteId - Site ID
     * @param {string} name - New site name
     * @param {string} links - New links
     * @returns {Promise<Object>} Response
     */
    async updateSite(siteId, name, links) {
        const response = await fetch(`${this.baseURL}/api/sites/${siteId}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify({ name, links })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Gagal memperbarui situs.');
        }
        
        return data;
    }

    /**
     * Delete site
     * @param {string} siteId - Site ID
     * @returns {Promise<Object>} Response
     */
    async deleteSite(siteId) {
        const response = await fetch(`${this.baseURL}/api/sites/${siteId}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Gagal menghapus situs.');
        }
        
        return data;
    }

    /**
     * Toggle site active status
     * @param {string} siteId - Site ID
     * @param {boolean} isActive - New active status
     * @returns {Promise<Object>} Response
     */
    async toggleSiteActive(siteId, isActive) {
        const response = await fetch(`${this.baseURL}/api/sites/${siteId}/toggle`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify({ is_active: isActive })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Gagal mengubah status.');
        }
        
        return data;
    }

    /**
     * Update sites order
     * @param {Array} orders - Array of {id, order}
     * @returns {Promise<Object>} Response
     */
    async updateSitesOrder(orders) {
        const response = await fetch(`${this.baseURL}/api/sites/order`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify({ orders })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Gagal menyimpan urutan.');
        }
        
        return data;
    }

    /**
     * Get admin stats
     * @returns {Promise<Object>} Stats
     */
    async getStats() {
        const response = await fetch(`${this.baseURL}/api/admin/stats`, {
            headers: this.getHeaders()
        });
        
        if (response.status === 403) {
            throw new Error('403');
        }
        
        if (!response.ok) {
            throw new Error('Gagal memuat statistik.');
        }
        
        return response.json();
    }

    /**
     * Get history
     * @returns {Promise<Object>} History response
     */
    async getHistory() {
        const response = await fetch(`${this.baseURL}/api/history`);
        
        if (!response.ok) {
            throw new Error('Gagal memuat riwayat.');
        }
        
        return response.json();
    }

    /**
     * Clear all history
     * @returns {Promise<Object>} Response
     */
    async clearHistory() {
        const response = await fetch(`${this.baseURL}/api/history`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Gagal menghapus riwayat.');
        }
        
        return data;
    }
}

// Singleton instance
const adminAPIService = new AdminAPIService();

module.exports = {
    AdminAPIService,
    adminAPIService
};