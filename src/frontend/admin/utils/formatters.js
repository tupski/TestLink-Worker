/**
 * Admin Formatters - Utility functions for formatting data
 */

/**
 * Escape HTML to prevent XSS
 * @param {string} s - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

/**
 * Format WIB timestamp from string format "YYYY-MM-DD HH:mm:ss" to readable format
 * @param {string} createdAtStr - String timestamp
 * @returns {string} Formatted timestamp
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
        
        // Create date object from WIB components
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

/**
 * Format site name (remove "Kategori" prefix)
 * @param {string} name - Site name
 * @returns {string} Formatted name
 */
function formatSiteName(name) {
    return name.replace(/^Kategori\s+/i, '').trim();
}

/**
 * Format link count
 * @param {number} count - Link count
 * @returns {string} Formatted count
 */
function formatLinkCount(count) {
    return `${count} link${count !== 1 ? 's' : ''}`;
}

/**
 * Format action type to badge class
 * @param {string} action - Action type
 * @returns {string} Badge class
 */
function getActionBadgeClass(action) {
    switch (action) {
        case 'ADD':
            return 'bg-emerald-500/20 text-emerald-500';
        case 'EDIT':
            return 'bg-indigo-500/20 text-indigo-400';
        case 'DELETE':
            return 'bg-red-500/20 text-red-500';
        default:
            return 'bg-slate-500/20 text-slate-500';
    }
}

/**
 * Format action type to uppercase
 * @param {string} action - Action type
 * @returns {string} Formatted action
 */
function formatAction(action) {
    return action.toUpperCase();
}

module.exports = {
    escapeHtml,
    formatWIBTimestamp,
    formatSiteName,
    formatLinkCount,
    getActionBadgeClass,
    formatAction
};