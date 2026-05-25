/**
 * Panel admin — dashboard, kategori, pengaturan situs, riwayat server
 */
let sitesData = [];
let categories = {};
let editingSiteId = null;
let sessionPass = sessionStorage.getItem('__admin_pass') || null;
const API_BASE = window.location.origin;

// Validation state
const validationState = {
    siteName: { valid: false, message: '' },
    siteLinks: { valid: false, message: '' }
};

// Pagination state for history table
const historyPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0
};

/**
 * Format timestamp WIB dari string format "YYYY-MM-DD HH:mm:ss" ke tampilan lokal yang readable
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

/**
 * Format timestamp as relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(createdAtStr) {
    if (!createdAtStr) return '-';
    
    try {
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
        
        const date = new Date(Date.UTC(year, month, day, hour, minute, second));
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        
        if (diffSec < 60) return 'Baru saja';
        if (diffMin < 60) return `${diffMin} menit lalu`;
        if (diffHour < 24) return `${diffHour} jam lalu`;
        if (diffDay < 7) return `${diffDay} hari lalu`;
        if (diffDay < 30) return `${Math.floor(diffDay / 7)} minggu lalu`;
        if (diffDay < 365) return `${Math.floor(diffDay / 30)} bulan lalu`;
        return `${Math.floor(diffDay / 365)} tahun lalu`;
    } catch (e) {
        return createdAtStr;
    }
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-Admin-Password': sessionPass
    };
}

function showTab(tabId) {
    document.querySelectorAll('[data-tab-btn]').forEach((btn) => {
        const on = btn.getAttribute('data-tab-btn') === tabId;
        btn.classList.toggle('bg-indigo-600', on);
        btn.classList.toggle('text-white', on);
        btn.classList.toggle('shadow-lg', on);
        btn.classList.toggle('shadow-indigo-900/30', on);
        btn.classList.toggle('bg-slate-900', !on);
        btn.classList.toggle('text-slate-500', !on);
        btn.classList.toggle('border-slate-800', !on);
    });
    document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
        panel.classList.toggle('hidden', panel.getAttribute('data-tab-panel') !== tabId);
    });
    if (tabId === 'dash') loadStats();
    if (tabId === 'settings') loadSettingsForm();
    if (tabId === 'history') loadServerHistoryTable();
    if (tabId === 'about') loadAboutForm();
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-tab-btn]').forEach((btn) => {
        btn.addEventListener('click', () => showTab(btn.getAttribute('data-tab-btn')));
    });

    if (!sessionPass) {
        document.getElementById('pwdModal').classList.remove('hidden');
        setTimeout(() => document.getElementById('pwdInput').focus(), 50);
        document.getElementById('pwdInput').addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') resolvePwd();
        });
    } else {
        loadSites();
        showTab('dash');
    }
    
    // Setup form validation listeners
    setupFormValidation();
});

async function resolvePwd() {
    const val = document.getElementById('pwdInput').value;
    if (!val) return;
    try {
        const res = await fetch(`${API_BASE}/api/auth`, {
            method: 'POST',
            headers: { 'X-Admin-Password': val }
        });
        if (!res.ok) throw new Error('Akses kredensial tertolak.');
        sessionPass = val;
        sessionStorage.setItem('__admin_pass', sessionPass);
        document.getElementById('pwdModal').classList.add('hidden');
        loadSites();
        showTab('dash');
    } catch (e) {
        toastAdmin('Gagal login: ' + e.message);
        document.getElementById('pwdInput').value = '';
        document.getElementById('pwdInput').focus();
    }
}

function rejectPwd() {
    window.location.href = '/';
}

function toastAdmin(msg, type = 'info') {
    const t = document.getElementById('adminToast');
    if (!t) return alert(msg);
    t.textContent = msg;
    
    // Apply styling based on type
    t.classList.remove('border-indigo-500/40', 'border-emerald-500/40', 'border-red-500/40');
    if (type === 'success') {
        t.classList.add('border-emerald-500/40');
    } else if (type === 'error') {
        t.classList.add('border-red-500/40');
    } else {
        t.classList.add('border-indigo-500/40');
    }
    
    t.classList.remove('hidden', 'opacity-0', 'translate-y-2');
    clearTimeout(toastAdmin._tm);
    toastAdmin._tm = setTimeout(() => {
        t.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => t.classList.add('hidden'), 300);
    }, 3200);
}

/**
 * Show confirmation modal
 */
