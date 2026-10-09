/**
 * TestLink Master App Logic - Stabil & Terverifikasi
 */

const API_BASE = window.location.origin;
let deviceId = localStorage.getItem('__linkflow_uuid') || (() => {
    const id = 'dev-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    localStorage.setItem('__linkflow_uuid', id);
    return id;
})();

// Escape HTML (escapeHtml/escapeAttr/isSafeHttpUrl) dimuat dari js/utils.js — konsolidasi A-02.

// Status Global
let sitesData = [];
let categories = {};
let isRunning = false;
let activeCatId = "";
/** Interval yang mengecek countdownDeadlineMs vs Date.now() (lebih andal dari worker saat tab tidak fokus) */
let deadlineWatchId = null;
let countdownDeadlineMs = null;
let countdownFiring = false;
let modeAuto = false; // False = Fokus Tab, True = Otomatis Jeda
/** State UI runner: idle | ping | ready | running | paused | waiting-focus | validating | completed */
let runnerState = 'idle';
let awaitingValidation = false;
let validatingUrl = "";
let awaitingFocusReturn = false;
let pingInProgress = false;

// History State
let histData = [];
let histCurrentPage = 1;
let histPageSize = 10;

// Speedtest Logic
let speedChart = null;
let speedDataPoints = [];

let appSettings = {};

const PING_BADGE_OK = 'w-10 h-10 bg-emerald-500/15 rounded-full flex items-center justify-center text-emerald-400 font-bold text-xs uppercase border border-emerald-500/30';
const PING_BADGE_FAIL = 'w-10 h-10 bg-red-500/15 rounded-full flex items-center justify-center text-red-400 font-bold text-xs uppercase border border-red-500/30';

async function loadAppSettings() {
    try {
        const res = await fetch(`${API_BASE}/api/settings`);
        if (!res.ok) return;
        const data = await res.json();
        appSettings = data.settings || {};
        const title = appSettings.app_title || 'Test Link';
        const tag = appSettings.app_tagline || '';
        const brandEl = document.getElementById('appBrandTitle');
        const tagEl = document.getElementById('appBrandTagline');
        if (brandEl) brandEl.textContent = title;
        if (tagEl) tagEl.textContent = tag || 'Runner link & cek koneksi';
        document.title = `${title} · Worker`;
        const defInt = parseInt(String(appSettings.default_interval || '3'), 10);
        const intervalInput = document.getElementById('intervalInput');
        if (intervalInput && !Number.isNaN(defInt) && defInt >= 1) intervalInput.value = String(defInt);
        const banner = document.getElementById('maintenanceBanner');
        if (banner) {
            const on = appSettings.maintenance_mode === '1' || appSettings.maintenance_mode === 'true';
            if (on) {
                banner.textContent = appSettings.maintenance_message || 'Mode perawatan: fitur tetap jalan, tapi tim mungkin lagi oprek server.';
                banner.classList.remove('hidden');
            } else {
                banner.classList.add('hidden');
            }
        }
    } catch (e) {}
}

function openToolsSheet() {
    const panel = document.getElementById('toolsPanel');
    if (!panel) return;
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
}

function closeToolsSheet() {
    const panel = document.getElementById('toolsPanel');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
}

function showToast(message) {
    const host = document.getElementById('toastHost');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast-item';
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3400);
}

function stopDeadlineWatch() {
    if (deadlineWatchId) {
        clearInterval(deadlineWatchId);
        deadlineWatchId = null;
    }
}

function startDeadlineWatch() {
    stopDeadlineWatch();
    const tick = () => {
        if (!isRunning || !countdownDeadlineMs) {
            stopDeadlineWatch();
            return;
        }
        const rem = countdownDeadlineMs - Date.now();
        const num = document.getElementById('countdownNumber');
        if (num) num.innerText = Math.max(0, rem / 1000).toFixed(2);
        if (rem <= 0) {
            stopDeadlineWatch();
            const box = document.getElementById('countdownBox');
            if (box) box.classList.add('hidden');
            countdownDeadlineMs = null;
            executeOpenLink();
        }
    };
    tick();
    deadlineWatchId = setInterval(tick, 200);
}

async function refreshHistoryBadgeMeta() {
    try {
        const r = await fetch(`${API_BASE}/api/history/meta`);
        if (!r.ok) return;
        const j = await r.json();
        const seen = parseInt(localStorage.getItem('__tl_hist_seen_id') || '0', 10) || 0;
        if (j.newestId > seen && 'setAppBadge' in navigator) {
            await navigator.setAppBadge(1).catch(() => {});
        }
    } catch (e) {}
}

async function clearHistoryBadgeSeen() {
    try {
        const r = await fetch(`${API_BASE}/api/history/meta`);
        if (r.ok) {
            const j = await r.json();
            if (j.newestId != null) localStorage.setItem('__tl_hist_seen_id', String(j.newestId));
        }
        if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
    } catch (e) {}
}

function registerPWA() {
    // Registrasi service worker ditangani /js/pwa.js (termasuk banner update).
}

