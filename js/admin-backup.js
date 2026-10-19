/**
 * Backup & restore kategori + link (JSON).
 * Alur: unduh file JSON dari GET /api/backup, lalu pulihkan lewat POST /api/restore.
 * Mode restore: "merge" (default, tidak menghapus data) atau "replace" (cermin file backup).
 */
const BK_STATE = {
    payload: null,
    fileName: '',
    mode: 'merge',
    busy: false
};

const BK_FORMAT = 'testlink-backup';

/** Normalisasi link dari array/string jadi array URL bersih. */
function bkNormalizeLinks(raw) {
    let items = [];
    if (Array.isArray(raw)) items = raw;
    else if (typeof raw === 'string') items = raw.split(/\r?\n/);
    return items
        .map((l) => String(l == null ? '' : l).trim())
        .filter(Boolean)
        .map((l) => (/^[a-z][a-z0-9+.-]*:\/\//i.test(l) ? l : 'https://' + l));
}

/** Validasi isi file backup → { sites: [{name, links, is_active}], skipped, meta }. */
function bkParsePayload(raw) {
    const source = Array.isArray(raw) ? raw : raw && Array.isArray(raw.sites) ? raw.sites : null;
    if (!source) throw new Error('File bukan backup TestLink (tidak ada field "sites").');

    const sites = [];
    let skipped = 0;
    source.slice(0, 1000).forEach((site) => {
        if (!site || typeof site !== 'object') {
            skipped++;
            return;
        }
        const name = String(site.name == null ? '' : site.name).trim();
        const links = bkNormalizeLinks(site.links);
        if (!name || links.length === 0) {
            skipped++;
            return;
        }
        const activeRaw = site.is_active != null ? site.is_active : site.isActive;
        sites.push({
            name,
            links,
            is_active: activeRaw === 0 || activeRaw === false || activeRaw === '0' ? 0 : 1
        });
    });

    return {
        sites,
        skipped,
        meta: {
            format: (raw && raw.format) || '',
            version: (raw && raw.version) || null,
            exportedAt: (raw && raw.exported_at) || '',
            deviceId: (raw && raw.device_id) || ''
        }
    };
}

/** Device ID runner (progres disimpan per perangkat). */
function bkDeviceId() {
    try {
        return localStorage.getItem('__linkflow_uuid') || '';
    } catch (e) {
        return '';
    }
}

/** Unduh seluruh kategori + link sebagai file JSON. */
async function bkExport() {
    if (BK_STATE.busy) return;
    const btn = document.getElementById('bkExportBtn');
    BK_STATE.busy = true;
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Menyiapkan…';
    }
    try {
        const deviceId = bkDeviceId();
        const qs = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
        const res = await fetch(`${API_BASE}/api/backup${qs}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

        const totalLinks = (data.sites || []).reduce((n, s) => n + bkNormalizeLinks(s.links).length, 0);
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `testlink-backup-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        toastAdmin(`Backup diunduh: ${(data.sites || []).length} kategori, ${totalLinks} link.`);
    } catch (e) {
        toastAdmin('Gagal membuat backup: ' + e.message);
    } finally {
        BK_STATE.busy = false;
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Backup JSON';
        }
    }
}

/** Baca file yang dipilih, tampilkan pratinjau sebelum restore. */
function bkHandleFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(String(e.target.result));
            const info = bkParsePayload(parsed);
            if (info.sites.length === 0) throw new Error('Tidak ada kategori valid di file ini.');
            BK_STATE.payload = parsed;
            BK_STATE.fileName = file.name;
            bkRenderPreview(info);
        } catch (err) {
            bkClearPreview();
            toastAdmin('File tidak valid: ' + err.message);
        } finally {
            input.value = '';
        }
    };
    reader.onerror = () => toastAdmin('Gagal membaca file.');
    reader.readAsText(file);
}