function showConfirmDialog(message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    
    if (!modal) {
        // Fallback to native confirm
        if (confirm(message)) onConfirm();
        return;
    }
    
    messageEl.textContent = message;
    modal.classList.remove('hidden');
    
    const handleConfirm = () => {
        modal.classList.add('hidden');
        onConfirm();
        cleanup();
    };
    
    const handleCancel = () => {
        modal.classList.add('hidden');
        cleanup();
    };
    
    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
}

/**
 * Show loading skeleton for stats
 */
function showStatsLoading() {
    const elK = document.getElementById('statSites');
    const elL = document.getElementById('statLinks');
    const elH = document.getElementById('statHistory');
    if (elK) elK.innerHTML = '<div class="animate-pulse bg-slate-700 h-6 w-8 mx-auto rounded"></div>';
    if (elL) elL.innerHTML = '<div class="animate-pulse bg-slate-700 h-6 w-8 mx-auto rounded"></div>';
    if (elH) elH.innerHTML = '<div class="animate-pulse bg-slate-700 h-6 w-8 mx-auto rounded"></div>';
}

/**
 * Validate site name input
 */
function validateSiteName(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return { valid: false, message: 'Nama kategori wajib diisi' };
    }
    if (trimmed.length < 3) {
        return { valid: false, message: 'Minimal 3 karakter' };
    }
    if (trimmed.length > 100) {
        return { valid: false, message: 'Maksimal 100 karakter' };
    }
    return { valid: true, message: 'Valid ✓' };
}

/**
 * Validate and count links
 */
function validateLinks(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return { valid: false, message: 'Minimal satu link diperlukan', count: 0 };
    }
    
    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    const validLinks = lines.filter(line => {
        // Basic URL validation
        return line.length > 0;
    });
    
    if (validLinks.length === 0) {
        return { valid: false, message: 'Tidak ada link valid ditemukan', count: 0 };
    }
    
    return { 
        valid: true, 
        message: `${validLinks.length} link terdeteksi ✓`,
        count: validLinks.length 
    };
}

/**
 * Show validation message
 */
function showValidationMessage(inputId, validation) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    let msgEl = input.parentElement.querySelector('.validation-message');
    if (!msgEl) {
        msgEl = document.createElement('p');
        msgEl.className = 'validation-message text-[10px] font-bold mt-1.5 transition-all';
        input.parentElement.appendChild(msgEl);
    }
    
    msgEl.textContent = validation.message;
    
    if (validation.valid) {
        msgEl.classList.remove('text-red-400');
        msgEl.classList.add('text-emerald-400');
        input.classList.remove('border-red-500');
        input.classList.add('border-emerald-500');
    } else {
        msgEl.classList.remove('text-emerald-400');
        msgEl.classList.add('text-red-400');
        input.classList.remove('border-emerald-500');
        input.classList.add('border-red-500');
    }
}

/**
 * Clear validation message
 */
function clearValidationMessage(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const msgEl = input.parentElement.querySelector('.validation-message');
    if (msgEl) {
        msgEl.remove();
    }
    input.classList.remove('border-red-500', 'border-emerald-500');
}

/**
 * Setup form validation listeners
 */
function setupFormValidation() {
    const nameInput = document.getElementById('siteNameInput');
    const linksInput = document.getElementById('siteLinksInput');
    
    if (nameInput) {
        // Auto-focus on first input when form is visible
        nameInput.addEventListener('focus', () => {
            clearValidationMessage('siteNameInput');
        });
        
        // Validate on blur
        nameInput.addEventListener('blur', () => {
            const value = nameInput.value;
            if (value.trim()) {
                const validation = validateSiteName(value);
                showValidationMessage('siteNameInput', validation);
                validationState.siteName = validation;
            }
        });
        
        // Character counter
        nameInput.addEventListener('input', () => {
            updateCharCounter('siteNameInput', nameInput.value.length, 100);
        });
    }
    
    if (linksInput) {
        // Real-time link counter
        linksInput.addEventListener('input', () => {
            updateLinkCounter(linksInput.value);
        });
        
        // Validate on blur
        linksInput.addEventListener('blur', () => {
            const value = linksInput.value;
            if (value.trim()) {
                const validation = validateLinks(value);
                showValidationMessage('siteLinksInput', validation);
                validationState.siteLinks = validation;
            }
        });
        
        // Clear validation on focus
        linksInput.addEventListener('focus', () => {
            clearValidationMessage('siteLinksInput');
        });
    }
    
    // Setup character counters for settings inputs
    setupCharCounterForInput('setAppTitle', 120);
    setupCharCounterForInput('setAppTagline', 200);
    setupCharCounterForInput('setAboutTitle', 200);
    setupCharCounterForInput('setMaintenanceMsg', 500);
}