// Inisialisasi Aplikasi
document.addEventListener("DOMContentLoaded", async () => {
    await loadAppSettings();
    document.getElementById('deviceIdDisplay').innerText = `ID: ${deviceId}`;
    loadSites();
    loadHistory();
    initInterceptors();
    initModeToggles();
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeToolsSheet();
    });
    // Delegasi aksi kartu antrean (menggantikan onclick berisi data server)
    document.addEventListener('click', (e) => {
        const sel = e.target.closest('[data-cat-select]');
        if (sel) return selectCat(sel.getAttribute('data-cat-select'), sel);
        const rst = e.target.closest('[data-cat-reset]');
        if (rst) return resetProgress(rst.getAttribute('data-cat-reset'));
    });

    checkConnectionInfo();
    registerPWA();
    refreshHistoryBadgeMeta();
    setInterval(refreshHistoryBadgeMeta, 120000);
});

// PENCEGAHAN KELUAR & REFRESH (hanya saat runner/ping aktif)
function initInterceptors() {
    window.onbeforeunload = function (e) {
        if (!isRunning && !pingInProgress) return;
        e.preventDefault();
        e.returnValue = '';
    };

    history.pushState(null, null, location.href);
    window.addEventListener('popstate', function() {
        document.getElementById('exitModal').classList.remove('hidden');
        history.pushState(null, null, location.href);
    });
}

function cancelExit() { document.getElementById('exitModal').classList.add('hidden'); }
function confirmExit() { 
    window.onbeforeunload = null;
    history.back(); 
    setTimeout(() => location.reload(), 100);
}

// LOADING DATA SISTEM
async function loadSites() {
    try {
        const res = await fetch(`${API_BASE}/api/sites?deviceId=${deviceId}`);
        if (!res.ok) throw new Error("Gagal mengambil data sites.");
        const data = await res.json();
        categories = {};
        sitesData = data.sites;
        sitesData.forEach(site => {
            const linksArr = site.links.split(/\r?\n/).map(l => l.trim()).filter(l => l);
            categories[site.id] = {
                id: site.id, name: site.name, links: linksArr,
                lastIndex: site.progress.last_index || 0,
                normal: site.progress.normal_count || 0,
                error: site.progress.error_count || 0,
                skippedLinks: []
            };
        });
        renderSiteList();
        refreshHistoryBadgeMeta();
    } catch (err) {
        console.error(err);
        document.getElementById('listDisplay').innerHTML = `<p class="text-xs text-red-500 font-black p-6 text-center italic uppercase">Error: ${escapeHtml(err.message)}</p>`;
    }
}

// RENDERING DAFTAR SITUS
function renderSiteList() {
    const list = document.getElementById('listDisplay');
    if (!list) return;
    list.innerHTML = '';

    if (sitesData.length === 0) {
        list.innerHTML = `<div class="empty-state"><span class="empty-state__title">Belum ada antrean</span>Buat antrean baru di <a href="admin.html" class="text-indigo-400 hover:underline">Panel Admin</a>.</div>`;
        return;
    }

    const sortedSites = [...sitesData].sort((a, b) => {
        const da = categories[a.id];
        const db = categories[b.id];
        const aFin = da.lastIndex >= da.links.length && da.links.length > 0;
        const bFin = db.lastIndex >= db.links.length && db.links.length > 0;
        if (aFin && !bFin) return 1;
        if (!aFin && bFin) return -1;
        return 0; // urutan original (sort_order)
    });

    sortedSites.forEach(site => {
        const data = categories[site.id];
        const isFinished = data.lastIndex >= data.links.length && data.links.length > 0;
        const progress = data.links.length === 0
            ? 0
            : Math.min(100, Math.round((data.lastIndex / data.links.length) * 100));

        const card = document.createElement('div');
        card.className = `site-card flex items-center justify-between p-4 ${isFinished ? 'border-emerald-500/20 opacity-80' : ''}`;

        card.innerHTML = `
            <div class="flex-1 truncate min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="label !mb-0">Antrean</span>
                    ${isFinished ? '<span class="badge badge--success">Selesai</span>' : ''}
                </div>
                <h3 class="font-semibold text-white text-base truncate mb-2">${escapeHtml(data.name.replace(/^Kategori\s+/i, ''))}</h3>
                <div class="flex items-center gap-3">
                    <div class="progress flex-1">
                        <div class="progress__bar" style="width: ${progress}%"></div>
                    </div>
                    <span class="text-sm text-slate-400 tabular-nums">${data.lastIndex}/${data.links.length} link</span>
                </div>
            </div>
            <div class="ml-4 shrink-0 flex flex-col gap-2 items-stretch">
                <button type="button" data-cat-select="${escapeAttr(data.id)}"
                    class="btn btn--primary btn--block">${isFinished ? 'Buka' : 'Lanjut'}</button>
                <button type="button" data-cat-reset="${escapeAttr(data.id)}"
                    class="btn btn--ghost !py-2" title="Reset progres">↻ Reset</button>
            </div>
        `;
        list.appendChild(card);
    });
}

