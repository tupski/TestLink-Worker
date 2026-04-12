/**
 * Panel admin — dashboard, kategori, pengaturan situs, riwayat server
 */
let sitesData = [];
let categories = {};
let editingSiteId = null;
let sessionPass = sessionStorage.getItem('__admin_pass') || null;
const API_BASE = window.location.origin;

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

function toastAdmin(msg) {
    const t = document.getElementById('adminToast');
    if (!t) return alert(msg);
    t.textContent = msg;
    t.classList.remove('hidden', 'opacity-0', 'translate-y-2');
    clearTimeout(toastAdmin._tm);
    toastAdmin._tm = setTimeout(() => {
        t.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => t.classList.add('hidden'), 300);
    }, 3200);
}

async function loadStats() {
    const elK = document.getElementById('statSites');
    const elL = document.getElementById('statLinks');
    const elH = document.getElementById('statHistory');
    if (elK) elK.textContent = '…';
    if (elL) elL.textContent = '…';
    if (elH) elH.textContent = '…';
    try {
        const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: getHeaders() });
        if (res.status === 403) throw new Error('403');
        const d = await res.json();
        if (elK) elK.textContent = d.siteCount ?? '0';
        if (elL) elL.textContent = d.linkCount ?? '0';
        if (elH) elH.textContent = d.historyCount ?? '0';
    } catch (e) {
        if (String(e.message) === '403') {
            sessionStorage.removeItem('__admin_pass');
            window.location.reload();
        }
        if (elK) elK.textContent = '-';
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
        toastAdmin('Halaman Tentang tersimpan. Cek /about.html');
    } catch (e) {
        toastAdmin('Gagal: ' + e.message);
    }
}

