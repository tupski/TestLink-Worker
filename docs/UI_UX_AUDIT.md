# UI/UX Audit — TestLink Worker

Tanggal audit: 2026-09-13. Diperbarui: 2026-10-09 (Fase A). Branch: `v2`. Referensi spesifikasi: `docs/Hermes Master Prompt — TestLink UI/UX Overhaul.md`.

## 1. Arsitektur Saat Ini

```
TestLink Worker (vanilla JS, Tailwind CLI build, tanpa bundler)
├── index.html          Worker/runner (tailwind-built.css + styles.css + Preline + Chart.js CDN)
├── admin.html          Panel admin (7 tab: Ringkas/Link Manager/Antrean/Pengaturan/Riwayat/Sistem/Tentang)
├── about.html          Halaman tentang + changelog (marked.js CDN)
├── 403/404/500.html    Halaman error statis (dead code, tidak dirujuk server)
├── css/tailwind.css    Sumber Tailwind CLI (hanya @tailwind)
├── css/tailwind-built.css  Hasil build Tailwind CLI (npm run build:css)
├── css/styles.css      Token CSS + komponen (site-card, topbar, footer, toast, FAB, .btn, .input)
├── js/app.js           Logika runner, mode, ping, speedtest, history, koneksi (1117 baris)
├── js/admin.js         Logika admin: auth, CRUD kategori, settings, history (620 baris)
├── js/admin-links.js   Link Manager: editor daftar link per antrean (365 baris)
├── js/pwa.js           Banner update PWA (SKIP_WAITING/APP_UPDATED)
├── sw.js               Service worker cache-first shell (CACHE 'testlink-v10'; /api dikecualikan)
├── manifest.webmanifest PWA manifest (icon SVG + PNG 192/512 + maskable, shortcuts)
├── api/index.js        Express 5 + sqlite3 (juga jadi Vercel serverless function, 717 baris)
├── server.js           Proxy dev lokal ke api/index.js
├── cloudflare/         Worker reverse proxy ke backend (BACKEND_URL)
├── vercel.json         Build + includeFiles, semua route ke api/index.js
└── data/database.sqlite  DB bundel (di-copy ke /tmp di Vercel)
```

- Frontend vanilla JS, tanpa framework, tanpa bundler. Tailwind via **Tailwind CLI build** (`npm run build:css`), bukan CDN lagi.
- Catatan Fase A: `admin.html` belum memuat `/css/styles.css` padahal memakai kelas komponennya (`.btn`, `.input`, `.label`, `.admin-nav-item`, `.settings-tab`) — temuan A-01 di `docs/ARCHITECTURE_AUDIT.md`, dipetakan ke perbaikan B1.
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

## 5. Alur Admin (diperbarui 2026-10-09)

- Login: password via `X-Admin-Password` header, disimpan `sessionStorage`, modal password.
- Tab (7): Ringkas (stats), Link Manager (cari/filter/pilih/bulk, ekspor-impor TXT, deteksi duplikat per antrean), Antrean (tambah/edit + import TXT multi-kategori + atur urutan tampil), Pengaturan (sub-tab Umum/Runner/Pemeliharaan/Keamanan), Riwayat (tabel + clear), Sistem, Tentang (edit about page).
- Catatan Fase A: `admin.html` tidak memuat `styles.css` padahal memakai `.btn`/`.input`/`.label`/`.card` dkk (temuan A-01 → perbaikan B1); state tabel belum seragam (Antrean tanpa loading, Link Manager tanpa error, Riwayat slice 40 baris) → Fase E.

## 6. PWA Saat Ini (diperbarui 2026-10-09)