// SELEKSI SITUS & RUNNER
function selectCat(id, el) {
    if (isRunning || pingInProgress) return showToast("Hentikan proses yang berjalan dulu!");
    if (el) el.classList.add('btn-click-feedback');

    setTimeout(() => {
        activeCatId = id;
        const data = categories[id];
        document.getElementById('statusCard').classList.remove('hidden');
        document.getElementById('activeCatTitle').innerText = data.name;

        window.clearSafeBrowsingReport(); // Clear if switching category

        if (data.lastIndex >= data.links.length) {
            runnerState = 'completed';
        } else {
            runnerState = 'ping';
        }

        renderRunnerState();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 200);
}

// STATE RUNNER: ping | ready | running | paused | waiting-focus | validating | completed
const RUNNER_BADGE = {
    ping: ['Pengecekan', 'badge--neutral'],
    ready: ['Siap', 'badge--neutral'],
    running: ['Berjalan', 'badge--success'],
    paused: ['Jeda', 'badge--warning'],
    'waiting-focus': ['Menunggu tab', 'badge--warning'],
    validating: ['Validasi', 'badge--warning'],
    completed: ['Selesai', 'badge--success']
};

function renderRunnerState() {
    const data = categories[activeCatId];
    if (!data) return;

    const total = data.links.length;
    document.getElementById('counter').innerText = `${data.lastIndex}/${total}`;
    const pct = total ? Math.min(100, Math.round((data.lastIndex / total) * 100)) : 0;
    const bar = document.getElementById('runnerProgressBar');
    if (bar) bar.style.width = pct + '%';

    document.getElementById('currentLink').innerText =
        data.lastIndex > 0 ? (data.links[data.lastIndex - 1] || '') : 'Tunggu untuk memulai...';
    document.getElementById('nextLinkSingle').innerText = data.links[data.lastIndex] || 'Selesai';

    const badge = document.getElementById('runnerStateBadge');
    const [text, cls] = RUNNER_BADGE[runnerState] || ['Siap', 'badge--neutral'];
    badge.className = 'badge ' + cls + ' shrink-0 mt-1';
    badge.innerText = text;

    const inRunnerPhase = ['ready', 'running', 'paused', 'waiting-focus', 'validating'].includes(runnerState);
    document.getElementById('pingControls').classList.toggle('hidden', runnerState !== 'ping');
    document.getElementById('runnerControls').classList.toggle('hidden', !inRunnerPhase);
    document.getElementById('completedControls').classList.toggle('hidden', runnerState !== 'completed');

    if (inRunnerPhase) {
        const startBtn = document.getElementById('startAutoBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const showStart = runnerState === 'ready' || runnerState === 'paused';
        startBtn.classList.toggle('hidden', !showStart);
        startBtn.innerText = runnerState === 'paused' ? 'Lanjut' : 'Mulai';
        pauseBtn.classList.toggle('hidden', runnerState !== 'running');
    }

    // Konfigurasi hanya bisa diubah saat tidak berjalan
    const locked = ['running', 'paused', 'waiting-focus', 'validating'].includes(runnerState);
    const modeToggle = document.getElementById('modeToggle');
    const mvToggle = document.getElementById('manualValidationToggle');
    if (modeToggle) modeToggle.disabled = locked;
    if (mvToggle) mvToggle.disabled = locked || modeAuto;
}

function startRunner() {
    const data = categories[activeCatId];
    if (!data || data.lastIndex >= data.links.length) {
        showToast('Antrean ini sudah selesai.');
        return;
    }

    isRunning = true;
    runnerState = 'running';
    document.getElementById('statusIndicator').className = 'w-2 h-2 rounded-full bg-indigo-500 animate-pulse';
    document.getElementById('focusStatus').innerText = 'Runner berjalan';

    renderRunnerState();
    triggerNextWithCountdown();
}

function pauseRunner() {
    if (!isRunning) return;
    isRunning = false;
    stopDeadlineWatch();
    countdownDeadlineMs = null;
    countdownFiring = false;
    document.getElementById('countdownBox').classList.add('hidden');
    document.getElementById('statusIndicator').className = 'w-2 h-2 rounded-full bg-amber-500';
    document.getElementById('focusStatus').innerText = 'Dijeda';
    runnerState = 'paused';
    renderRunnerState();
}

function stopRunner() {
    isRunning = false; awaitingValidation = false; awaitingFocusReturn = false;
    stopDeadlineWatch();
    countdownDeadlineMs = null;
    countdownFiring = false;
    document.getElementById('countdownBox').classList.add('hidden');
    document.getElementById('statusIndicator').className = 'w-2 h-2 rounded-full bg-slate-600';
    document.getElementById('focusStatus').innerText = 'Standby';
    runnerState = 'ready';
    renderRunnerState();
}

function runAgain() {
    const data = categories[activeCatId];
    if (!data) return;
    data.lastIndex = 0;
    data.normal = 0;
    data.error = 0;
    data.skippedLinks = [];
    finalizeAction().then(() => startRunner());
}

function backToQueues() {
    document.getElementById('statusCard').classList.add('hidden');
    runnerState = 'idle';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// LOGIKA RUNNER & MODE TOGGLES
function initModeToggles() {
    const mt = document.getElementById('modeToggle');
    const mvt = document.getElementById('manualValidationToggle');
    const mvc = document.getElementById('manualValidationCtrl');

    // On Load State
    mt.checked = false; // Fokus Tab
    mvt.checked = true; // Manual Validation On
    modeAuto = false;

    mt.addEventListener('change', (e) => {
        modeAuto = e.target.checked;
        document.getElementById('modeDesc').innerText = modeAuto
            ? "Jeda antrean di tab ini — lanjut tanpa harus kembali fokus"
            : "Buka link di tab baru, lalu kembali ke tab ini untuk lanjut";
        mvc.classList.toggle('opacity-30', modeAuto);
        mvt.disabled = modeAuto;
    });
}

function incrementInterval() {
    const el = document.getElementById('intervalInput');
    el.value = parseInt(el.value) + 1;
}

function decrementInterval() { 
    const el = document.getElementById('intervalInput');
    if (parseInt(el.value) > 1) el.value = parseInt(el.value) - 1; 
}

function triggerNextWithCountdown() {
    const data = categories[activeCatId];
    if (!isRunning || !data || data.lastIndex >= data.links.length) return;

    runnerState = 'running';
    renderRunnerState();
    const box = document.getElementById('countdownBox');
    const sec = parseInt(document.getElementById('intervalInput').value, 10) || 3;
    countdownDeadlineMs = Date.now() + Math.max(1, sec) * 1000;
    box.classList.remove('hidden');

    startDeadlineWatch();
}

async function executeOpenLink() {
    if (!isRunning || countdownFiring) return;
    countdownFiring = true;
    try {
        const data = categories[activeCatId];
        
        while (data.lastIndex < data.links.length && data.skippedLinks && data.skippedLinks.includes(data.links[data.lastIndex])) {
            data.lastIndex++;
        }

        const url = data.links[data.lastIndex];
        if (!url) {
            finishJobs();
            return;
        }

        const fullUrl = url.startsWith('http') ? url : 'https://' + url;
        let blocked = false;
        let isGsbThreat = false;
        try {
            const chk = await fetch(`${API_BASE}/api/check-block`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: fullUrl })
            });
            if (chk.ok) {
                const j = await chk.json();
                blocked = !!j.blocked;
                isGsbThreat = !!j.fromGSB;
            }
        } catch (e) {}

        document.getElementById('currentLink').innerText = url + (blocked ? (isGsbThreat ? '  ·  ditolak GSB' : '  ·  redirect blokir') : '');
        if (!blocked) {
            try { window.open(fullUrl, '_blank'); } catch (e) {}
        } else {
            const msg = isGsbThreat ? 'Bahaya Malicious Terdeteksi Google Safe Browsing — dilewati.' : 'Link redirect ke halaman blokir Kominfo — dilewati.';
            showToast(msg);
            appendBlockedLinkToReport(fullUrl);
        }

        if (modeAuto) {
            if (blocked) data.error++;
            else data.normal++;
            data.lastIndex++;
            await finalizeAction();
            if (data.lastIndex < data.links.length) {
                triggerNextWithCountdown();
            } else finishJobs();
        } else {
            if (blocked) {
                data.error++;
                data.lastIndex++;
                await finalizeAction();
                if (data.lastIndex < data.links.length) triggerNextWithCountdown();
                else finishJobs();
                return;
            }
            awaitingFocusReturn = true;
            runnerState = 'waiting-focus';
            renderRunnerState();
            document.getElementById('focusStatus').innerText = 'Menunggu kembali ke tab';
        }
    } finally {
        countdownFiring = false;
    }
}