/**
 * Setup character counter for an input
 */
function setupCharCounterForInput(inputId, maxLength) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    input.addEventListener('input', () => {
        updateCharCounter(inputId, input.value.length, maxLength);
    });
}

/**
 * Update character counter display
 */
function updateCharCounter(inputId, currentLength, maxLength) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    let counterEl = input.parentElement.querySelector('.char-counter');
    if (!counterEl) {
        counterEl = document.createElement('div');
        counterEl.className = 'char-counter';
        input.parentElement.appendChild(counterEl);
    }
    
    const remaining = maxLength - currentLength;
    const percentage = (currentLength / maxLength) * 100;
    
    if (percentage >= 90) {
        counterEl.style.color = 'rgb(239 68 68)'; // red
    } else if (percentage >= 75) {
        counterEl.style.color = 'rgb(251 191 36)'; // yellow
    } else {
        counterEl.style.color = 'rgb(100 116 139)'; // slate
    }
    
    counterEl.textContent = `${currentLength}/${maxLength} karakter`;
}

/**
 * Update real-time link counter
 */
function updateLinkCounter(value) {
    const linksInput = document.getElementById('siteLinksInput');
    if (!linksInput) return;
    
    let counterEl = linksInput.parentElement.querySelector('.link-counter');
    if (!counterEl) {
        counterEl = document.createElement('div');
        counterEl.className = 'link-counter text-[10px] font-bold mt-1.5 text-indigo-400 flex items-center gap-1.5';
        linksInput.parentElement.appendChild(counterEl);
    }
    
    const trimmed = value.trim();
    if (!trimmed) {
        counterEl.innerHTML = '<span class="opacity-50">🔗 0 link</span>';
        return;
    }
    
    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    const count = lines.length;
    
    counterEl.innerHTML = `<span>🔗 ${count} link terdeteksi</span>`;
}

async function loadStats() {
    showStatsLoading();
    try {
        const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: getHeaders() });
        if (res.status === 403) throw new Error('403');
        const d = await res.json();
        
        const elK = document.getElementById('statSites');
        const elL = document.getElementById('statLinks');
        const elH = document.getElementById('statHistory');
        
        if (elK) {
            animateStatChange(elK, d.siteCount ?? '0');
        }
        if (elL) {
            animateStatChange(elL, d.linkCount ?? '0');
        }
        if (elH) {
            animateStatChange(elH, d.historyCount ?? '0');
        }
        
        // Update timestamp
        const timestampEl = document.getElementById('statsTimestamp');
        if (timestampEl) {
            const now = new Date();
            timestampEl.textContent = now.toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        
        // Load recent activity
        loadRecentActivity();
    } catch (e) {
        if (String(e.message) === '403') {
            sessionStorage.removeItem('__admin_pass');
            window.location.reload();
        }
        const elK = document.getElementById('statSites');
        const elL = document.getElementById('statLinks');
        const elH = document.getElementById('statHistory');
        if (elK) elK.textContent = '-';
        if (elL) elL.textContent = '-';
        if (elH) elH.textContent = '-';
        toastAdmin('Gagal memuat statistik', 'error');
    }
}

/**
 * Animate stat value change with smooth transition
 */
function animateStatChange(element, newValue) {
    const oldValue = element.textContent;
    if (oldValue === newValue) {
        element.textContent = newValue;
        return;
    }
    
    // Add transition class
    element.style.transition = 'all 0.3s ease-in-out';
    element.style.transform = 'scale(1.1)';
    element.style.color = 'rgb(99, 102, 241)'; // indigo
    
    setTimeout(() => {
        element.textContent = newValue;
        setTimeout(() => {
            element.style.transform = 'scale(1)';
            element.style.color = '';
        }, 150);
    }, 150);
}