- `sw.js` cache-first untuk shell (bukan `/api`), skipWaiting + clients.claim; CACHE `testlink-v10`.
- Banner update PWA tersedia di `js/pwa.js` (SKIP_WAITING/APP_UPDATED) — notifikasi update ke user sudah ada.
- `manifest.webmanifest`: icon lengkap (SVG, PNG 192/512, maskable 512) + shortcuts. Gap tersisa: `icons/icon-maskable-512.png` ada tetapi **tidak ikut precache SW** (dipetakan ke Fase G).
- `/apple-touch-icon.png` kini ada dan dirujuk `index.html`, `about.html`, `admin.html` (masuk SW ASSETS).
- `js/countdown-worker.js` sudah tidak ada di repo; referensi usang hanya tersisa di dokumen lama (dibersihkan di Fase A ini).
- Install prompt, mode standalone, dan offline perangkat nyata **tidak dapat diverifikasi dari lingkungan pengembangan** — dicatat sebagai batas verifikasi (Fase G/H, `docs/QA_REPORT.md`).
- Theme color indigo `#6366f1`, standalone display, bahasa `id`.

## 7. Masalah UI/UX (status 2026-10-09)

Status tiap temuan setelah overhaul fase 1-10; bukti teknis di `docs/ARCHITECTURE_AUDIT.md` dan `docs/SECURITY_AUDIT.md`.

**Sudah diperbaiki (fase 1-10, diverifikasi grep 2026-10-09):**

- Gradient halaman, border-glow, dan animasi dekoratif: 0 kemunculan di `index.html`.
- Panel modal tidak lagi kaca: kini solid `bg-slate-900` + border. Sisa blur: topbar `.app-topbar` (diizinkan `DESIGN_SYSTEM.md`, maks 1-2 elemen) dan scrim overlay modal.
- Runner punya state eksplisit: peta `RUNNER_BADGE` (Pengecekan/Siap/Berjalan/Jeda/Menunggu tab/Validasi/Selesai) + teks `focusStatus` (`js/app.js:311-317, 371-397`).
- Link Manager bukan textarea primitif lagi: cari, filter antrean, bulk action, impor TXT, deteksi duplikat (`js/admin-links.js`).
- Apple-touch-icon tersedia; `countdown-worker.js` sudah tidak ada di repo (lihat bagian 6).

**Belum selesai (dipetakan ke fase berikut):**

- **Dialog native**: 5 `confirm()` + 1 fallback `alert()` tersisa (app.js:1108; admin.js:325, 609; admin-links.js:141, 297; alert admin.js:139) → Fase D.
- **XSS**: sink `innerHTML` tanpa escape efektif; `escapeHtml` app.js:13-21 rusak (no-op); href admin-links.js tanpa validasi skema → Fase B/C; bukti di `SECURITY_AUDIT.md` S-03.
- **Aksesibilitas**: modal lama tanpa focus trap/aria penuh; sebagian status warna-saja; audit tap target 44px → Fase D + gate antislop-human Fase E.
- **State data admin tidak seragam**: Antrean tanpa loading state, Link Manager tanpa error state, Riwayat terpotong 40 baris tanpa pagination → Fase E.
- **Speedtest tetap simulasi (keputusan pemilik, 2026-10-09)**: angka `Math.random()` 20-100 Mbps dipertahankan sebagai diagnostik ilustratif, bukan pengukuran nyata; Fase E memperkuat label "Simulasi" di header modal, kartu hasil, dan anotasi grafik.
- **Sisa pelanggaran `DESIGN_SYSTEM.md`**, terkonsentrasi di modal lama (Verifikasi Koneksi, Pengetesan Kecepatan, dialog keluar, area ping): teks 7-10px masih 35 kemunculan + 11px 6 kemunculan; `italic` 7×; `font-black` 32×; `uppercase` 29×; radius modal `[2.5rem]`/`[3rem]` 4×; glow progress bar 2×. Kandidat sapu bersih di Fase E (keputusan saat gate antislop; modal speedtest toh disentuh Fase E untuk label).
- **Duplikasi kode**: 3-4 implementasi escape, string className tombol/badge dibangun ulang → `ARCHITECTURE_AUDIT.md` A-02; konsolidasi Fase B.

