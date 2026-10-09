/**
 * Link Manager — cari, filter, pilih, bulk action, impor TXT, duplikat.
 * Memakai API existing: GET/POST/PUT/DELETE /api/sites.
 */
const LM_STATE = {
    page: 1,
    perPage: 25,
    search: '',
    queueId: '',
    selected: new Set(),
    rows: []
};

function lmAllLinks() {
    // Flatten semua link dari seluruh antrean: { url, siteId, siteName, index }
    const out = [];
    sitesData.forEach((site) => {
        const data = categories[site.id];
        if (!data) return;
        data.links.forEach((url, i) => {
            out.push({ url, siteId: site.id, siteName: data.name, index: i });
        });
    });
    return out;
}

function lmFiltered() {
    let rows = lmAllLinks();
    if (LM_STATE.queueId) rows = rows.filter((r) => r.siteId === LM_STATE.queueId);
    const q = LM_STATE.search.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.url.toLowerCase().includes(q) || r.siteName.toLowerCase().includes(q));
    return rows;
}

function lmDuplicateGroups() {
    const map = new Map();
    lmAllLinks().forEach((r) => {
        const key = normalizeUrl(r.url);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(r);
    });
    return [...map.entries()].filter(([, arr]) => arr.length > 1);
}

function normalizeUrl(u) {
    let s = String(u || '').trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
    s = s.replace(/\/+$/, '');
    return s;
}

/** Render tabel link manager ke #lmTableBody */
function lmRender() {
    const rows = lmFiltered();
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / LM_STATE.perPage));
    if (LM_STATE.page > pages) LM_STATE.page = pages;
    const start = (LM_STATE.page - 1) * LM_STATE.perPage;
    const pageRows = rows.slice(start, start + LM_STATE.perPage);

    const dupKeys = new Set(lmDuplicateGroups().map(([k]) => k));
    const body = document.getElementById('lmTableBody');
    const info = document.getElementById('lmPageInfo');
    const selCount = document.getElementById('lmSelectedCount');
    if (!body) return;

    if (total === 0) {
        body.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-sm text-slate-400">${
            LM_STATE.search || LM_STATE.queueId ? 'Tidak ada link yang cocok dengan filter.' : 'Belum ada link. Tambahkan lewat form di atas.'
        }</td></tr>`;
    } else {
        body.innerHTML = pageRows
            .map((r) => {
                const isDup = dupKeys.has(normalizeUrl(r.url));
                const checked = LM_STATE.selected.has(r.url + '|' + r.siteId) ? 'checked' : '';
                return `<tr class="hover:bg-slate-900/50">
                    <td><input type="checkbox" class="lm-row-check w-4 h-4 rounded border-slate-600 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                        data-key="${escapeAttr(r.url + '|' + r.siteId)}" ${checked} aria-label="Pilih link"></td>
                    <td class="text-xs font-mono text-slate-300 break-all">${escapeHtml(r.url)}${
                        isDup ? ' <span class="badge badge--warning ml-1">duplikat</span>' : ''
                    }</td>
                    <td class="text-sm text-slate-400">${escapeHtml(r.siteName)}</td>
                    <td class="text-xs text-slate-400 tabular-nums">${r.index + 1}</td>
                    <td>
                        <div class="flex items-center gap-1">
                            <button type="button" class="btn btn--ghost !py-1 !px-2 text-xs" data-lm-copy="${escapeAttr(r.url)}">Salin</button>
                            ${isSafeHttpUrl(r.url) ? `<a class="btn btn--ghost !py-1 !px-2 text-xs" href="${escapeAttr(r.url)}" target="_blank" rel="noopener noreferrer">Buka</a>` : '<span class="btn btn--ghost !py-1 !px-2 text-xs opacity-40 cursor-not-allowed" title="URL tidak valid">Buka</span>'}
                        </div>
                    </td>
                </tr>`;
            })
            .join('');
    }

    if (info) info.textContent = total === 0 ? 'Tidak ada link' : `Menampilkan ${start + 1}-${Math.min(start + LM_STATE.perPage, total)} dari ${total} link`;
    if (selCount) selCount.textContent = `${LM_STATE.selected.size} dipilih`;

    const prev = document.getElementById('lmPrevBtn');
    const next = document.getElementById('lmNextBtn');
    if (prev) prev.disabled = LM_STATE.page <= 1;
    if (next) next.disabled = LM_STATE.page >= pages;

    const dupInfo = document.getElementById('lmDupInfo');
    if (dupInfo) {
        const n = dupKeys.size;
        dupInfo.textContent = n > 0 ? `${n} URL duplikat terdeteksi (ditandai di tabel).` : 'Tidak ada URL duplikat.';
    }
}

function lmToggleAll(checked) {
    const rows = lmFiltered().slice((LM_STATE.page - 1) * LM_STATE.perPage, LM_STATE.page * LM_STATE.perPage);
    rows.forEach((r) => {
        const key = r.url + '|' + r.siteId;
        if (checked) LM_STATE.selected.add(key);
        else LM_STATE.selected.delete(key);
    });
    lmRender();
}

function lmOnRowCheck(el) {
    const key = el.getAttribute('data-key');
    if (!key) return;
    if (el.checked) LM_STATE.selected.add(key);
    else LM_STATE.selected.delete(key);
    const selCount = document.getElementById('lmSelectedCount');
    if (selCount) selCount.textContent = `${LM_STATE.selected.size} dipilih`;
}

async function lmDeleteSelected() {
    const keys = [...LM_STATE.selected];
    if (keys.length === 0) return toastAdmin('Belum ada link yang dipilih.');
    const ok = await showConfirmDialog({
        title: 'Hapus link terpilih',
        message: `Hapus ${keys.length} link dari antreannya? Tindakan ini langsung tersimpan ke server.`,
        confirmText: 'Hapus'
    });
    if (!ok) return;

    const bySite = new Map();
    keys.forEach((k) => {
        const [url, siteId] = k.split('|');
        if (!bySite.has(siteId)) bySite.set(siteId, new Set());
        bySite.get(siteId).add(url);
    });

    let changed = 0;
    for (const [siteId, urls] of bySite) {
        const data = categories[siteId];
        if (!data) continue;
        const kept = data.links.filter((u) => !urls.has(u));
        try {
            const res = await fetch(`${API_BASE}/api/sites/${siteId}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ name: data.name, links: kept.join('\n') })
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            changed += data.links.length - kept.length;
        } catch (e) {
            toastAdmin('Gagal menghapus link di ' + data.name + ': ' + e.message);
        }
    }
    LM_STATE.selected.clear();
    await loadSites();
    toastAdmin(`${changed} link dihapus.`);
}

