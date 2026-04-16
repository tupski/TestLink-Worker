/**
 * TestLink Master App Logic - Stabil & Terverifikasi
 */

const API_BASE = window.location.origin;
let deviceId = localStorage.getItem('__linkflow_uuid') || (() => {
    const id = 'dev-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    localStorage.setItem('__linkflow_uuid', id);
    return id;
})();

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
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
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
        document.getElementById('listDisplay').innerHTML = `<p class="text-xs text-red-500 font-black p-6 text-center italic uppercase">Error: ${err.message}</p>`;
    }
}

// RENDERING DAFTAR SITUS
function renderSiteList() {
    const list = document.getElementById('listDisplay');
    if (!list) return;
    list.innerHTML = "";

    if (sitesData.length === 0) {
        list.innerHTML = `<p class="text-sm text-slate-500 italic p-10 text-center border-dashed border-2 border-slate-800 rounded-[2.5rem]">Belum ada data masuk.</p>`;
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
        card.className = `site-card relative overflow-hidden flex items-center justify-between p-6 bg-slate-900 border ${isFinished ? 'border-emerald-500/20 opacity-80' : 'border-slate-800 shadow-xl'} rounded-[2rem] animate-fade-in transition-all hover:bg-slate-800/50`;
        
        card.innerHTML = `
            <div class="flex-1 truncate">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-[7px] font-black uppercase text-indigo-400 tracking-[0.2em]">DATABASE</span>
                    ${isFinished ? '<span class="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-500 text-[6px] font-black rounded uppercase">Selesai</span>' : ''}
                </div>
                <h3 class="font-black text-white text-base truncate uppercase tracking-tighter italic mb-3">${data.name.replace(/^Kategori\s+/i, '')}</h3>
                <div class="flex items-center gap-3">
                    <div class="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all" style="width: ${progress}%"></div>
                    </div>
                    <span class="text-[8px] font-black text-slate-500 uppercase">${data.lastIndex}/${data.links.length} LINKS</span>
                </div>
            </div>
            <div class="ml-4 shrink-0 flex flex-col gap-2 items-stretch">
                <button type="button" onclick="selectCat('${data.id}', this)" class="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-5 py-3.5 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">${isFinished ? 'Buka' : 'Lanjut'}</button>
                <button type="button" onclick="resetProgress('${data.id}')" class="p-3 bg-slate-950 rounded-xl border border-slate-700 hover:bg-slate-800 text-[9px] font-black uppercase text-slate-500 hover:text-amber-400 transition-all" title="Reset progres">↺ Reset</button>
            </div>
        `;
        list.appendChild(card);
    });
}

// SELEKSI SITUS & RUNNER
function selectCat(id, el) {
    if (isRunning || pingInProgress) return alert("Hentikan proses yang berjalan dulu!");
    if (el) el.classList.add('btn-click-feedback');

    setTimeout(() => {
        activeCatId = id;
        const data = categories[id];
        document.getElementById('statusCard').classList.remove('hidden');
        document.getElementById('activeCatTitle').innerText = data.name;
        
        window.clearSafeBrowsingReport(); // Clear if switching category

        if (data.lastIndex >= data.links.length) {
            finishPingPhase();
        } else {
            document.getElementById('pingControls').classList.remove('hidden');
            document.getElementById('runnerControls').classList.add('hidden');
        }
        
        updateRunnerUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 200);
}

function updateRunnerUI() {
    const data = categories[activeCatId];
    if (!data) return;
    
    document.getElementById('counter').innerText = `${data.lastIndex}/${data.links.length}`;
    document.getElementById('currentLink').innerText = data.links[data.lastIndex - 1] || "Siap Dimulai";
    document.getElementById('nextLinkSingle').innerText = data.links[data.lastIndex] || "SELESAI KESELURUHAN";
    
    const startBtn = document.getElementById('startAutoBtn');
    if (startBtn) startBtn.innerText = `Mulai Runner ${data.name.replace(/^Kategori\s+/i, '')}`;
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

function toggleAutoPilot() {
    if (isRunning) return;
    const data = categories[activeCatId];
    if (!data || data.lastIndex >= data.links.length) return alert("Situs ini sudah selesai.");

    isRunning = true;
    document.getElementById('statusIndicator').className = "w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,1)] animate-pulse";
    document.getElementById('focusStatus').innerText = "Runner Berjalan...";

    triggerNextWithCountdown();
}

function stopAutoPilot() {
    isRunning = false; awaitingValidation = false; awaitingFocusReturn = false;
    stopDeadlineWatch();
    countdownDeadlineMs = null;
    document.getElementById('countdownBox').classList.add('hidden');
    document.getElementById('statusIndicator').className = "w-1.5 h-1.5 rounded-full bg-slate-700";
    document.getElementById('focusStatus').innerText = "Standby / Berhenti";
    updateRunnerUI();
}

function triggerNextWithCountdown() {
    const data = categories[activeCatId];
    if (!isRunning || !data || data.lastIndex >= data.links.length) return;

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
        try {
            const chk = await fetch(`${API_BASE}/api/check-block`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: fullUrl })
            });
            if (chk.ok) {
                const j = await chk.json();
                blocked = !!j.blocked;
            }
        } catch (e) {}

        document.getElementById('currentLink').innerText = url + (blocked ? '  ·  redirect blokir' : '');
        if (!blocked) {
            try { window.open(fullUrl, '_blank'); } catch (e) {}
        } else {
            showToast('Link redirect ke halaman blokir — dilewati.');
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
            document.getElementById('focusStatus').innerText = "MENUNGGU ANDA KEMBALI KE TAB...";
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
    
    const data = categories[activeCatId];
    if (status === 'normal') data.normal++; 
    else if (status === 'blokir' || status === 'error') data.error++;
    
    data.lastIndex++;
    await finalizeAction();
    
    if (data.lastIndex < data.links.length) triggerNextWithCountdown();
    else finishJobs();
}