## 8. Keamanan (status 2026-10-09)

Audit lengkap dengan severity, bukti file:line, remediasi, dan rencana retest ada di **`docs/SECURITY_AUDIT.md`** (S-01 s.d. S-12). Ringkasan status:

**Sudah diperbaiki (fase 1-10):**

- Fallback `'rahasia123'` tidak aktif di produksi: hanya saat dev tanpa env, non-Vercel, dan request dari localhost (`api/index.js:287-288, 322, 335`; verifikasi S-10).
- Rate limit auth per IP sudah ada: 20 percobaan / 15 menit (`api/index.js:291-303`). Catatan: masih menghitung request sukses juga → S-05, diperbaiki Fase F.
- CORS bukan lagi `cors()` polos: whitelist `ALLOWED_ORIGINS` + same-origin (`api/index.js:15-32`). Cabang `host` vs origin masih mati (baris 26-27) → S-07, Fase F.

**Belum selesai (dipetakan ke fase berikut):**

- **SSRF** `POST /api/check-block` (`api/index.js:464-493`): fetch server-side `redirect: follow` tanpa blokir IP privat (helper `resolveUrlWithRedirects`, `api/index.js:144-179`) → S-01, Fase F.
- **Exposure statis**: `express.static(ROOT)` (`api/index.js:697`) menyajikan `data/database.sqlite` → S-02, Fase F (deny `data/` + `*.sqlite`; `link.txt` tetap publik, didokumentasikan).
- **XSS tersimpan**: sink `innerHTML` tanpa escape efektif + `escapeHtml` rusak → S-03, Fase B/C.
- **Validasi input** minim: POST/PUT `/api/sites`, `/api/sites/order`, `/api/progress`; interval tanpa batas atas → S-04, Fase F (aditif, error 400 JSON).
- **Perbandingan password non-timing-safe** (`reqPass === ADMIN_PASSWORD`, `api/index.js:362`) → S-06, Fase F.
- **Header keamanan HTTP** (CSP, Referrer-Policy, dll.) belum ada → S-12, Fase F.
- **Risiko residual terdokumentasi**: password admin plaintext di `sessionStorage` (S-09), rate limit in-memory per instance, `link.txt` publik.

## 9. Arsitektur (realisasi per 2026-10-09)

Rekomendasi lama vs realisasi; usulan lanjutan lengkap di `docs/ARCHITECTURE_AUDIT.md`:

- Vanilla JS + Tailwind tanpa framework: dipertahankan; Preline UI (free) sudah dipakai untuk komponen interaktif.
- Tailwind CDN → **Tailwind CLI build**: selesai (`npm run build:css` → `css/tailwind-built.css`).
- Pemecahan `app.js` (1117 baris) per tanggung jawab: belum dilakukan; kondisional Fase B2 dengan classic script agar fungsi global untuk `onclick` HTML tetap utuh. Jika risiko lebih besar dari manfaat, dicatat sebagai follow-up tanpa dipaksa.
- Komponen bersama satu sumber: escape dikonsolidasikan di Fase B1; dialog konfirmasi bersama di Fase D; toast sudah satu sistem untuk worker + admin.
- Struktur folder usulan + rencana migrasi bertahap: lihat `ARCHITECTURE_AUDIT.md` (kondisional; wajib cek script tag, sw.js ASSETS, vercel.json, cloudflare sebelum pindah/rename).

## 10. Yang TIDAK Boleh Diubah

- Mekanisme navigasi nyata (`window.open`) dan sinkronisasi progres per device.
- Kontrak API existing (kecuali penambahan untuk kebutuhan UI).
- Skema DB existing (tanpa migrasi yang tidak perlu).
- Perilaku SW cache shell + versi cache (hanya bump versi bila aset berubah).
- Bahasa antarmuka: Indonesia.
- Fitur deteksi ISP/DNS tetap ada, ringan, non-blocking; kegagalan tidak boleh menghentikan runner.