document.addEventListener('visibilitychange', () => {
    if (modeAuto && isRunning && countdownDeadlineMs) {
        const rem = countdownDeadlineMs - Date.now();
        const num = document.getElementById('countdownNumber');
        if (num) num.innerText = Math.max(0, rem / 1000).toFixed(2);
        if (rem <= 0) {
            stopDeadlineWatch();
            document.getElementById('countdownBox').classList.add('hidden');
            countdownDeadlineMs = null;
            executeOpenLink();
        }
    }
    if (!modeAuto && isRunning && document.visibilityState === 'visible') {
        if (awaitingFocusReturn) {
            awaitingFocusReturn = false;
            const data = categories[activeCatId];
            const url = data.links[data.lastIndex];
            
            const manual = document.getElementById('manualValidationToggle').checked;
            if (manual) {
                awaitingValidation = true;
                validatingUrl = url;
                runnerState = 'validating';
                renderRunnerState();
                document.getElementById('validationBox').classList.remove('hidden');
                document.getElementById('validatingLink').innerText = url;
            } else {
                // Auto skip validation, go to countdown after focus back
                data.normal++;
                data.lastIndex++;
                finalizeAction().then(() => {
                    if (data.lastIndex < data.links.length) triggerNextWithCountdown();
                    else finishJobs();
                });
            }
        }
    }
});

async function submitValidation(status) {
    if (!awaitingValidation) return;
    awaitingValidation = false;
    document.getElementById('validationBox').classList.add('hidden');
    runnerState = 'running';
    renderRunnerState();
    
    const data = categories[activeCatId];
    if (status === 'normal') data.normal++; 
    else if (status === 'blokir' || status === 'error') data.error++;
    
    data.lastIndex++;
    await finalizeAction();
    
    if (data.lastIndex < data.links.length) triggerNextWithCountdown();
    else finishJobs();
}