async function saveSettings() {
    const body = {
        app_title: document.getElementById('setAppTitle').value.trim(),
        app_tagline: document.getElementById('setAppTagline').value.trim(),
        default_interval: document.getElementById('setDefaultInterval').value,
        maintenance_mode: document.getElementById('setMaintenanceMode').checked ? '1' : '0',
        maintenance_message: document.getElementById('setMaintenanceMsg').value.trim()
    };
    try {
        const res = await fetch(`${API_BASE}/api/settings`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        toastAdmin('Pengaturan tersimpan. Refresh halaman worker buat lihat judul baru.');
    } catch (e) {
        toastAdmin('Gagal simpan: ' + e.message);
        if (String(e.message).includes('Password') || String(e.message).includes('403')) {
            sessionStorage.removeItem('__admin_pass');
            window.location.reload();
        }
    }
}

async function loadServerHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-slate-500 text-xs">Memuat…</td></tr>';
    try {
        const res = await fetch(`${API_BASE}/api/history`);
        const data = await res.json();
        const rows = data.history || [];
        if (rows.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="4" class="px-4 py-8 text-center text-slate-500 text-xs italic">Riwayat kosong.</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        rows.slice(0, 40).forEach((item) => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-800/80 hover:bg-slate-900/50';
            const when = new Date(item.created_at).toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
            tr.innerHTML = `
                <td class="px-4 py-3 text-[10px] font-black uppercase text-indigo-400">${item.action}</td>
                <td class="px-4 py-3 text-xs font-bold text-white truncate max-w-[8rem]">${escapeHtml(item.site_name)}</td>
                <td class="px-4 py-3 text-[10px] text-slate-400">${escapeHtml(item.diff_summary || '')}</td>
                <td class="px-4 py-3 text-[9px] text-slate-600 whitespace-nowrap">${when}</td>`;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML =
            '<tr><td colspan="4" class="px-4 py-6 text-center text-red-400 text-xs">Gagal memuat.</td></tr>';
    }
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

async function clearServerHistory() {
    if (!confirm('Yakin hapus SEMUA riwayat server? Ini nggak bisa di-undo, bestie.')) return;
    try {
        const res = await fetch(`${API_BASE}/api/history`, { method: 'DELETE', headers: getHeaders() });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        toastAdmin(`Riwayat dikosongin (${d.deleted || 0} baris).`);
        loadServerHistoryTable();
        loadStats();
    } catch (e) {
        toastAdmin('Gagal: ' + e.message);
    }
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
    try {
        const res = await fetch(`${API_BASE}/api/sites`);
        const data = await res.json();
        categories = {};
        sitesData = data.sites;
        sitesData.forEach((site) => {
            categories[site.id] = {
                id: site.id,
                name: site.name,
                links: site.links.split(/\r?\n/).map((l) => l.trim()).filter((l) => l)
            };
        });
        render();
    } catch (err) {
        toastAdmin('Gagal muat data situs.');
    }
}

function render() {
    const container = document.getElementById('listDisplay');
    container.innerHTML = '';
    if (sitesData.length === 0) {
        container.innerHTML =
            '<p class="text-sm text-slate-500 italic p-8 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/40">Belum ada kategori. Isi form di atas.</p>';
        return;
    }

    sitesData.forEach((site, idx) => {
        const data = categories[site.id];
        const htmlName = data.name.replace(/^Kategori\s+/i, '').trim();
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
                <p class="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Kategori</p>
                <h3 class="font-black text-sm text-white truncate uppercase tracking-tight">${escapeHtml(htmlName)}</h3>
                <p class="text-[10px] text-emerald-400/90 font-bold mt-1">${data.links.length} link</p>
            </div>
            <div class="flex flex-col justify-center gap-2 shrink-0">
                <button type="button" onclick="editSite('${data.id}')" class="text-[9px] bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 px-3 py-2 rounded-xl font-black uppercase tracking-wider">Edit</button>
                <button type="button" onclick="deleteSite('${data.id}')" class="text-[9px] text-red-400/90 hover:text-red-300 font-black uppercase px-1">Hapus</button>
            </div>`;
        container.appendChild(row);
    });
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

    if (!name || !rawLinks) return toastAdmin('Nama & link wajib diisi, ya.');

    const linksArr = rawLinks
        .split(/\r?\n/)
        .map((line) => {
            let l = line.trim();
            if (!l) return null;
            if (!l.startsWith('http://') && !l.startsWith('https://')) l = 'https://' + l;
            return l;
        })
        .filter((l) => l !== null);

    if (linksArr.length === 0) return toastAdmin('Minimal satu link valid.');

    btn.disabled = true;
    btn.innerText = 'Menyimpan…';

    try {
        if (editingSiteId) {
            const res = await fetch(`${API_BASE}/api/sites/${editingSiteId}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ name, links: linksArr.join('\n') })
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            cancelEdit();
        } else {
            const res = await fetch(`${API_BASE}/api/sites`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ name, links: linksArr.join('\n') })
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            document.getElementById('siteNameInput').value = '';
            document.getElementById('siteLinksInput').value = '';
        }
        toastAdmin('Tersimpan.');
        loadSites();
        loadStats();
    } catch (err) {
        toastAdmin('Error: ' + err.message);
        if (String(err.message).includes('Password') || String(err.message).includes('Ditolak')) {
            sessionStorage.removeItem('__admin_pass');
            window.location.reload();
        }
    } finally {
        btn.disabled = false;
        if (editingSiteId) {
            btn.innerText = 'Update skema';
        } else {
            btn.innerText = 'Simpan ke server';
            btn.className =
                'w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition-colors shadow-lg active:scale-95 shadow-indigo-900/40';
        }
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
    if (editingSiteId) return toastAdmin('Batalkan mode edit dulu.');
    if (!confirm('Hapus kategori ini permanen? Progress device ikut kehapus.')) return;
    try {
        const res = await fetch(`${API_BASE}/api/sites/${siteId}`, { method: 'DELETE', headers: getHeaders() });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        toastAdmin('Terhapus.');
        loadSites();
        loadStats();
    } catch (err) {
        toastAdmin(err.message);
    }
}
