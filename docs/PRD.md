# PRD — TestLink Worker

Dokumen ringkas. Spesifikasi lengkap ada di `docs/Hermes Master Prompt — TestLink UI/UX Overhaul.md` (arahan pemilik); PRD ini tidak menduplikasi isinya, hanya merangkum konteks produk untuk program audit/remediasi 2026-10-09 (lihat `docs/PLAN.md`).

## 1. Masalah

Tim operator perlu mengetes daftar URL dalam jumlah banyak dan ingin kunjungan tercatat di history browser asli, bukan sekadar request jaringan. Pencatatan manual satu per satu lambat dan rawan terlewat; admin juga butuh cara mengelola antrean link tanpa menyentuh database langsung.

## 2. Solusi

Runner web (PWA) yang membuka setiap URL dengan `window.open` sehingga tercatat di history browser, dengan progres tersimpan per perangkat, plus panel admin untuk mengelola antrean, link, pengaturan, dan melihat riwayat perubahan.

## 3. Pengguna & Kebutuhan

| Peran | Kebutuhan utama |
|---|---|
| Worker/operator | Menjalankan antrean cepat (mode jeda otomatis) atau validasi manual (mode fokus tab); melihat progres dan sisa; melaporkan link yang diblokir; cek koneksi/ISP/DNS ringan |
| Admin | Login password; kelola antrean (CRUD, urutan, aktif/nonaktif) dan link (cari, filter, bulk, impor/ekspor TXT, duplikat); pengaturan aplikasi; riwayat perubahan |

## 4. Lingkup Existing (dipertahankan)

- **Worker** (`index.html` + `js/app.js`): verifikasi koneksi, antrean berkartu dengan progres per device, dua mode runner, ping/cek blokir (`/api/check-block`), laporan blokir, speedtest simulasi berlabel, dialog keluar.
- **Admin** (`admin.html` + `js/admin.js` + `js/admin-links.js`): 7 tab; Ringkas, Link Manager, Antrean, Pengaturan (4 sub-tab), Riwayat, Sistem, Tentang.
- **Backend** (`api/index.js`): Express 5 + SQLite; same-origin; di Vercel DB di `/tmp` (ephemeral); Cloudflare Worker sebagai reverse proxy opsional.
- **PWA**: manifest + icon lengkap, SW cache shell, banner update (`js/pwa.js`).

## 5. Batasan Tetap

- Vanilla JS, tanpa framework/bundler; tanpa dependensi runtime baru.
- `window.open(url)` satu-satunya navigasi nyata; tidak boleh diganti fetch/HEAD.
- Kontrak API existing dipertahankan (perubahan hanya aditif); skema DB tanpa migrasi.
- Sinkron progres per device; strategi SW cache shell; URL halaman publik tidak berubah.
- Bahasa UI Indonesia; teks UI tanpa em dash; arah desain `docs/DESIGN_SYSTEM.md`.
- Tidak ada fitur yang dihapus diam-diam.

## 6. Keputusan Produk (2026-10-09)

- **Speedtest tetap simulasi**: angka `Math.random()` 20-100 Mbps adalah diagnostik ilustratif, bukan pengukuran nyata. Label "Simulasi" sudah ada di modal ("Simulasi Data 50 MB") dan diperkuat (header, kartu hasil, anotasi grafik) pada Fase E tanpa mengubah logika.

## 7. Program Saat Ini (Fase A-I)

Audit arsitektur + keamanan menyeluruh, remediasi terarah, test regresi, dan dokumentasi. Fase, dependensi, risiko, dan acceptance criteria ada di `docs/PLAN.md`; temuan di `docs/ARCHITECTURE_AUDIT.md` dan `docs/SECURITY_AUDIT.md`.

## 8. Di Luar Lingkup

- Migrasi framework/bundler, perubahan skema DB, fitur baru di luar spesifikasi Hermes.
- Verifikasi perangkat nyata (install PWA, standalone, offline riil, jaringan seluler) dicatat sebagai batas lingkungan di `docs/QA_REPORT.md`, bukan kegagalan.
