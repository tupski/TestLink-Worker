/**
 * Google Safe Browsing Service - Integrasi dengan Google Safe Browsing API
 */
const { databaseService } = require('./database');

class GSBService {
    /**
     * Mendapatkan setting value dari database
     * @param {string} key - Key setting
     * @returns {Promise<string|null>} Value setting
     */
    static async getSetting(key) {
        return new Promise((resolve) => {
            databaseService.getDb().get(
                `SELECT value FROM kv_settings WHERE key = ?`, 
                [key], 
                (err, row) => {
                    resolve(row ? row.value : null);
                }
            );
        });
    }

    /**
     * Cek apakah URL terdeteksi sebagai ancaman oleh Google Safe Browsing
     * @param {string} url - URL untuk dicek
     * @returns {Promise<boolean>} True jika URL terdeteksi sebagai ancaman
     */
    static async checkThreat(url) {
        try {
            const apiKey = await this.getSetting('gsb_api_key');
            const active = await this.getSetting('gsb_active');
            
            if (active !== '1' || !apiKey) return false;

            const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client: { clientId: "testlink", clientVersion: "1.0.0" },
                    threatInfo: {
                        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                        platformTypes: ["ANY_PLATFORM"],
                        threatEntryTypes: ["URL"],
                        threatEntries: [{ url }]
                    }
                })
            });
            
            if (!res.ok) return false;
            const data = await res.json();
            return data && data.matches && data.matches.length > 0;
        } catch (e) {
            return false;
        }
    }
}

module.exports = {
    GSBService
};