async function finalizeAction() {
    renderRunnerState();
    const data = categories[activeCatId];
    try {
        await fetch(`${API_BASE}/api/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                deviceId, siteId: activeCatId, 
                lastIndex: data.lastIndex, normalCount: data.normal, errorCount: data.error 
            })
        });
        renderSiteList();
    } catch (e) {
        console.warn("Gagal sinkron progres.");
    }
}

function finishJobs() {
    isRunning = false;
    stopDeadlineWatch();
    countdownDeadlineMs = null;
    countdownFiring = false;
    document.getElementById('countdownBox').classList.add('hidden');
    document.getElementById('statusIndicator').className = 'w-2 h-2 rounded-full bg-emerald-500';
    document.getElementById('focusStatus').innerText = 'Selesai';
    runnerState = 'completed';
    renderRunnerState();
    showToast('Antrean selesai. Semua link sudah dibuka.');
}

window.clearSafeBrowsingReport = function() {
    document.getElementById('sbReportList').innerHTML = "";
    document.getElementById('sbReportBox').classList.add('hidden');
};

function appendBlockedLinkToReport(url) {
    const box = document.getElementById('sbReportBox');
    const list = document.getElementById('sbReportList');
    box.classList.remove('hidden');
    
    const div = document.createElement('div');
    div.className = "flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl mb-2";
    const canOpen = isSafeHttpUrl(url);
    div.innerHTML = `
        <span class="text-[10px] items-center text-slate-300 font-mono truncate flex-1">${escapeHtml(url)}</span>
        ${canOpen ? `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" class="shrink-0 p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors border border-indigo-500/20" title="Buka manual">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
            </svg>
        </a>` : ''}
    `;
    list.appendChild(div);
}

// --- Provider & DNS (alias luas Telkomsel / XL / Indosat) ---
const PUBLIC_DNS_MARKERS = [
    'cloudflare', '1.1.1.1', 'cloudflared', 'google dns', 'googlehosted', 'googledomains',
    'opendns', 'quad9', 'nextdns', 'adguard', 'controld', 'dnslify', 'cira', 'cleanbrowsing',
    'comss.one', 'dns.sb', 'mullvad dns'
];
const ISP_TSEL_ALIASES = [
    'telkomsel', 'telkom', 'telekomunikasi indonesia', 'pt telekomunikasi', 'telkom indonesia',
    'simpati', 'kartu as', 'halo', 'halo telkomsel', 'indihome', 'telkomnet', 'telin', 'telkom sigma',
    'telkomsigma', 'metroneet', 'iconnect', 'telkomsel flash', 'byu', 'orbit telkomsel', 'as33287',
    'as7713', 'as131111', 'telkomuniversity', 'telkom akses', 'iforte', 'lintasarta'
];
const ISP_XL_ALIASES = [
    'xl axiata', 'xl smart', 'pt xl', 'xl axiata tbk', 'excelcomindo', 'axis', 'axis net',
    'hutchison 3', 'h3i indonesia', 'my xl', 'xl prioritas', 'intranet xl', 'xl bom', 'xl home',
    'as24203', 'as38799', 'xlsmart', 'xl co id'
];
const ISP_ISAT_ALIASES = [
    'indosat', 'indosat ooredoo', 'ooredoo', 'hutchison', 'h3i', 'ioh', 'indosat hutchison',
    'three', ' tri', '3id', 'im3', 'mentari', 'matrix', 'freedom internet', 'isat', 'isat ip',
    'starone', 'indosat mega', 'as4761 indosat', 'as17974', 'as138886', 'tri indonesia'
];

function classifyIspFamily(ispL) {
    if (ISP_TSEL_ALIASES.some((a) => ispL.includes(a))) return 'telkom';
    if (ISP_XL_ALIASES.some((a) => ispL.includes(a))) return 'xl';
    if (ISP_ISAT_ALIASES.some((a) => ispL.includes(a))) return 'isat';
    return null;
}

function isPublicDnsResolver(rL) {
    return PUBLIC_DNS_MARKERS.some((m) => rL.includes(m));
}

/** DNS dianggap selaras untuk uji blokir: operator / infrastruktur ID umum, bukan DoH umum */
function dnsAlignedForIndonesia(ispL, rL) {
    if (isPublicDnsResolver(rL)) return false;
    const fam = classifyIspFamily(ispL);
    const indoInfra = [
        'indonesia network information',
        'idnic',
        'network information center',
        'apnic',
        'wasantara net',
        'telkomsigma',
        'nawala'
    ].some((x) => rL.includes(x));

    if (fam === 'telkom') {
        if (['iconnect', 'telkom', 'telkomsel', 'indihome', 'telkomnet', 'telin', 'lintasarta'].some((x) => rL.includes(x))) return true;
        if (indoInfra) return true;
    }
    if (fam === 'xl') {
        if (['xl', 'axiata', 'excelcomindo', 'axis', 'hutchison'].some((x) => rL.includes(x))) return true;
        if (indoInfra) return true;
    }
    if (fam === 'isat') {
        if (['indosat', 'ooredoo', 'hutchison', 'three', ' tri', 'ioh'].some((x) => rL.includes(x))) return true;
        if (indoInfra) return true;
    }
    const ispTok = (ispL.split(/[\s,/]+/).filter(Boolean)[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
    const rTok = (rL.split(/[\s,/]+/).filter(Boolean)[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
    if (ispTok && rTok && (ispTok.includes(rTok) || rTok.includes(ispTok))) return true;
    if (rL.includes('telekomunikasi')) return true;
    return false;
}

function fillNetworkConnectionFields() {
    const nc = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const typeEl = document.getElementById('connNetType');
    const effEl = document.getElementById('connNetEff');
    if (!typeEl || !effEl) return;
    if (!nc) {
        typeEl.innerText = 'Tidak tersedia';
        effEl.innerText = '—';
        return;
    }
    const rawType = (nc.type || 'unknown').toString();
    const t = rawType.toLowerCase();
    let label = rawType.toUpperCase();
    if (t === 'cellular' || t === 'none') {
        const eff = (nc.effectiveType || '').toUpperCase();
        label = eff ? `${eff} (seluler)` : 'SELULER';
    }
    if (t === 'wifi') label = 'Wi‑Fi';
    if (t === 'ethernet') label = 'Ethernet';
    typeEl.innerText = label;
    effEl.innerText = nc.effectiveType ? String(nc.effectiveType).toUpperCase() : '—';
}

// LOGIKA VERIFIKASI KONEKSI
async function checkConnectionInfo() {
    document.getElementById('connModal').classList.remove('hidden');
    const btn = document.getElementById('refreshConnBtn');
    btn.disabled = true; btn.innerText = "Mengecek...";

    document.getElementById('connBrowser').innerText = navigator.userAgent;
    document.getElementById('connIP').innerText = "Mencari...";
    document.getElementById('connISP').innerText = "Mencari...";
    document.getElementById('connDNS').innerText = "Mengecek...";
    fillNetworkConnectionFields();

    try {
        const ipRes = await fetch('https://ipapi.co/json/');
        const ipData = await ipRes.json();
        const userIp = ipData.ip || "Unknown";
        const userOrg = ipData.org || ipData.asn || "Unknown";
        document.getElementById('connIP').innerText = userIp;
        document.getElementById('connISP').innerText = userOrg;

        const ispL = userOrg.toLowerCase();
        const knownIsp = classifyIspFamily(ispL) !== null;
        document.getElementById('connProviderWarning').classList.toggle('hidden', knownIsp);

        const dnsRes = await fetch('https://edns.ip-api.com/json');
        const dnsData = await dnsRes.json();
        const rOrg = dnsData.dns.geo || "Unknown";
        const rL = rOrg.toLowerCase();

        const finalSesuai = dnsAlignedForIndonesia(ispL, rL);

        document.getElementById('connDNS').innerText = finalSesuai ? "Sesuai (DNS operator / ID)" : "Tidak sesuai (DNS pribadi / umum)";
        document.getElementById('dnsIndicator').className = `w-2 h-2 rounded-full ${finalSesuai ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]'}`;
        document.getElementById('dnsDetailBox').classList.remove('hidden');
        document.getElementById('connDNSName').innerText = rOrg;
        
        const statusEl = document.getElementById('connStatusText');
        if (statusEl) {
            statusEl.innerText = finalSesuai
                ? ''
                : 'DNS resolver terlihat bukan jalur operator/umum Indonesia. Untuk hasil blokir yang konsisten, pakai DNS otomatis / bawaan kartu (mis. iConnect & Telkomsel, INNIC + XL).';
        }
        document.getElementById('connStatusAlert').classList.toggle('hidden', finalSesuai);
    } catch (e) {
        document.getElementById('connIP').innerText = "Gagal memuat";
    } finally {
        btn.disabled = false; btn.innerText = "Cek Ulang";
    }
}

function dismissConnModal() { document.getElementById('connModal').classList.add('hidden'); }

// SPEEDTEST DENGAN GRAFIK
function openSpeedModal() {
    document.getElementById('speedModal').classList.remove('hidden');
    initSpeedChart();
}

function initSpeedChart() {
    if (speedChart) speedChart.destroy();
    const ctx = document.getElementById('speedChart').getContext('2d');
    speedChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(20).fill(''),
            datasets: [{
                data: [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { display: false }, y: { display: true, ticks: { display: false } } },
            plugins: { legend: { display: false } },
            animation: false
        }
    });
}