async function lmCopy(url) {
    try {
        await navigator.clipboard.writeText(url);
        toastAdmin('URL disalin.');
    } catch (e) {
        toastAdmin('Gagal menyalin URL.');
    }
}

function lmBind() {
    const body = document.getElementById('lmTableBody');
    if (body && !body.dataset.bound) {
        body.dataset.bound = '1';
        body.addEventListener('change', (e) => {
            if (e.target.classList.contains('lm-row-check')) lmOnRowCheck(e.target);
        });
        body.addEventListener('click', (e) => {
            const copyBtn = e.target.closest('[data-lm-copy]');
            if (copyBtn) lmCopy(copyBtn.getAttribute('data-lm-copy'));
        });
    }
    const all = document.getElementById('lmSelectAll');
    if (all && !all.dataset.bound) {
        all.dataset.bound = '1';
        all.addEventListener('change', () => lmToggleAll(all.checked));
    }
    const search = document.getElementById('lmSearch');
    if (search && !search.dataset.bound) {
        search.dataset.bound = '1';
        search.addEventListener('input', () => {
            LM_STATE.search = search.value;
            LM_STATE.page = 1;
            lmRender();
        });
    }
    const queueSel = document.getElementById('lmQueueFilter');
    if (queueSel && !queueSel.dataset.bound) {
        queueSel.dataset.bound = '1';
        queueSel.addEventListener('change', () => {
            LM_STATE.queueId = queueSel.value;
            LM_STATE.page = 1;
            lmRender();
        });
    }
    const perPage = document.getElementById('lmPerPage');
    if (perPage && !perPage.dataset.bound) {
        perPage.dataset.bound = '1';
        perPage.addEventListener('change', () => {
            LM_STATE.perPage = parseInt(perPage.value, 10) || 25;
            LM_STATE.page = 1;
            lmRender();
        });
    }
}

function lmSetPage(delta) {
    LM_STATE.page = Math.max(1, LM_STATE.page + delta);
    lmRender();
}

