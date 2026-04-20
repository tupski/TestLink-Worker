/**
 * Sites Component - Manajemen daftar situs
 */
const { adminAPIService } = require('../services/api');
const { 
    formatSiteName, 
    formatLinkCount, 
    escapeHtml 
} = require('../utils/formatters');

class SitesComponent {
    constructor() {
        this.categories = {};
        this.sitesData = [];
        this.editingSiteId = null;
    }

    /**
     * Load sites data
     */
    async loadSites() {
        try {
            const data = await adminAPIService.getSites();
            this.categories = {};
            this.sitesData = data.sites;
            
            this.sitesData.forEach(site => {
                this.categories[site.id] = {
                    id: site.id,
                    name: site.name,
                    is_active: site.is_active !== 0,
                    links: site.links.split(/\r?\n/).map((l) => l.trim()).filter((l) => l)
                };
            });
            
            this.render();
        } catch (err) {
            this.showToast('Gagal memuat data situs.');
        }
    }

    /**
     * Render sites list
     */
    render() {
        const container = document.getElementById('listDisplay');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.sitesData.length === 0) {
            container.innerHTML =
                '<p class="text-sm text-slate-500 italic p-8 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/40">Belum ada kategori. Isi form di atas.</p>';
            return;
        }

        // Sort sites: unfinished first, then by original order
        const sortedSites = [...this.sitesData].sort((a, b) => {
            const da = this.categories[a.id];
            const db = this.categories[b.id];
            const aFin = da.lastIndex >= da.links.length && da.links.length > 0;
            const bFin = db.lastIndex >= db.links.length && db.links.length > 0;
            if (aFin && !bFin) return 1;
            if (!aFin && bFin) return -1;
            return 0;
        });

