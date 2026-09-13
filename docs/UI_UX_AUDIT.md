# UI/UX Audit — TestLink Worker

Tanggal audit: 2026-09-13. Branch: `v2`. Referensi spesifikasi: `docs/Hermes Master Prompt — TestLink UI/UX Overhaul.md`.

## 1. Arsitektur Saat Ini

```
TestLink Worker (vanilla JS, tanpa build step)
├── index.html          Worker/runner (Tailwind CDN + Plus Jakarta Sans + Chart.js CDN)
├── admin.html          Panel admin (tab: Ringkas/Kategori/Pengaturan/Riwayat/Tentang)
├── about.html          Halaman tentang + changelog (marked.js CDN)
├── 403/404/500.html    Halaman error statis
├── css/styles.css      Token CSS + komponen (site-card, topbar, footer, toast, FAB)
├── js/app.js           Logika runner, mode, ping, speedtest, history, koneksi (980 baris)
├── js/admin.js         Logika admin: auth, CRUD kategori, settings, history (544 baris)
├── js/countdown-worker.js  Web Worker countdown (saat ini TIDAK dipakai app.js)
├── sw.js               Service worker cache-first shell (CACHE 'testlink-v3')
├── manifest.webmanifest PWA manifest (icon SVG 512 saja)
├── api/index.js        Express 5 + sqlite3 (juga jadi Vercel serverless function)
├── server.js           3 baris (proxy ke api/index.js)
├── cloudflare/         Worker reverse proxy ke backend (BACKEND_URL)
├── vercel.json         Build + includeFiles, semua route ke api/index.js
└── data/database.sqlite  DB bundel (di-copy ke /tmp di Vercel)
```

- Frontend vanilla JS, tanpa framework, tanpa bundler. Tailwind lewat **cdn.tailwindcss.com** (JIT di browser).
- Backend satu file Express (`api/index.js`), SQLite. Di Vercel DB di `/tmp` (**ephemeral, data hilang saat restart**).
- Deployment: Vercel (serverless) dan/atau Cloudflare Worker sebagai reverse proxy.

## 2. Data Model

| Tabel | Kolom | Catatan |
|---|---|---|
| `sites` | id, name, links (TEXT, newline-separated), created_at, sort_order, is_active | "Kategori" = antrean link |
| `progress` | device_id, site_id, last_index, normal_count, error_count | Progres per perangkat |
| `history` | id, action (ADD/EDIT/DELETE), site_name, diff_summary, diff_details (JSON), created_at | Log perubahan admin, BUKAN history kunjungan |
| `kv_settings` | key, value | app_title, app_tagline, default_interval, maintenance_*, about_page_*, gsb_active, gsb_api_key |

Kompatibilitas: penamaan "sites/kategori" tetap di backend; UI v2 boleh menyebutnya "Queue/Antrean".

## 3. API Surface (dipertahankan)

- `POST /api/auth` (admin) — validasi password header
- `GET /api/settings` (publik; `gsb_api_key` disembunyikan tanpa header admin), `PUT /api/settings` (admin)
- `GET /api/admin/stats` (admin) — siteCount, linkCount, historyCount
- `GET /api/sites` (+`?deviceId=` untuk progres & filter is_active), `POST /api/sites` (admin), `PUT /api/sites/:id` (admin), `PUT /api/sites/order` (admin), `PUT /api/sites/:id/toggle` (admin), `DELETE /api/sites/:id` (admin)
- `POST /api/progress` — sinkron progres per device
- `GET /api/history` (50 terakhir), `GET /api/history/meta` (badge), `DELETE /api/history` (admin)
- `POST /api/check-block` — diagnostik server-side fetch + Google Safe Browsing (auxiliary, tidak menggantikan navigasi)

## 4. Alur Pengguna (Worker)

1. Load → `loadAppSettings()` → modal verifikasi koneksi (IP/ISP/DNS via ipapi.co + edns.ip-api.com).
2. Daftar antrean (site-card) dengan progres per device, tombol Lanjut/Reset.
3. Pilih antrean → dua fase: **Ping/cek otomatis** (`/api/check-block`, skip link gagal) → **runner**.
4. Runner dua mode:
   - **Fokus Tab** (`modeAuto=false`): `window.open(url)` tab baru, tunggu `visibilitychange` kembali; validasi manual opsional (Normal/Blokir/Error).
   - **Otomatis Jeda** (`modeAuto=true`): countdown deadline (`Date.now()` + interval, watch 200ms), buka link berikutnya di tab yang sama.
5. Link terdeteksi blokir (redirect halaman blokir / GSB) dilewati + masuk laporan.
6. Progres disinkron per aksi ke `POST /api/progress`.
7. `beforeunload` + `popstate` interceptor dengan modal konfirmasi keluar.