/**
 * Load recent activity for dashboard
 */
async function loadRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-slate-600 text-xs">Memuat...</div>';
    
    try {
        const res = await fetch(`${API_BASE}/api/history`);
        const data = await res.json();
        const rows = data.history || [];
        
        if (rows.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-3xl mb-2 opacity-20">📋</div>
                    <p class="text-xs text-slate-600">Belum ada aktivitas</p>
                </div>`;
            return;
        }
        
        // Show only 5 most recent
        const recentRows = rows.slice(0, 5);
        container.innerHTML = '';
        
        recentRows.forEach((item) => {
            const relativeTime = formatRelativeTime(item.created_at);
            
            let badgeClass = 'badge ';
            if (item.action === 'ADD') badgeClass += 'badge-add';
            else if (item.action === 'EDIT') badgeClass += 'badge-edit';
            else if (item.action === 'DELETE') badgeClass += 'badge-delete';
            else badgeClass += 'badge-add';
            
            const activityItem = document.createElement('div');
            activityItem.className = 'flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors';
            activityItem.innerHTML = `
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <span class="${badgeClass}">${item.action}</span>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-white truncate">${escapeHtml(item.site_name)}</p>
                        <p class="text-[10px] text-slate-500">${escapeHtml(item.diff_summary || 'No details')}</p>
                    </div>
                </div>
                <span class="text-[9px] text-slate-600 whitespace-nowrap ml-2">${relativeTime}</span>
            `;
            container.appendChild(activityItem);
        });
        
        // Add "View All" link
        const viewAllLink = document.createElement('button');
        viewAllLink.className = 'w-full text-center text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 py-3 transition-colors';
        viewAllLink.textContent = 'Lihat semua →';
        viewAllLink.onclick = () => showTab('history');
        container.appendChild(viewAllLink);
        
    } catch (e) {
        container.innerHTML = `
            <div class="text-center py-4">
                <p class="text-xs text-red-400">Gagal memuat aktivitas</p>
            </div>`;
    }
}

async function loadSettingsForm() {
    try {
        const res = await fetch(`${API_BASE}/api/settings`);
        const { settings } = await res.json();
        document.getElementById('setAppTitle').value = settings.app_title || '';
        document.getElementById('setAppTagline').value = settings.app_tagline || '';
        document.getElementById('setDefaultInterval').value = settings.default_interval || '3';
        document.getElementById('setMaintenanceMsg').value = settings.maintenance_message || '';
        document.getElementById('setMaintenanceMode').checked =
            settings.maintenance_mode === '1' || settings.maintenance_mode === 'true';
        document.getElementById('setGsbActive').checked =
            settings.gsb_active === '1' || settings.gsb_active === 'true';
        document.getElementById('setGsbApiKey').value = settings.gsb_api_key || '';
    } catch (e) {
        toastAdmin('Gagal muat pengaturan.');
    }
}

async function loadAboutForm() {
    try {
        const res = await fetch(`${API_BASE}/api/settings`);
        const { settings } = await res.json();
        const t = document.getElementById('setAboutTitle');
        const b = document.getElementById('setAboutBody');
        if (t) t.value = settings.about_page_title || '';
        if (b) b.value = settings.about_page_body || '';
    } catch (e) {
        toastAdmin('Gagal muat halaman Tentang.');
    }
}

async function saveAboutPage() {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block animate-spin mr-2">⏳</span> Menyimpan...';
    
    const body = {
        about_page_title: document.getElementById('setAboutTitle').value.trim(),
        about_page_body: document.getElementById('setAboutBody').value
    };
    try {
        const res = await fetch(`${API_BASE}/api/settings`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        toastAdmin('✓ Halaman Tentang tersimpan. Cek /about.html', 'success');
    } catch (e) {
        toastAdmin('Gagal: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function saveSettings() {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block animate-spin mr-2">⏳</span> Menyimpan...';
    
    const body = {
        app_title: document.getElementById('setAppTitle').value.trim(),
        app_tagline: document.getElementById('setAppTagline').value.trim(),
        default_interval: document.getElementById('setDefaultInterval').value,
        maintenance_mode: document.getElementById('setMaintenanceMode').checked ? '1' : '0',
        maintenance_message: document.getElementById('setMaintenanceMsg').value.trim(),
        gsb_active: document.getElementById('setGsbActive').checked ? '1' : '0',
        gsb_api_key: document.getElementById('setGsbApiKey').value.trim()
    };
    try {
        const res = await fetch(`${API_BASE}/api/settings`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        toastAdmin('✓ Pengaturan tersimpan. Refresh halaman worker buat lihat judul baru.', 'success');
    } catch (e) {
        toastAdmin('Gagal simpan: ' + e.message, 'error');
        if (String(e.message).includes('Password') || String(e.message).includes('403')) {
            sessionStorage.removeItem('__admin_pass');
            window.location.reload();
        }
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function loadServerHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    
    // Show loading state
    tbody.innerHTML = `
        <tr>
            <td colspan="4" class="px-4 py-8 text-center">
                <div class="table-loading">
                    <div class="table-loading-spinner mx-auto mb-3"></div>
                    <p class="text-xs text-slate-500 font-bold">Memuat riwayat...</p>
                </div>
            </td>
        </tr>`;
    
    try {
        const res = await fetch(`${API_BASE}/api/history`);
        const data = await res.json();
        const rows = data.history || [];
        
        // Update pagination state
        historyPagination.totalItems = rows.length;
        historyPagination.totalPages = Math.ceil(rows.length / historyPagination.itemsPerPage);
        
        if (rows.length === 0) {
            // Enhanced empty state
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-4 py-12 text-center">
                        <div class="empty-state-icon">📋</div>
                        <p class="text-sm font-bold text-slate-400 mb-1">Belum ada riwayat</p>
                        <p class="text-xs text-slate-600">Aktivitas admin akan muncul di sini</p>
                    </td>
                </tr>`;
            updatePaginationControls();
            return;
        }
        
        // Calculate pagination
        const startIdx = (historyPagination.currentPage - 1) * historyPagination.itemsPerPage;
        const endIdx = startIdx + historyPagination.itemsPerPage;
        const paginatedRows = rows.slice(startIdx, endIdx);
        
        tbody.innerHTML = '';
        paginatedRows.forEach((item) => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-800/80 hover:bg-slate-900/50 transition-colors';
            const relativeTime = formatRelativeTime(item.created_at);
            const exactTime = formatWIBTimestamp(item.created_at);
            
            // Badge color based on action type
            let badgeClass = 'badge ';
            if (item.action === 'ADD') badgeClass += 'badge-add';
            else if (item.action === 'EDIT') badgeClass += 'badge-edit';
            else if (item.action === 'DELETE') badgeClass += 'badge-delete';
            else badgeClass += 'badge-add';
            
            tr.innerHTML = `
                <td class="px-4 py-3"><span class="${badgeClass}">${item.action}</span></td>
                <td class="px-4 py-3 text-xs font-bold text-white truncate max-w-[8rem]">${escapeHtml(item.site_name)}</td>
                <td class="px-4 py-3 text-[10px] text-slate-400">${escapeHtml(item.diff_summary || '')}</td>
                <td class="px-4 py-3">
                    <span class="relative-time" title="${exactTime}">${relativeTime}</span>
                </td>`;
            tbody.appendChild(tr);
        });
        
        updatePaginationControls();
    } catch (e) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-4 py-8 text-center">
                    <div class="text-3xl mb-3 opacity-30">⚠️</div>
                    <p class="text-sm font-bold text-red-400 mb-2">Gagal memuat riwayat</p>
                    <p class="text-xs text-slate-500 mb-4">${escapeHtml(e.message)}</p>
                    <button onclick="loadServerHistoryTable()" class="text-[10px] font-black uppercase tracking-widest bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 px-4 py-2 rounded-xl transition-colors">
                        Coba lagi
                    </button>
                </td>
            </tr>`;
    }
}

/**
 * Update pagination controls for history table
 */
function updatePaginationControls() {
    let paginationEl = document.getElementById('historyPagination');
    
    if (!paginationEl) {
        // Create pagination container if it doesn't exist
        const historySection = document.querySelector('[data-tab-panel="history"]');
        if (!historySection) return;
        
        paginationEl = document.createElement('div');
        paginationEl.id = 'historyPagination';
        paginationEl.className = 'mt-4';
        historySection.appendChild(paginationEl);
    }
    
    if (historyPagination.totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }
    
    const { currentPage, totalPages, totalItems, itemsPerPage } = historyPagination;
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    
    paginationEl.innerHTML = `
        <div class="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div class="text-xs text-slate-500 font-bold">
                Menampilkan ${startItem}-${endItem} dari ${totalItems} entri
            </div>
            <div class="flex items-center gap-2">
                <button 
                    onclick="goToHistoryPage(${currentPage - 1})" 
                    ${currentPage === 1 ? 'disabled' : ''}
                    class="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${
                        currentPage === 1 
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }">
                    ← Prev
                </button>
                <div class="flex items-center gap-1">
                    ${generatePageNumbers(currentPage, totalPages)}
                </div>
                <button 
                    onclick="goToHistoryPage(${currentPage + 1})" 
                    ${currentPage === totalPages ? 'disabled' : ''}
                    class="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${
                        currentPage === totalPages 
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }">
                    Next →
                </button>
            </div>
        </div>`;
}

/**
 * Generate page number buttons
 */
function generatePageNumbers(currentPage, totalPages) {
    const pages = [];
    const maxVisible = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        pages.push(`
            <button 
                onclick="goToHistoryPage(${i})" 
                class="w-8 h-8 text-[10px] font-black rounded-lg transition-colors ${
                    isActive 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }">
                ${i}
            </button>
        `);
    }
    
    return pages.join('');
}

/**
 * Navigate to specific history page
 */
function goToHistoryPage(page) {
    if (page < 1 || page > historyPagination.totalPages) return;
    historyPagination.currentPage = page;
    loadServerHistoryTable();
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

async function clearServerHistory() {
    showConfirmDialog(
        'Yakin hapus SEMUA riwayat server? Ini nggak bisa di-undo, bestie.',
        async () => {
            try {
                const res = await fetch(`${API_BASE}/api/history`, { method: 'DELETE', headers: getHeaders() });
                const d = await res.json();
                if (d.error) throw new Error(d.error);
                toastAdmin(`✓ Riwayat dikosongin (${d.deleted || 0} baris).`, 'success');
                loadServerHistoryTable();
                loadStats();
            } catch (e) {
                toastAdmin('Gagal: ' + e.message, 'error');
            }
        }
    );
}

function cancelEdit() {
    editingSiteId = null;
    document.getElementById('siteNameInput').value = '';
    document.getElementById('siteLinksInput').value = '';
    document.getElementById('cancelEditBtn').classList.add('hidden');
    const btn = document.getElementById('saveBtn');
    btn.innerText = 'Simpan ke server';
    btn.className =
        'w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition-colors shadow-lg active:scale-95 shadow-indigo-900/40';
}

async function loadSites() {
    const container = document.getElementById('listDisplay');
    if (container) {
        // Show loading skeleton
        container.innerHTML = `
            <div class="space-y-3">
                <div class="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 animate-pulse">
                    <div class="h-4 bg-slate-700 rounded w-1/3 mb-2"></div>
                    <div class="h-6 bg-slate-700 rounded w-2/3"></div>
                </div>
                <div class="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 animate-pulse">
                    <div class="h-4 bg-slate-700 rounded w-1/3 mb-2"></div>
                    <div class="h-6 bg-slate-700 rounded w-2/3"></div>
                </div>
            </div>`;
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/sites`);
        const data = await res.json();
        categories = {};
        sitesData = data.sites;
        sitesData.forEach((site) => {
            categories[site.id] = {
                id: site.id,
                name: site.name,
                is_active: site.is_active !== 0,
                links: site.links.split(/\r?\n/).map((l) => l.trim()).filter((l) => l)
            };
        });
        render();
    } catch (err) {
        if (container) {
            container.innerHTML = `
                <div class="text-center p-8 border-2 border-dashed border-red-500/30 rounded-3xl bg-red-500/5">
                    <div class="text-4xl mb-3 opacity-30">⚠️</div>
                    <p class="text-sm font-bold text-red-400 mb-2">Gagal memuat data situs</p>
                    <p class="text-xs text-slate-500 mb-4">${escapeHtml(err.message)}</p>
                    <button onclick="loadSites()" class="text-[10px] font-black uppercase tracking-widest bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 px-4 py-2 rounded-xl transition-colors">
                        Coba lagi
                    </button>
                </div>`;
        }
        toastAdmin('Gagal muat data situs: ' + err.message, 'error');
    }
}