        sortedSites.forEach((site, idx) => {
            const data = this.categories[site.id];
            const htmlName = formatSiteName(data.name);
            const activeText = data.is_active ? 'ON' : 'OFF';
            const activeClass = data.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400';
            
            const upBtn = idx === 0
                ? '<div class="w-8 h-8"></div>'
                : `<button type="button" onclick="adminSitesComponent.moveUp(${idx})" class="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center text-xs font-black transition-colors">▲</button>`;
            
            const downBtn = idx === this.sitesData.length - 1
                ? '<div class="w-8 h-8"></div>'
                : `<button type="button" onclick="adminSitesComponent.moveDown(${idx})" class="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center text-xs font-black transition-colors">▼</button>`;

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
                        <button onclick="adminSitesComponent.toggleActive('${data.id}', ${!data.is_active})" class="px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${activeClass}">${activeText}</button>
                    </div>
                    <h3 class="font-black text-sm ${data.is_active ? 'text-white' : 'text-slate-500'} truncate uppercase tracking-tight">${escapeHtml(htmlName)}</h3>
                    <p class="text-[10px] text-emerald-400/90 font-bold mt-1">${formatLinkCount(data.links.length)}</p>
                </div>
                <div class="flex flex-col justify-center gap-2 shrink-0">
                    <button type="button" onclick="adminSitesComponent.editSite('${data.id}')" class="text-[9px] bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 px-3 py-2 rounded-xl font-black uppercase tracking-wider">Edit</button>
                    <button type="button" onclick="adminSitesComponent.deleteSite('${data.id}')" class="text-[9px] text-red-400/90 hover:text-red-300 font-black uppercase px-1">Hapus</button>
                </div>`;
            container.appendChild(row);
        });
    }

    /**
     * Toggle site active status
     * @param {string} id - Site ID
     * @param {boolean} newState - New active status
     */
    async toggleActive(id, newState) {
        try {
            await adminAPIService.toggleSiteActive(id, newState);
            await this.loadSites();
        } catch (e) {
            this.showToast('Gagal merubah status.');
        }
    }

    /**
     * Move site up
     * @param {number} index - Current index
     */
    moveUp(index) {
        if (index === 0) return;
        const temp = this.sitesData[index];
        this.sitesData[index] = this.sitesData[index - 1];
        this.sitesData[index - 1] = temp;
        this.render();
        this.syncOrder();
    }

    /**
     * Move site down
     * @param {number} index - Current index
     */
    moveDown(index) {
        if (index === this.sitesData.length - 1) return;
        const temp = this.sitesData[index];
        this.sitesData[index] = this.sitesData[index + 1];
        this.sitesData[index + 1] = temp;
        this.render();
        this.syncOrder();
    }

    /**
     * Sync order to server
     */
    async syncOrder() {
        try {
            const orders = this.sitesData.map((s, i) => ({ id: s.id, order: i }));
            await adminAPIService.updateSitesOrder(orders);
        } catch (e) {
            this.showToast('Gagal simpan urutan.');
            await this.loadSites();
        }
    }

    /**
     * Edit site
     * @param {string} siteId - Site ID
     */
    editSite(siteId) {
        if (this.editingSiteId && this.editingSiteId !== siteId) {
            this.showToast('Selesaikan atau batalkan edit yang aktif dulu.');
            return;
        }
        
        const data = this.categories[siteId];
        this.editingSiteId = siteId;
        
        document.getElementById('siteNameInput').value = data.name;
        document.getElementById('siteLinksInput').value = data.links.join('\n');
        
        const btn = document.getElementById('saveBtn');
        btn.innerText = 'Update skema';
        btn.className =
            'w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition-colors shadow-lg active:scale-95';
        
        document.getElementById('cancelEditBtn').classList.remove('hidden');
        
        // Switch to sites tab
        this.showTab('sites');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * Delete site
     * @param {string} siteId - Site ID
     */
    async deleteSite(siteId) {
        if (this.editingSiteId) {
            this.showToast('Batalkan mode edit dulu.');
            return;
        }
        
        if (!confirm('Hapus kategori ini permanen? Progress device ikut kehapus.')) return;
        
        try {
            await adminAPIService.deleteSite(siteId);
            this.showToast('Terhapus.');
            await this.loadSites();
            await this.loadStats();
        } catch (err) {
            this.showToast(err.message);
        }
    }

    /**
     * Save site (create or update)
     */
    async saveSite() {
        const name = document.getElementById('siteNameInput').value.trim();
        const rawLinks = document.getElementById('siteLinksInput').value.trim();
        const btn = document.getElementById('saveBtn');

        if (!name || !rawLinks) {
            this.showToast('Nama & link wajib diisi, ya.');
            return;
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

        if (linksArr.length === 0) {
            this.showToast('Minimal satu link valid.');
            return;
        }

        btn.disabled = true;
        btn.innerText = 'Menyimpan…';

        try {
            if (this.editingSiteId) {
                await adminAPIService.updateSite(this.editingSiteId, name, linksArr.join('\n'));
                this.cancelEdit();
            } else {
                await adminAPIService.createSite(name, linksArr.join('\n'));
                document.getElementById('siteNameInput').value = '';
                document.getElementById('siteLinksInput').value = '';
            }
            
            this.showToast('Tersimpan.');
            await this.loadSites();
            await this.loadStats();
        } catch (err) {
            this.showToast('Error: ' + err.message);
            if (String(err.message).includes('Password') || String(err.message).includes('Ditolak')) {
                sessionStorage.removeItem('__admin_pass');
                window.location.reload();
            }
        } finally {
            btn.disabled = false;
            if (this.editingSiteId) {
                btn.innerText = 'Update skema';
            } else {
                btn.innerText = 'Simpan ke server';
                btn.className =
                    'w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition-colors shadow-lg active:scale-95 shadow-indigo-900/40';
            }
        }
    }

    /**
     * Cancel edit
     */
    cancelEdit() {
        this.editingSiteId = null;
        document.getElementById('siteNameInput').value = '';
        document.getElementById('siteLinksInput').value = '';
        document.getElementById('cancelEditBtn').classList.add('hidden');
        
        const btn = document.getElementById('saveBtn');
        btn.innerText = 'Simpan ke server';
        btn.className =
            'w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition-colors shadow-lg active:scale-95 shadow-indigo-900/40';
    }

    /**
     * Handle file upload
     * @param {File} file - File to upload
     */
    async handleFile(file) {
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
                        await adminAPIService.createSite(secName, links);
                        successCount++;
                    } catch (err) {
                        if (String(err.message).includes('reload')) return;
                    }
                }
            }
            
            this.showToast(`Upload selesai: ${successCount} kategori baru.`);
            file.value = '';
            await this.loadSites();
            await this.loadStats();
        };
        
        reader.readAsText(file);
    }

    /**
     * Show toast message
     * @param {string} message - Message to show
     */
    showToast(message) {
        const host = document.getElementById('toastHost');
        if (!host) return;
        
        const el = document.createElement('div');
        el.className = 'toast-item';
        el.textContent = message;
        host.appendChild(el);
        
        setTimeout(() => el.remove(), 3400);
    }

    /**
     * Switch to sites tab
     * @param {string} tabId - Tab ID
     */
    showTab(tabId) {
        // This would be implemented by the main admin.js
        // For now, we'll assume it's handled by the parent component
        console.log('Switch to tab:', tabId);
    }

    /**
     * Load stats (would be called from parent)
     */
    async loadStats() {
        // This would be implemented by the main admin.js
        console.log('Load stats called');
    }
}

// Global instance
const adminSitesComponent = new SitesComponent();

module.exports = {
    SitesComponent,
    adminSitesComponent
};