**Inti yang wajib dipertahankan**: `window.open(fullUrl)` = navigasi browser nyata → masuk history browser. Jangan pernah diganti fetch/HEAD.

## 5. Alur Admin

- Login: password via `X-Admin-Password` header, disimpan `sessionStorage`, modal password.
- Tab: Ringkas (stats), Kategori (CRUD + urutan + toggle aktif + upload TXT), Pengaturan (branding, interval default, maintenance, GSB), Riwayat (tabel 50 entri, clear), Tentang (edit about page).

## 6. PWA Saat Ini

- `sw.js` cache-first untuk shell (bukan `/api`), skipWaiting + clients.claim. Tidak ada mekanisme notifikasi update ke user.
- `manifest.webmanifest`: icon hanya SVG 512 (beberapa browser butuh PNG 192/512 + maskable untuk install prompt andal).
- `about.html` merujuk `/apple-touch-icon.png` yang **tidak ada**.
- `countdown-worker.js` didaftarkan di SW ASSETS tapi tidak pernah di-instansiasi app.js (dead asset).
- Theme color indigo `#6366f1`, standalone display, bahasa `id`.

## 7. Masalah UI/UX

- **Slop visual** (sesuai filter antislop): dark-only tanpa alasan kuat, glassmorphism (backdrop-blur topbar + semua modal), radius ekstrem (`rounded-[2.5rem]`, `[3rem]`), gradient/glow background, border-glow animation, italic + uppercase + `font-black` di hampir semua teks, ukuran teks mikro (`text-[7px]`–`text-[10px]`), glow pada progress bar.
- **Typografi tidak konsisten dan sulit dibaca**; label uppercase dengan tracking lebar di mana-mana.
- **Runner**: state tidak eksplisit (tidak ada tampilan Idle/Running/Paused/Completed yang jelas); status hanya di topbar kecil. Tidak ada tampilan "PAUSED".
- **Modal & dialog**: pakai `alert()`/`confirm()` native (selesai, reset progres, hapus), tidak konsisten dengan modal custom.
- **Aksesibilitas**: fokus minimal (`peer-focus:outline-none`), modal tanpa focus trap/aria, kontras rendah (teks `text-slate-600` 8px), status kadang hanya warna.
- **Empty/loading/error state** sebagian ada (site list kosong, error) tapi tidak seragam.
- **XSS**: `app.js` menyuntik `data.name`, `diff_summary`, dan URL blokir ke `innerHTML` tanpa escape (admin.js sudah pakai `escapeHtml`). Sumber data admin-controlled, risiko sedang, tapi harus diperbaiki.
- **Speedtest memalsukan data** (`Math.random()` 20–100 Mbps) — menampilkan angka tanpa sumber nyata. Harus jadi data nyata atau dihapus/label simulasi jujur.
- **Link manager primitif**: textarea saja; tidak ada search/pagination/duplikat/bulk.
- Kode duplikat: string className tombol dibangun ulang di JS (admin.js `saveBtn`, `PING_BADGE_*`), badge class, dsb.

## 8. Keamanan

- `ADMIN_PASSWORD` fallback hardcoded `'rahasia123'` (api/index.js:259) — **kredensial default produksi tidak aman**, melanggar spesifikasi §24.
- Auth = static password header per request, tanpa session/rate-limit/brute-force protection; password tersimpan plaintext di `sessionStorage`.
- `GET /api/settings` membandingkan password untuk menyembunyikan `gsb_api_key` — pola ok, tapi tetap header-based.
- CORS `app.use(cors())` tanpa whitelist.
- Input: `default_interval` dan panjang string sudah dibatasi server; URL dicek formatnya.

## 9. Arsitektur yang Direkomendasikan

- Tetap vanilla JS + Tailwind (tanpa framework), tambah **Preline UI (free)** untuk komponen interaktif.
- Pindah dari Tailwind CDN ke Tailwind CLI/build jika memungkinkan (produksi), atau minimal sadar akan batasannya.
- Pecah `app.js` per area (runner, sites, history, connection, speedtest) mengikuti struktur `js/` di spesifikasi §22 — adaptif, tanpa bundler (ES modules atau file terpisah per halaman).
- Komponen bersama (modal, toast, empty state) satu sumber, dipakai worker + admin.

## 10. Yang TIDAK Boleh Diubah

- Mekanisme navigasi nyata (`window.open`) dan sinkronisasi progres per device.
- Kontrak API existing (kecuali penambahan untuk kebutuhan UI).
- Skema DB existing (tanpa migrasi yang tidak perlu).
- Perilaku SW cache shell + versi cache (hanya bump versi bila aset berubah).
- Bahasa antarmuka: Indonesia.
- Fitur deteksi ISP/DNS tetap ada, ringan, non-blocking; kegagalan tidak boleh menghentikan runner.