function render() {
    const container = document.getElementById('listDisplay');
    container.innerHTML = '';
    if (sitesData.length === 0) {
        // Enhanced empty state
        container.innerHTML = `
            <div class="text-center p-12 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/40">
                <div class="text-6xl mb-4 opacity-20">📋</div>
                <p class="text-sm font-bold text-slate-400 mb-2">Belum ada kategori</p>
                <p class="text-xs text-slate-600 mb-6">Mulai dengan mengisi form di atas atau upload file TXT</p>
                <button onclick="document.getElementById('siteNameInput').focus()" class="text-[10px] font-black uppercase tracking-widest bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 px-4 py-2 rounded-xl">
                    Buat kategori pertama
                </button>
            </div>`;
        return;
    }

    sitesData.forEach((site, idx) => {
        const data = categories[site.id];
        const htmlName = data.name.replace(/^Kategori\s+/i, '').trim();
        const activeText = data.is_active ? 'ON' : 'OFF';
        const activeClass = data.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400';
        
        const upBtn =
            idx === 0
                ? '<div class="w-8 h-8"></div>'
                : `<button type="button" onclick="moveUp(${idx})" class="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center text-xs font-black transition-colors">▲</button>`;
        const downBtn =
            idx === sitesData.length - 1
                ? '<div class="w-8 h-8"></div>'
                : `<button type="button" onclick="moveDown(${idx})" class="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center text-xs font-black transition-colors">▼</button>`;

        const row = document.createElement('div');
        row.className =
            'bg-slate-900/90 p-4 rounded-2xl border border-slate-800 flex justify-between items-stretch gap-3 shadow-lg';
        row.innerHTML = `
            <div class="flex flex-col justify-center gap-1 py-1 pr-2 border-r border-slate-800 shrink-0">
                ${upBtn}
                ${downBtn}
            </div>
            <div class="flex-1 min-w-0 py-1">
                <div class="flex items-center gap-2 mb-1">
                    <p class="text-[9px] text-slate-500 font-black uppercase tracking-widest">Kategori</p>
                    <button onclick="toggleActive('${data.id}', ${!data.is_active})" class="px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${activeClass}">${activeText}</button>
                </div>
                <h3 class="font-black text-sm ${data.is_active ? 'text-white' : 'text-slate-500'} truncate uppercase tracking-tight">${escapeHtml(htmlName)}</h3>
                <p class="text-[10px] text-emerald-400/90 font-bold mt-1">${data.links.length} link</p>
            </div>
            <div class="flex flex-col justify-center gap-2 shrink-0">
                <button type="button" onclick="editSite('${data.id}')" class="text-[9px] bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 px-3 py-2 rounded-xl font-black uppercase tracking-wider">Edit</button>
                <button type="button" onclick="deleteSite('${data.id}')" class="text-[9px] text-red-400/90 hover:text-red-300 font-black uppercase px-1">Hapus</button>
            </div>`;
        container.appendChild(row);
    });
}

