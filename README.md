# 🚀 LinkFlow | Test Link Tracker

[![Version](https://img.shields.io/badge/version-0.8.442106-indigo.svg?style=for-the-badge)](CHANGELOG.md)
[![Status](https://img.shields.io/badge/status-verified-emerald.svg?style=for-the-badge)]()
[![PWA](https://img.shields.io/badge/PWA-ready-orange.svg?style=for-the-badge)]()

LinkFlow adalah platform pengujian tautan (link tracker) modern yang dirancang untuk presisi tinggi, otomatisasi cerdas, dan pengalaman pengguna premium. Dibangun dengan fokus pada kecepatan eksekusi, monitoring koneksi ISP yang akurat, dan manajemen antrean massal.

---

## ✨ Fitur Unggulan

- **Dual-Mode Runner**: 
    - **Mode Fokus Tab**: Membuka link di tab baru dan menunggu Anda kembali untuk validasi manual (Normal/Blokir/Error).
    - **Mode Jeda Otomatis**: Berjalan secara mandiri dengan interval waktu presisi (detik.milidetik) tanpa perlu perpindahan fokus manual.
- **Smart Ping Terminal**: Pendeteksian status HTTP link secara massal sebelum eksekusi manual, lengkap dengan fitur auto-skip untuk link yang terdeteksi blokir atau error.
- **Deteksi Koneksi & DNS**: Verifikasi otomatis terhadap ISP (Telkomsel, XL, Indosat) dan status DNS (Auto/Private) untuk memastikan hasil pengujian blokir yang valid.
- **PWA Ready**: Dukungan Progressive Web App untuk pemasangan langsung di desktop atau mobile, lengkap dengan *Push Badges* untuk notifikasi riwayat baru.
- **History & Diff Engine**: Pelacakan setiap perubahan data (tambah/hapus/edit) dengan pagination dan pembersihan otomatis data lama (>7 hari).
- **Floating Tool Sheet**: Navigasi modern menggunakan FAB (Floating Action Button) untuk akses cepat ke Speedtest, Riwayat, dan Koneksi dalam satu panel elegan.

---

## 🛠️ Stack Teknologi

- **Frontend**: Vanilla Javascript (ES6+), Tailwind CSS (Layouting), HTML5 Semantic.
- **Styling**: Custom Vanilla CSS dengan arsitektur Glassmorphism & High-Contrast Dark Mode.
- **Visualisasi**: [Chart.js](https://www.chartjs.org/) untuk grafik performa Speedtest.
- **Backend/Database**: Node.js & SQLite (untuk efisiensi memori dan persistensi data).
- **API**: Terintegrasi dengan `ipapi.co` (ISP) dan `ip-api.com` (DNS Resolver).

---

## 🏎️ Memulai (Localhost)

1. **Instalasi**:
   ```bash
   npm install
   ```
2. **Menjalankan Server**:
   ```bash
   npm start
   ```
3. **Akses**:
   - Dashboard: `http://localhost:3000`
   - Admin Panel: `http://localhost:3000/admin.html` (Password: `rahasia123`)

---

## Akses Publik (Cloudflare Tunnel)

Gunakan skrip pembantu `BukaTunnel.bat` untuk mengonlinekan server lokal Anda secara instan menggunakan Cloudflare Tunnel:

1. Pastikan `cloudflared` terinstal di komputer.
2. Jalankan `BukaTunnel.bat`.
3. Bagikan URL `trycloudflare.com` yang dihasilkan ke rekan kerja Anda.

---

## Lisensi

- **Desain & Pengembangan**: IDR-AH-B组 Artupski.
- **Font**: [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) oleh Google Fonts.