function bkRenderPreview(info) {
    const box = document.getElementById('bkPreview');
    if (!box) return;
    const totalLinks = info.sites.reduce((n, s) => n + s.links.length, 0);
    const rows = info.sites
        .slice(0, 8)
        .map(
            (s) =>
                `<li class="flex items-center justify-between gap-3 py-1.5 border-b border-slate-800/60 last:border-0">
                    <span class="text-slate-200 truncate">${escapeHtml(s.name)}</span>
                    <span class="text-slate-400 tabular-nums shrink-0">${s.links.length} link${
                    s.is_active ? '' : ' · nonaktif'
                }</span>
                </li>`
        )
        .join('');
    const more = info.sites.length > 8 ? `<li class="pt-2 text-slate-500">+${info.sites.length - 8} kategori lain</li>` : '';

    box.innerHTML = `
        <div class="space-y-2">
            <p class="text-sm text-slate-300">
                <span class="font-semibold text-white">${escapeHtml(BK_STATE.fileName)}</span> ·
                ${info.sites.length} kategori · ${totalLinks} link
                ${info.skipped ? `· ${info.skipped} dilewati` : ''}
            </p>
            <ul class="text-xs">${rows}${more}</ul>
            <div class="flex flex-wrap items-center gap-3 pt-2">
                <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="radio" name="bkMode" value="merge" checked class="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-600 focus:ring-indigo-500">
                    Merge (aman)
                </label>
                <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="radio" name="bkMode" value="replace" class="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-600 focus:ring-indigo-500">
                    Replace (timpa semua)
                </label>
                <button type="button" id="bkRestoreBtn" class="btn btn--primary !py-2 !px-4 text-xs">Pulihkan sekarang</button>
                <button type="button" id="bkCancelBtn" class="btn btn--ghost !py-2 !px-4 text-xs">Batal</button>
            </div>
            <p class="text-xs text-slate-500">Merge melewati kategori dengan nama sama. Replace menghapus semua kategori lalu memulihkan isi file.</p>
        </div>`;
    box.classList.remove('hidden');

    box.querySelectorAll('input[name="bkMode"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            BK_STATE.mode = radio.value === 'replace' ? 'replace' : 'merge';
        });
    });
    const restoreBtn = document.getElementById('bkRestoreBtn');
    if (restoreBtn) restoreBtn.addEventListener('click', bkRestore);
    const cancelBtn = document.getElementById('bkCancelBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', bkClearPreview);
}

function bkClearPreview() {
    BK_STATE.payload = null;
    BK_STATE.fileName = '';
    BK_STATE.mode = 'merge';
    const box = document.getElementById('bkPreview');
    if (!box) return;
    box.innerHTML = '';
    box.classList.add('hidden');
}

/** Jalankan restore ke server sesuai mode terpilih. */
async function bkRestore() {
    if (!BK_STATE.payload || BK_STATE.busy) return;
    const mode = BK_STATE.mode === 'replace' ? 'replace' : 'merge';

    if (mode === 'replace') {
        const ok = await showConfirmDialog({
            title: 'Timpa semua kategori?',
            message:
                'Mode replace menghapus SEMUA kategori yang ada sekarang, lalu memulihkan isi file backup. Progress device untuk kategori yang tidak ada di file ikut hilang. Tindakan ini tidak bisa dibatalkan.',
            confirmText: 'Ya, timpa semua'
        });
        if (!ok) return;
    }

    const btn = document.getElementById('bkRestoreBtn');
    BK_STATE.busy = true;
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Memulihkan…';
    }
    try {
        const deviceId = bkDeviceId();
        const res = await fetch(`${API_BASE}/api/restore`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ mode, deviceId, payload: BK_STATE.payload })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

        const parts = [`${data.added} kategori dipulihkan`];
        if (data.skipped) parts.push(`${data.skipped} dilewati`);
        if (mode === 'replace') parts.push(`${data.deleted} kategori lama dihapus`);
        if (data.progressRestored) parts.push(`${data.progressRestored} progress`);
        toastAdmin(`Restore selesai: ${parts.join(', ')}.`);

        bkClearPreview();
        await loadSites();
        loadStats();
    } catch (e) {
        toastAdmin('Gagal restore: ' + e.message);
    } finally {
        BK_STATE.busy = false;
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Pulihkan sekarang';
        }
    }
}