async function toggleActive(id, newState) {
    try {
        const res = await fetch(`${API_BASE}/api/sites/${id}/toggle`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ is_active: newState })
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        loadSites();
    } catch (e) {
        toastAdmin('Gagal merubah status.');
    }
}

async function moveUp(index) {
    if (index === 0) return;
    const temp = sitesData[index];
    sitesData[index] = sitesData[index - 1];
    sitesData[index - 1] = temp;
    render();
    await syncOrder();
}

async function moveDown(index) {
    if (index === sitesData.length - 1) return;
    const temp = sitesData[index];
    sitesData[index] = sitesData[index + 1];
    sitesData[index + 1] = temp;
    render();
    await syncOrder();
}

async function syncOrder() {
    const orders = sitesData.map((s, i) => ({ id: s.id, order: i }));
    try {
        const res = await fetch(`${API_BASE}/api/sites/order`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ orders })
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
    } catch (e) {
        toastAdmin('Gagal simpan urutan.');
        loadSites();
    }
}

async function saveSiteManual() {
    const name = document.getElementById('siteNameInput').value.trim();
    const rawLinks = document.getElementById('siteLinksInput').value.trim();
    const btn = document.getElementById('saveBtn');

    // Validate before submit
    const nameValidation = validateSiteName(name);
    const linksValidation = validateLinks(rawLinks);
    
    if (!nameValidation.valid) {
        showValidationMessage('siteNameInput', nameValidation);
        document.getElementById('siteNameInput').focus();
        return toastAdmin('Nama kategori tidak valid', 'error');
    }
    
    if (!linksValidation.valid) {
        showValidationMessage('siteLinksInput', linksValidation);
        document.getElementById('siteLinksInput').focus();
        return toastAdmin('Link tidak valid', 'error');
    }

    const linksArr = rawLinks
        .split(/\r?\n/)
        .map((line) => {
            let l = line.trim();
            if (!l) return null;
            if (!l.startsWith('http://') && !l.startsWith('https://')) l = 'https://' + l;
            return l;
        })
        .filter((l) => l !== null);

    if (linksArr.length === 0) return toastAdmin('Minimal satu link valid.', 'error');

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.innerHTML = '<span class="inline-block animate-spin mr-2">⏳</span> Menyimpan...';

    try {
        if (editingSiteId) {
            const res = await fetch(`${API_BASE}/api/sites/${editingSiteId}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ name, links: linksArr.join('\n') })
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            toastAdmin('✓ Kategori berhasil diupdate', 'success');
            cancelEdit();
        } else {
            const res = await fetch(`${API_BASE}/api/sites`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ name, links: linksArr.join('\n') })
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            toastAdmin('✓ Kategori baru berhasil ditambahkan', 'success');
            document.getElementById('siteNameInput').value = '';
            document.getElementById('siteLinksInput').value = '';
            clearValidationMessage('siteNameInput');
            clearValidationMessage('siteLinksInput');
        }
        loadSites();
        loadStats();
    } catch (err) {
        toastAdmin('Error: ' + err.message, 'error');
        if (String(err.message).includes('Password') || String(err.message).includes('Ditolak')) {
            sessionStorage.removeItem('__admin_pass');
            window.location.reload();
        }
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const sections = text.split(/\r?\n-\r?\n/);
        let successCount = 0;
        for (const section of sections) {
            const lines = section.split(/\r?\n/).map((l) => l.trim()).filter((l) => l);
            if (lines.length > 1) {
                const secName = lines[0];
                const links = lines
                    .slice(1)
                    .map((l) => {
                        if (!l.startsWith('http://') && !l.startsWith('https://')) return 'https://' + l;
                        return l;
                    })
                    .join('\n');
                try {
                    const res = await fetch(`${API_BASE}/api/sites`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ name: secName, links })
                    });
                    const d = await res.json();
                    if (!d.error) successCount++;
                } catch (err) {
                    if (String(err.message).includes('reload')) return;
                }
            }
        }
        toastAdmin(`Upload selesai: ${successCount} kategori baru.`);
        input.value = '';
        loadSites();
        loadStats();
    };
    reader.readAsText(file);
}

function editSite(siteId) {
    if (editingSiteId && editingSiteId !== siteId) {
        toastAdmin('Selesaikan atau batalkan edit yang aktif dulu.');
        return;
    }
    const data = categories[siteId];
    editingSiteId = siteId;
    document.getElementById('siteNameInput').value = data.name;
    document.getElementById('siteLinksInput').value = data.links.join('\n');
    const btn = document.getElementById('saveBtn');
    btn.innerText = 'Update skema';
    btn.className =
        'w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition-colors shadow-lg active:scale-95';
    document.getElementById('cancelEditBtn').classList.remove('hidden');
    showTab('sites');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteSite(siteId) {
    if (editingSiteId) return toastAdmin('Batalkan mode edit dulu.', 'error');
    
    const data = categories[siteId];
    showConfirmDialog(
        `Hapus kategori "${data.name}" permanen? Progress device ikut kehapus.`,
        async () => {
            try {
                const res = await fetch(`${API_BASE}/api/sites/${siteId}`, { method: 'DELETE', headers: getHeaders() });
                const d = await res.json();
                if (d.error) throw new Error(d.error);
                toastAdmin('✓ Kategori berhasil dihapus', 'success');
                loadSites();
                loadStats();
            } catch (err) {
                toastAdmin('Gagal menghapus: ' + err.message, 'error');
            }
        }
    );
}