function lmFillQueueFilter() {
    const sel = document.getElementById('lmQueueFilter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML =
        '<option value="">Semua antrean</option>' +
        sitesData.map((s) => `<option value="${escapeAttr(s.id)}">${escapeHtml(categories[s.id] ? categories[s.id].name : s.id)}</option>`).join('');
    sel.value = current;
}

/** Tambah link ke antrean terpilih; lewati yang duplikat di antrean itu. */
async function lmAddLinks() {
    const siteId = document.getElementById('lmAddTarget')?.value;
    const raw = document.getElementById('lmAddInput')?.value || '';
    const skipDup = document.getElementById('lmSkipDup')?.checked !== false;

    if (!siteId) return toastAdmin('Pilih antrean tujuan dulu.');
    const data = categories[siteId];
    if (!data) return toastAdmin('Antrean tidak ditemukan.');

    const incoming = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => (/^https?:\/\//i.test(l) ? l : 'https://' + l));

    if (incoming.length === 0) return toastAdmin('Belum ada link untuk ditambahkan.');

    const existing = new Set(data.links.map(normalizeUrl));
    const seen = new Set();
    const toAdd = [];
    let skipped = 0;
    incoming.forEach((u) => {
        const key = normalizeUrl(u);
        if (skipDup && (existing.has(key) || seen.has(key))) {
            skipped++;
            return;
        }
        seen.add(key);
        toAdd.push(u);
    });

    if (toAdd.length === 0) return toastAdmin(`Semua ${skipped} link sudah ada di antrean ini.`);

    try {
        const res = await fetch(`${API_BASE}/api/sites/${siteId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ name: data.name, links: data.links.concat(toAdd).join('\n') })
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        document.getElementById('lmAddInput').value = '';
        await loadSites();
        toastAdmin(`${toAdd.length} link ditambahkan${skipped ? `, ${skipped} duplikat dilewati` : ''}.`);
    } catch (e) {
        toastAdmin('Gagal menambah link: ' + e.message);
    }
}

/** Hapus semua URL duplikat, sisakan kemunculan pertama per antrean. */
async function lmRemoveDuplicates() {
    const groups = lmDuplicateGroups();
    if (groups.length === 0) return toastAdmin('Tidak ada duplikat untuk dibersihkan.');
    const ok = await showConfirmDialog({
        title: 'Bersihkan duplikat',
        message: `Bersihkan ${groups.length} kelompok URL duplikat? Kemunculan pertama dipertahankan.`,
        confirmText: 'Bersihkan'
    });
    if (!ok) return;

    const bySite = new Map();
    groups.forEach(([, arr]) => {
        arr.slice(1).forEach((r) => {
            if (!bySite.has(r.siteId)) bySite.set(r.siteId, new Set());
            bySite.get(r.siteId).add(r.url);
        });
    });

    let removed = 0;
    for (const [siteId, urls] of bySite) {
        const data = categories[siteId];
        if (!data) continue;
        const kept = data.links.filter((u) => !urls.has(u));
        try {
            const res = await fetch(`${API_BASE}/api/sites/${siteId}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ name: data.name, links: kept.join('\n') })
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            removed += data.links.length - kept.length;
        } catch (e) {
            toastAdmin('Gagal membersihkan duplikat di ' + data.name + ': ' + e.message);
        }
    }
    await loadSites();
    toastAdmin(`${removed} link duplikat dihapus.`);
}

/** Ekspor semua link (atau hasil filter) sebagai file TXT. */
function lmExportTxt() {
    const rows = lmFiltered();
    if (rows.length === 0) return toastAdmin('Tidak ada link untuk diekspor.');
    const text = rows.map((r) => r.url).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'testlink-links.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    toastAdmin(`${rows.length} link diekspor.`);
}

function lmFillAddTarget() {
    const sel = document.getElementById('lmAddTarget');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = sitesData
        .map((s) => `<option value="${escapeAttr(s.id)}">${escapeHtml(categories[s.id] ? categories[s.id].name : s.id)}</option>`)
        .join('');
    if (current) sel.value = current;
}

/** Dipanggil setelah loadSites() agar tabel & filter link manager ikut segar. */
function lmRefreshAll() {
    lmFillQueueFilter();
    lmFillAddTarget();
    lmBind();
    lmRender();
}