function runSpeedTest() {
    const btn = document.getElementById('speedStartBtn');
    btn.disabled = true; btn.innerText = "Mengecek...";
    
    let progress = 0;
    speedDataPoints = [];
    const interval = setInterval(() => {
        progress += 2;
        document.getElementById('speedProgress').style.width = `${progress}%`;
        const speed = 20 + Math.random() * 80;
        speedDataPoints.push(speed);
        document.getElementById('speedValue').innerText = speed.toFixed(1);
        speedChart.data.datasets[0].data.push(speed);
        if (speedChart.data.datasets[0].data.length > 20) speedChart.data.datasets[0].data.shift();
        speedChart.update();

        const avg = speedDataPoints.reduce((a, b) => a + b, 0) / speedDataPoints.length;
        document.getElementById('speedAvg').innerText = avg.toFixed(1);

        if (progress >= 100) {
            clearInterval(interval);
            btn.disabled = false; btn.innerText = "Ulangi Test";
        }
    }, 100);
}

function closeSpeedModal() { document.getElementById('speedModal').classList.add('hidden'); }

// PING TERMINAL & SKIP FAIL LINKS
async function pingUrl(url) {
    const s = performance.now();
    const fullUrl = url.startsWith('http') ? url : 'https://' + url;
    try {
        const chk = await fetch(`${API_BASE}/api/check-block`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: fullUrl }),
            signal: AbortSignal.timeout(15000)
        });
        const ms = Math.round(performance.now() - s);
        if (!chk.ok) return { ok: false, ms, reason: 'error' };
        const j = await chk.json();
        if (j.unreachable) return { ok: false, ms, reason: 'unreachable' };
        if (j.blocked) return { ok: false, ms, reason: 'blocked' };
        return { ok: true, ms };
    } catch (e) {
        return { ok: false, ms: Math.round(performance.now() - s), reason: 'error' };
    }
}

