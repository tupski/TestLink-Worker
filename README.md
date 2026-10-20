# 🚀 LinkFlow | Test Link Tracker

[![Version](https://img.shields.io/badge/version-0.9.220426-indigo.svg?style=for-the-badge)](CHANGELOG.md)
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
- **Panel Admin**: Kelola situs (tambah, edit, hapus, urutkan, aktif/nonaktif), statistik, dan pengaturan aplikasi (judul, tagline, interval default, halaman Tentang, Google Safe Browsing).
- **Mode Perawatan**: Aktifkan pesan pemeliharaan dari panel admin tanpa mengubah kode.
- **Deteksi Blokir Server-Side**: Endpoint `/api/check-block` mengikuti redirect dan membaca isi halaman untuk mengenali halaman blokir ISP/Kominfo, opsional diperkuat Google Safe Browsing.

---

## Stack

- **Frontend**: Vanilla Javascript (ES6+), Tailwind CSS (build via CLI), HTML5 Semantic.
- **Komponen UI**: [Preline UI](https://preline.co) (free), plugin vanilla berbasis data-attribute.
- **Styling**: Design system sendiri di `css/styles.css` (token warna/spasi/radius, komponen `.btn/.card/.input/.badge/.table`). Lihat `docs/DESIGN_SYSTEM.md`.
- **Visualisasi**: [Chart.js](https://www.chartjs.org/) untuk grafik performa Speedtest.
- **Backend/Database**: Node.js (Express 5) & SQLite via `sqlite3` (untuk efisiensi memori dan persistensi data).
- **API**: Terintegrasi dengan `ipapi.co` (ISP), `ip-api.com` (DNS Resolver), dan Google Safe Browsing (opsional, API key diisi dari panel admin).

> Catatan: Tailwind di-build ke `css/tailwind-built.css` (`npm run build:css`). Jalankan ulang setiap kali class Tailwind baru muncul di HTML/JS.

---

## Konfigurasi

Salin `.env.example` menjadi `.env` lalu isi:

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Ya (produksi) | Sandi panel admin. Jika kosong, endpoint admin balas 503. |
| `ALLOWED_ORIGINS` | Tidak | Daftar origin CORS tambahan, dipisah koma. |
| `PORT` | Tidak | Port server lokal (default `3000`). |

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

## Pengujian & QA

```bash
npm test      # Unit test (node:test): js/utils.js & js/dialog.js
npm run qa    # QA statis: referensi ID, handler onclick, kontras WCAG
```

---

## Akses Publik (Cloudflare Tunnel)

Gunakan skrip pembantu `BukaTunnel.bat` untuk mengonlinekan server lokal Anda secara instan menggunakan Cloudflare Tunnel:

1. Pastikan `cloudflared` terinstal di komputer.
2. Jalankan `BukaTunnel.bat`.
3. Bagikan URL `trycloudflare.com` yang dihasilkan ke rekan kerja Anda.

---

## Deploy

### Vercel

`api/index.js` adalah entry point serverless (lihat `vercel.json`, semua traffic diarahkan ke fungsi ini). Catatan penting: di Vercel, SQLite ditulis ke `/tmp` sehingga data hilang saat restart atau cold start. Pakai untuk uji coba atau demo; untuk data yang menetap, jalankan server Node di VPS/mesin sendiri (folder `data/`).

### Cloudflare Worker (domain tetap)

Folder `cloudflare/` berisi reverse proxy ke backend Vercel untuk pemakaian domain sendiri:

1. Set URL backend sebagai secret (sekali saja):
   ```bash
   cd cloudflare
   npx wrangler secret put BACKEND_URL
   ```
   Isi dengan URL backend tanpa slash di akhir, mis. `https://testlink-xxxxx.vercel.app`.
2. Deploy worker:
   ```bash
   npm run deploy:cf
   ```
3. Atur rute domain di dashboard Cloudflare: Workers & Pages → worker → Triggers → Routes.

### Cek runtime setelah deploy

`api/index.js` berubah tapi proses Node di server belum restart adalah penyebab umum endpoint baru balas 404. Cek dari luar:

```bash
npm run check:deploy -- https://domain-anda
```

`/api/backup` 404 = build lama (pull + restart proses), 403/503 = route sudah ada dan hanya butuh `x-admin-password`.

---

## Struktur Proyek

```
api/index.js     Server Express: API, serve statis, SQLite
index.html       Halaman utama (runner)
admin.html       Panel admin
about.html       Tentang & changelog
js/              app.js, admin.js, admin-links.js, dialog.js, pwa.js, utils.js
css/             styles.css (design system), tailwind.css -> tailwind-built.css
sw.js            Service worker (cache shell PWA)
cloudflare/      Worker reverse proxy (wrangler)
scripts/         qa-static.js, make_icons.py
test/          Unit test (node:test)
docs/            PRD, design system, audit, laporan QA
data/            Database SQLite lokal (gitignored)
```

---

## Dokumentasi

- `docs/PRD.md`: kebutuhan produk & alur utama.
- `docs/DESIGN_SYSTEM.md`: token warna, spasi, radius, dan komponen.
- `docs/PLAN.md`: rencana kerja per fase.
- `docs/QA_REPORT.md`: hasil pengujian.
- `docs/SECURITY_AUDIT.md` & `docs/ARCHITECTURE_AUDIT.md`: temuan audit keamanan & arsitektur.
- `CHANGELOG.md`: riwayat versi.

---

## Lisensi

- **Desain & Pengembangan**: Artupski
- **Font**: [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) oleh Google Fonts.