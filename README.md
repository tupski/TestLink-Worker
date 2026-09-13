# 🚀 LinkFlow | Test Link Tracker

[![Version](https://img.shields.io/badge/version-0.8.442106-indigo.svg?style=for-the-badge)](CHANGELOG.md)
[![Status](https://img.shields.io/badge/status-verified-emerald.svg?style=for-the-badge)]()
[![PWA](https://img.shields.io/badge/PWA-ready-orange.svg?style=for-the-badge)]()

TestLink Worker adalah platform test link (link tracker) modern yang dirancang untuk presisi tinggi, otomatisasi cerdas, dan premium user experience. Dibangun dengan fokus pada kecepatan eksekusi, monitoring koneksi ISP yang akurat, dan manajemen antrean massal.

---

## Fitur

- **Dual-Mode Runner**: 
    - **Mode Fokus Tab**: Membuka link di tab baru dan menunggu Anda kembali untuk validasi manual (Normal/Blokir/Error).
    - **Mode Jeda Otomatis**: Berjalan secara mandiri dengan interval waktu presisi (detik.milidetik) tanpa perlu perpindahan fokus manual.
- **Smart Ping Terminal**: Pendeteksian status HTTP link secara massal sebelum eksekusi manual, lengkap dengan fitur auto-skip untuk link yang terdeteksi blokir atau error.
- **Deteksi Koneksi & DNS**: Verifikasi otomatis terhadap ISP (Telkomsel, XL, Indosat) dan status DNS (Auto/Private) untuk memastikan hasil pengujian blokir yang valid.
- **PWA Ready**: Dukungan Progressive Web App untuk pemasangan langsung di desktop atau mobile, lengkap dengan *Push Badges* untuk notifikasi riwayat baru.
- **History & Diff Engine**: Pelacakan setiap perubahan data (tambah/hapus/edit) dengan pagination dan pembersihan otomatis data lama (>7 hari).
- **Floating Tool Sheet**: Navigasi modern menggunakan FAB (Floating Action Button) untuk akses cepat ke Speedtest, Riwayat, dan Koneksi dalam satu panel elegan.

---

## Stack

- **Frontend**: Vanilla Javascript (ES6+), Tailwind CSS (build via CLI), HTML5 Semantic.
- **Komponen UI**: [Preline UI](https://preline.co) (free) — plugin vanilla berbasis data-attribute.
- **Styling**: Design system sendiri di `css/styles.css` (token warna/spasi/radius, komponen `.btn/.card/.input/.badge/.table`). Lihat `docs/DESIGN_SYSTEM.md`.
- **Visualisasi**: [Chart.js](https://www.chartjs.org/) untuk grafik performa Speedtest.
- **Backend/Database**: Node.js & SQLite (untuk efisiensi memori dan persistensi data).
- **API**: Terintegrasi dengan `ipapi.co` (ISP) dan `ip-api.com` (DNS Resolver).

> Catatan: Tailwind di-build ke `css/tailwind-built.css` (`npm run build:css`). Jalankan ulang setiap kali class Tailwind baru muncul di HTML/JS.

---

## Konfigurasi

Salin `.env.example` menjadi `.env` lalu isi:

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Ya (produksi) | Sandi panel admin. Jika kosong, endpoint admin balas 503. |
| `ALLOWED_ORIGINS` | Tidak | Daftar origin CORS tambahan, dipisah koma. |

Sandi dev `rahasia123` hanya berlaku di localhost saat `ADMIN_PASSWORD` kosong dan bukan environment produksi.

---

## Memulai (Localhost)

1. **Instalasi**:
   ```bash
   npm install
   ```
2. **Build CSS** (sekali, dan setiap ada class Tailwind baru):
   ```bash
   npm run build:css
   ```
3. **Menjalankan Server**:
   ```bash
   npm start
   ```
4. **Akses**:
   - Worker: `http://localhost:3000`
   - Admin Panel: `http://localhost:3000/admin.html` (sandi: nilai `ADMIN_PASSWORD`, atau `rahasia123` saat dev lokal)
   - Tentang: `http://localhost:3000/about.html`

---

## Akses Publik (Cloudflare Tunnel)

Gunakan skrip pembantu `BukaTunnel.bat` untuk mengonlinekan server lokal Anda secara instan menggunakan Cloudflare Tunnel:

1. Pastikan `cloudflared` terinstal di komputer.
2. Jalankan `BukaTunnel.bat`.
3. Bagikan URL `trycloudflare.com` yang dihasilkan ke rekan kerja Anda.

---

## Lisensi

- **Desain & Pengembangan**: Artupski
- **Font**: [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) oleh Google Fonts.