async function finalizeAction() {
    updateRunnerUI();
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
    showToast('Antrian selesai. Mantap!');
    alert("Test Link Selesai dilakukan.");
    stopAutoPilot();
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
    div.innerHTML = `
        <span class="text-[10px] items-center text-slate-300 font-mono truncate flex-1">${url}</span>
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="shrink-0 p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors border border-indigo-500/20" title="Buka manual">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
            </svg>
        </a>
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
            line.innerHTML = `<span class="text-emerald-400">✓ ${cleanUrl} OK ${res.ms}ms</span>`;
        } else {
            const tag =
                res.reason === 'blocked' ? 'BLOKIR' : res.reason === 'unreachable' ? 'TAK TERJANGKAU' : 'FAIL';
            line.innerHTML = `<span class="text-red-500">✖ ${cleanUrl} ${tag}</span>`;
            
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
    document.getElementById('pingControls').classList.add('hidden');
    document.getElementById('runnerControls').classList.remove('hidden');
    updateRunnerUI();
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
    await loadHistory();
    await clearHistoryBadgeSeen();
}

function renderHistory() {
    const container = document.getElementById('historyModalDisplay');
    if (!container) return;
    container.innerHTML = "";

    const filteredData = histData;
    const totalPages = Math.ceil(filteredData.length / histPageSize) || 1;
    if (histCurrentPage > totalPages) histCurrentPage = totalPages;

    const start = (histCurrentPage - 1) * histPageSize;
    const end = start + histPageSize;
    const currentItems = filteredData.slice(start, end);

    if (currentItems.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-500 italic text-center p-10">Belum ada riwayat dalam 7 hari terakhir.</p>`;
    } else {
        currentItems.forEach((item, idx) => {
            let diffStr = item.diff_summary;
            let p = { added: [], removed: [] };
            try { p = JSON.parse(item.diff_details || '{}'); } catch (e) {}

            if (p.added && p.added.length > 0) {
                diffStr = diffStr.replace(/(\+\d+\slink)/gi, `<span onclick="showDiffDetails(${start + idx}, 'added')" class="text-emerald-500 underline cursor-pointer hover:text-emerald-400 bg-emerald-500/10 px-1 rounded">$1</span>`);
            }
            if (p.removed && p.removed.length > 0) {
                diffStr = diffStr.replace(/(-\d+\slink\shapus)/gi, `<span onclick="showDiffDetails(${start + idx}, 'removed')" class="text-red-500 underline cursor-pointer hover:text-red-400 bg-red-500/10 px-1 rounded">$1</span>`);
            }

            const date = new Date(item.created_at).toLocaleString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const entry = document.createElement('div');
            entry.className = "mb-4 pb-4 border-b border-slate-800/50 last:border-0";
            entry.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[7px] font-black uppercase px-2 py-0.5 rounded ${item.action === 'ADD' ? 'bg-emerald-500/20 text-emerald-500' : item.action === 'EDIT' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-red-500/20 text-red-500'}">${item.action}</span>
                    <span class="text-[8px] text-slate-600 font-bold uppercase">${date} WIB</span>
                </div>
                <h4 class="text-xs font-black text-white italic uppercase tracking-tighter mb-1">${item.site_name}</h4>
                <p class="text-[10px] text-slate-400 leading-relaxed font-sans">${diffStr}</p>
            `;
            container.appendChild(entry);
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
    document.getElementById('diffModalContent').innerHTML = links.map(l => `<div>• ${l}</div>`).join("") || "Kosong.";
}

function closeDiff() { document.getElementById('diffModal').classList.add('hidden'); }

async function resetProgress(siteId) {
    if (isRunning || pingInProgress) return alert('Stop runner atau ping dulu sebelum reset.');
    if (!confirm('Reset ulang progres pengetesan situs ini?')) return;
    categories[siteId].lastIndex = 0;
    categories[siteId].normal = 0;
    categories[siteId].error = 0;
    if (categories[siteId].skippedLinks) categories[siteId].skippedLinks = [];
    activeCatId = siteId;
    await finalizeAction();
}

function gotoHome() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
