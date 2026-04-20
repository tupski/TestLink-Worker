/**
 * Utilities untuk manajemen waktu dan tanggal
 */

/**
 * Mendapatkan waktu saat ini dalam zona WIB (UTC+7)
 * @returns {string} Format: "YYYY-MM-DD HH:mm:ss"
 */
function getNowWIB() {
    const now = new Date();
    const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
    const year = wibTime.getFullYear();
    const month = String(wibTime.getMonth() + 1).padStart(2, '0');
    const day = String(wibTime.getDate()).padStart(2, '0');
    const hours = String(wibTime.getHours()).padStart(2, '0');
    const minutes = String(wibTime.getMinutes()).padStart(2, '0');
    const seconds = String(wibTime.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format timestamp WIB dari string format "YYYY-MM-DD HH:mm:ss" ke tampilan lokal yang readable
 * @param {string} createdAtStr - String timestamp dalam format "YYYY-MM-DD HH:mm:ss"
 * @returns {string} Format: "20 Apr, 15:30"
 */
function formatWIBTimestamp(createdAtStr) {
    if (!createdAtStr) return '-';
    
    try {
        // Parse string WIB format "2024-04-20 15:30:45"
        const parts = createdAtStr.split(' ');
        if (parts.length !== 2) return createdAtStr;
        
        const dateParts = parts[0].split('-');
        const timeParts = parts[1].split(':');
        
        if (dateParts.length !== 3 || timeParts.length !== 3) return createdAtStr;
        
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        const hour = parseInt(timeParts[0], 10);
        const minute = parseInt(timeParts[1], 10);
        const second = parseInt(timeParts[2], 10);
        
        // Buat date object dari komponen WIB (anggap sebagai UTC untuk menghindari timezone shift)
        const date = new Date(Date.UTC(year, month, day, hour, minute, second));
        
        // Format: "20 Apr, 15:30"
        return date.toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return createdAtStr;
    }
}

module.exports = {
    getNowWIB,
    formatWIBTimestamp
};