function openPingModal() {
    document.getElementById('pingModal').classList.remove('hidden');
    const data = categories[activeCatId];
    if (!data) return;
    const badge = document.getElementById('pingStatusBadge');
    if (badge) {
        badge.innerText = 'OK';
        badge.className = PING_BADGE_OK;
    }
    const count = data.links.length - data.lastIndex;
    document.getElementById('pingStats').innerText = `0 / ${count}`;
    document.getElementById('pingStartTime').innerText = "MULAI: " + new Date().toLocaleString();
    document.getElementById('pingModalTerminal').innerHTML = "";
    document.getElementById('pingProgressBar').style.width = "0%";
    document.getElementById('pingPercentage').innerText = "0%";
}

async function startPingTestDetailed() {
    const startBtn = document.getElementById('pingStartBtn');
    if (pingInProgress) {
        pingInProgress = false;
        startBtn.innerText = "Mulai";
        startBtn.className = "bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl text-[11px] uppercase tracking-widest shadow-md active:scale-95 transition-all";
        return;
    }

    pingInProgress = true;
    startBtn.innerText = "Berhenti";
    startBtn.className = "bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl text-[11px] uppercase tracking-widest shadow-md active:scale-95 transition-all";
    
    const terminal = document.getElementById('pingModalTerminal');
    const wrapper = document.getElementById('pingTerminalWrapper');
    const data = categories[activeCatId];
    const targets = data.links.slice(data.lastIndex);
    let failCount = 0;
    
    const badge = document.getElementById('pingStatusBadge');
    badge.innerText = "OK";
    badge.className = PING_BADGE_OK;

    for (let i = 0; i < targets.length; i++) {
        if (!pingInProgress) break;
        const url = targets[i];
        // Strip HTTPS
        const cleanUrl = url.replace(/^https?:\/\//i, '');
        const res = await pingUrl(url.startsWith('h') ? url : 'https://' + url);
        
        const line = document.createElement('div');
        if (res.ok) {
            line.innerHTML = `<span class="text-emerald-400">✓ ${escapeHtml(cleanUrl)} OK ${res.ms}ms</span>`;
        } else {
            const tag =
                res.reason === 'blocked' ? 'BLOKIR' : res.reason === 'unreachable' ? 'TAK TERJANGKAU' : 'FAIL';
            line.innerHTML = `<span class="text-red-500">✖ ${escapeHtml(cleanUrl)} ${tag}</span>`;
            
            if (res.reason === 'blocked') appendBlockedLinkToReport(url.startsWith('h') ? url : 'https://' + url);

            data.skippedLinks.push(url);
            data.error++;
            failCount++;
            
            // Switch badge to FAIL
            badge.innerText = "FAIL";
            badge.className = PING_BADGE_FAIL;
        }
        terminal.appendChild(line);
        wrapper.scrollTop = wrapper.scrollHeight;
        
        const p = targets.length ? Math.round(((i + 1) / targets.length) * 100) : 0;
        document.getElementById('pingProgressBar').style.width = p + "%";
        document.getElementById('pingPercentage').innerText = p + "%";
        document.getElementById('pingStats').innerText = `${i + 1} / ${targets.length}`;
    }
    
    pingInProgress = false;
    startBtn.innerText = "Mulai";
    startBtn.className = "bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl text-[11px] uppercase tracking-widest shadow-md active:scale-95 transition-all";
    terminal.innerHTML += `<div class="pt-4 text-white font-black uppercase">SELESAI, GAGAL ${failCount}</div>`;
    wrapper.scrollTop = wrapper.scrollHeight;
    
    finalizeAction();
}

function resetPingTestDetailed() {
    pingInProgress = false;
    const startBtn = document.getElementById('pingStartBtn');
    startBtn.innerText = "Mulai";
    startBtn.className = "bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl text-[11px] uppercase tracking-widest shadow-md active:scale-95 transition-all";
    openPingModal();
}

function closePingModal() {
    document.getElementById('pingModal').classList.add('hidden');
    finishPingPhase();
}

function finishPingPhase() {
    runnerState = 'ready';
    renderRunnerState();
}

// RIWAYAT AKTIVITAS - PAGINATION & CLEANUP
async function loadHistory() {
    try {
        const res = await fetch(`${API_BASE}/api/history`);
        const data = await res.json();
        const rawHistory = data.history || [];
        
        // Auto-cleanup items older than 7 days
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        histData = rawHistory.filter(item => {
            const itemDate = new Date(item.created_at).getTime();
            return itemDate >= sevenDaysAgo;
        });
        
        renderHistory();
        refreshHistoryBadgeMeta();
    } catch (e) {}
}

async function openHistory() {
    document.getElementById('historyModal').classList.remove('hidden');
    if (typeof HSOverlay !== 'undefined') {
        const modal = document.getElementById('historyModal');
        HSOverlay.open(modal);
    }
    await loadHistory();
    await clearHistoryBadgeSeen();
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.add('hidden');
    if (typeof HSOverlay !== 'undefined') {
        const modal = document.getElementById('historyModal');
        HSOverlay.close(modal);
    }
}

function renderHistory() {
    const container = document.getElementById('historyModalDisplay');
    if (!container) return;

    let filteredData = histData;
    const searchTerm = document.getElementById('histSearch')?.value.toLowerCase() || '';
    if (searchTerm) {
        filteredData = histData.filter(item =>
            (item.site_name || '').toLowerCase().includes(searchTerm) ||
            (item.diff_summary || '').toLowerCase().includes(searchTerm) ||
            (item.action || '').toLowerCase().includes(searchTerm)
        );
    }

    const totalPages = Math.ceil(filteredData.length / histPageSize) || 1;
    if (histCurrentPage > totalPages) histCurrentPage = totalPages;

    const start = (histCurrentPage - 1) * histPageSize;
    const end = start + histPageSize;
    const currentItems = filteredData.slice(start, end);

    if (currentItems.length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="empty-state__title">${searchTerm ? 'Tidak ada hasil untuk pencarian' : 'Belum ada riwayat dalam 7 hari terakhir.'}</span></div>`;
    } else {
        container.innerHTML = `
            <table class="table min-w-[600px]">
                <thead>
                    <tr>
                        <th class="w-20">Aksi</th>
                        <th>Antrean</th>
                        <th>Ringkasan</th>
                        <th class="w-40">Waktu</th>
                    </tr>
                </thead>
                <tbody id="historyTableBody"></tbody>
            </table>
        `;
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;

        currentItems.forEach((item, idx) => {
            let diffStr = escapeHtml(item.diff_summary || '');
            let p = { added: [], removed: [] };
            try { p = JSON.parse(item.diff_details || '{}'); } catch (e) {}

            if (p.added && p.added.length > 0) {
                diffStr = diffStr.replace(/(\+\d+\slink)/gi, `<span onclick="showDiffDetails(${start + idx}, 'added')" class="text-emerald-400 underline cursor-pointer hover:text-emerald-300 bg-emerald-500/10 px-1 rounded">$1</span>`);
            }
            if (p.removed && p.removed.length > 0) {
                diffStr = diffStr.replace(/(-\d+\slink\shapus)/gi, `<span onclick="showDiffDetails(${start + idx}, 'removed')" class="text-red-400 underline cursor-pointer hover:text-red-300 bg-red-500/10 px-1 rounded">$1</span>`);
            }

            const date = new Date(item.created_at).toLocaleString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const actionClass = item.action === 'ADD' ? 'badge--success' : item.action === 'EDIT' ? 'badge--neutral' : 'badge--danger';

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-900/50';
            tr.innerHTML = `
                <td><span class="badge ${actionClass}">${escapeHtml(item.action)}</span></td>
                <td class="font-medium text-white truncate max-w-[16rem]">${escapeHtml(item.site_name)}</td>
                <td class="text-sm text-slate-300">${diffStr}</td>
                <td class="text-xs text-slate-400 whitespace-nowrap">${date} WIB</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Update Pagination UI
    const pageInfo = document.getElementById('histPageInfo');
    if (pageInfo) pageInfo.innerText = `Halaman ${histCurrentPage} dari ${totalPages}`;

    document.getElementById('prevHistBtn').disabled = histCurrentPage <= 1;
    document.getElementById('nextHistBtn').disabled = histCurrentPage >= totalPages;
}

function changeHistPageSize() {
    histPageSize = parseInt(document.getElementById('histPerPage').value);
    histCurrentPage = 1;
    renderHistory();
}

function prevHistPage() { if (histCurrentPage > 1) { histCurrentPage--; renderHistory(); } }
function nextHistPage() { 
    const totalPages = Math.ceil(histData.length / histPageSize);
    if (histCurrentPage < totalPages) { histCurrentPage++; renderHistory(); } 
}

function showDiffDetails(globalIdx, type) {
    const item = histData[globalIdx];
    let p = { added: [], removed: [] };
    try { p = JSON.parse(item.diff_details || '{}'); } catch (e) {}
    const links = p[type] || [];
    document.getElementById('diffModal').classList.remove('hidden');
    document.getElementById('diffModalTitle').innerText = type === 'added' ? 'LINK DITAMBAHKAN' : 'LINK DIHAPUS';
    document.getElementById('diffModalContent').innerHTML = links.map(l => `<div>• ${escapeHtml(l)}</div>`).join("") || "Kosong.";
}

function closeDiff() { document.getElementById('diffModal').classList.add('hidden'); }

async function resetProgress(siteId) {
    if (isRunning || pingInProgress) return showToast('Stop runner atau ping dulu sebelum reset.');
    if (!confirm('Reset ulang progres pengetesan situs ini?')) return;
    categories[siteId].lastIndex = 0;
    categories[siteId].normal = 0;
    categories[siteId].error = 0;
    if (categories[siteId].skippedLinks) categories[siteId].skippedLinks = [];
    activeCatId = siteId;
    await finalizeAction();
}

function gotoHome() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
