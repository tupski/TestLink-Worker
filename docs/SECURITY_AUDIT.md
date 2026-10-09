# SECURITY_AUDIT — TestLink Worker

Tanggal: 2026-10-09. Branch `v2` (HEAD `646c587`). Status: **DRAF Fase A** (temuan terverifikasi + rencana remediasi; remediasi dieksekusi di Fase F, retest di Fase H).

Metode: pembacaan kode langsung dengan nomor baris, smoke test server lokal (`node api/index.js`, port 3000), `npm audit --omit=dev`, dan verifikasi perilaku HTTP aktual. Prinsip: **tidak ada temuan yang diklaim sebagai bug tanpa bukti**; tingkat risiko mempertimbangkan konteks pemakaian (aplikasi internal, satu admin, auth berbasis header tanpa cookie).

## Ringkasan Temuan

| ID | Temuan | Risiko | Status | Remediasi |
|---|---|---|---|---|
| S-01 | SSRF di `POST /api/check-block` (publik, redirect otomatis, tanpa validasi IP) | Tinggi | Terverifikasi | Fase F |
| S-02 | `express.static(ROOT)` menyajikan kode sumber, docs, konfigurasi, dan DB | Tinggi | Terverifikasi | Fase F |
| S-03 | XSS tersimpan: `escapeHtml` rusak + sink tanpa escape (rantai ke kredensial admin) | Tinggi | Terverifikasi | Fase B/C |
| S-04 | Validasi input tidak ada di `POST/PUT /api/sites`, `/api/sites/order`, `POST /api/progress` | Sedang | Terverifikasi | Fase F |
| S-05 | Rate limit menghitung request sukses + in-memory per instance | Sedang | Terverifikasi | Fase F |
| S-06 | Perbandingan password non-timing-safe (`!==` / `===`) | Rendah | Terverifikasi | Fase F |
| S-07 | Cabang CORS mati (`origin.host` vs origin penuh) | Rendah | Terverifikasi | Fase F |
| S-08 | Pesan error internal bocor ke klien (500 `err.message`, check-block `note`) | Rendah | Terverifikasi | Fase F |
| S-09 | Password admin disimpan plaintext di `sessionStorage` | Sedang | Terverifikasi | Residual (dokumentasi) |
| S-10 | Fallback sandi dev `rahasia123` | Info | Gating terverifikasi baik | Residual (dokumentasi) |
| S-11 | 15 kerentanan dependensi (2 critical, 8 high per `npm audit`) | Tinggi | Terverifikasi | Fase F/G |
| S-12 | Header keamanan (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) tidak diset | Rendah | Terverifikasi | Fase F (opsional) |

## Temuan Detail

### S-01. SSRF di `POST /api/check-block` (Tinggi)

**Bukti:** Route publik tanpa auth (`api/index.js` 464-493). Fungsi `resolveUrlWithRedirects` (144-179) memanggil `fetch(startUrl, { redirect: 'follow' })` — mengikuti redirect otomatis tanpa memvalidasi tujuan; tidak ada resolusi DNS + blokir rentang privat, tidak ada validasi ulang per hop, hanya timeout 12 detik dan batas panjang URL 2048. Skema dipaksa http(s) dengan prefix, tetapi host tetap sembarang. Endpoint mengembalikan `status`, `finalUrl`, dan `note` (pesan error mentah). Smoke: endpoint publik merespons tanpa kredensial.
**Dampak:** penyerang mana pun dapat membuat server melakukan request ke jaringan internal/loopback/link-local (mis. metadata cloud `169.254.169.254`), memetakan port internal via status/waktu, atau memakai server sebagai proksi. Exfil isi respons dibatasi (hanya boolean penanda blokir), tetapi primitif request-nya nyata. Catatan: `checkWithGSB` juga dipanggil untuk target yang unreachable (kondisi `if (out.ok || !out.ok)` selalu true).
**Mitigasi (rencana F):** ganti fetch dengan `node:http`/`node:https` + opsi `lookup` kustom yang me-resolve semua alamat (A/AAAA) dan menolak IPv4/IPv6 privat (loopback, link-local, multicast, reserved, ULA fc00::/7, IPv4-mapped) **di titik resolusi koneksi** (validasi terikat koneksi, bukan cek terpisah); redirect manual maksimum 3 hop dengan validasi skema + alamat tiap hop; timeout + batas ukuran respons; pesan error disanitasi.
**Batas jujur:** dengan `lookup` kustom, koneksi memakai alamat yang tervalidasi sehingga TOCTOU DNS-ulang tertutup; namun teknik ini tetap bukan jaminan absolut terhadap seluruh vektor jaringan (mis. proxy environment). Jika verifikasi fase F menemukan celah yang tidak dapat ditutup dengan perubahan terarah, akan didokumentasikan sebagai batasan, bukan diklaim tertutup penuh.
**Test regresi (rencana H):** unit test validator alamat (IPv4/IPv6/rentang khusus, multi-address); test integrasi: target `http://127.0.0.1:<port>` ditolak **sebelum** koneksi (server hit-counter = 0); test logika hop redirect via fungsi murni (tanpa jaringan publik); tidak ada test yang menghubungi layanan internal/publik nyata.

### S-02. Eksposur static root (Tinggi)

**Bukti:** `express.static(ROOT)` (697). Smoke test: `GET /api/index.js` → 200, `GET /package.json` → 200, `GET /docs/PLAN.md` → 200, `GET /server.js` → 200, `GET /link.txt` → 200, `GET /data/database.sqlite` → 200. `GET /.env` → 404 (dotfiles diabaikan default express.static; `.env` juga tidak ada di repo).
**Dampak:** siapa pun yang dapat menjangkau server dapat membaca kode server (membantu pencarian celah), dokumentasi internal (termasuk dokumen audit ini setelah dibuat), konfigurasi dependensi, isi database (link, riwayat, progres), dan file data pengguna.
**Mitigasi (rencana F):** middleware deny sebelum static untuk `data/`, `api/`, `scripts/`, `cloudflare/`, `docs/`, `server.js`, `vercel.json`, `package*.json`, `tailwind.config.js`, `*.sqlite`; **pertahankan** akses ke halaman HTML, `css/`, `js/`, `icons/`, `manifest.webmanifest`, `sw.js`, `/CHANGELOG.md` (dipakai SW precache + halaman about), dan `link.txt` (keputusan pemilik).
**Test regresi (rencana H):** deny-list → 403/404; aset yang dipertahankan tetap 200 (termasuk `/CHANGELOG.md`).

### S-03. XSS tersimpan (Tinggi)

**Bukti:** `escapeHtml` di `js/app.js:14-21` rusak (replaceAll ke string identik; hanya apostrophe berfungsi). Sink terverifikasi tanpa escape: `app.js:262-280` (`data.name` mentah; `data.id` disisipkan ke atribut `onclick`), `app.js:631-638` (`url` mentah sebagai teks + `href`), `app.js:912-919` (`cleanUrl`), `app.js:1101` (`diff_details` link mentah), `admin.js:306` (`item.action`), `admin.js:421-428` (`data.id` ke atribut `onclick`). Dua helper benar namun terpisah (`admin.js:200-207`, `admin.js:318-322`) + `lmEsc` (`admin-links.js:111-118`) tidak dipakai konsisten.
**Dampak:** data yang masuk lewat input admin (nama antrean, daftar link, riwayat) disimpan lalu dirender tanpa escape → skrip berjalan di origin aplikasi. Rantai paling serius: XSS di halaman worker dapat membaca `sessionStorage` (kredensial admin disimpan di sana, lihat S-09) dan memanggil API admin. Eksploitabilitas memerlukan penulisan data (jalur admin atau impor), sehingga konteksnya aplikasi internal; tetap dinilai Tinggi karena rantai eskalasinya.
**Mitigasi (rencana B/C):** konsolidasi helper benar (escapeHtml + escapeAttr) ke `js/utils.js` dimuat sebelum pemanggil; terapkan di semua sink; hapus data dinamis dari atribut `onclick` (ganti `data-*` + delegation); validasi skema `http(s)` untuk href; uji dengan payload karakter HTML/kutip/skema terlarang di semua sink yang diperbaiki.
**Test regresi (rencana H):** unit test `escapeHtml`/`escapeAttr` (termasuk payload `<img onerror>`, kutip tunggal/ganda, `javascript:`); uji render via Playwright tanpa eksekusi skrip.

### S-04. Validasi input API (Sedang)

**Bukti:** `POST /api/sites` (538-560): `links.split('\n')` tanpa cek tipe → TypeError → 500 untuk payload non-string; `name` tanpa validasi. `PUT /api/sites/:id` (584-619): pola sama + status 500 saat row tidak ada. `PUT /api/sites/order`: hanya `Array.isArray`, elemen tidak divalidasi. `POST /api/progress` (645-662): publik, tanpa validasi apa pun (deviceId/siteId/lastIndex/normalCount/errorCount disimpan apa adanya; tipe kolom INTEGER dapat diisi string). `PUT /api/settings`: `default_interval` dibatasi minimum 1 tetapi tanpa batas atas.
**Dampak:** crash 500 yang dapat dipicu siapa pun (POST progress publik), data kotor/orphan di tabel progress, potensi vektor stored-XSS melalui `name`/`links` (lihat S-03), nilai interval ekstrem yang memengaruhi UI runner.
**Mitigasi (rencana F):** helper validasi bersama; semua payload invalid → 400 JSON (bukan 500); batas panjang string; normalisasi links (string/array); progress: angka non-negatif + batas wajar; order: array objek `{id, order}` dengan angka; interval: maksimum (usulan 3600) dengan pesan jelas.
**Test regresi (rencana H):** matriks payload invalid → 400; payload valid tetap sukses; read-back tidak berubah.

### S-05. Rate limit (Sedang)

**Bukti:** `api/index.js:290-303`: `authRateLimited` dipanggil di awal `requireAdmin` dan menghitung **setiap** request (sukses maupun gagal); Map in-memory per proses, tanpa pembersihan. Smoke/auth sebelumnya menunjukkan endpoint admin butuh header; percobaan gagal berulang → 429 (perilaku dipertahankan).
**Dampak:** admin sah dapat terkunci sementara setelah 20 operasi dalam 15 menit (gangguan operasional); di Vercel (banyak instance) rate limit tidak efektif antar instance (perlindungan brute-force lemah di produksi serverless).
**Mitigasi (rencana F):** hitung hanya percobaan gagal; pertahankan ambang + respons 429; verifikasi perilaku lama dulu via test. Keterbatasan multi-instance didokumentasikan sebagai residual (perbaikan butuh store eksternal, di luar scope).
**Test regresi (rencana H):** N request sukses tidak memicu 429; N+1 gagal memicu 429.

### S-06. Perbandingan password (Rendah)

**Bukti:** `reqPass !== ADMIN_PASSWORD` di `requireAdmin` dan filter `gsb_api_key` di `GET /api/settings` (361-366).
**Dampak:** serangan timing teoretis; dalam praktik sangat sulit karena jitter jaringan + password tunggal statis.
**Mitigasi (rencana F):** `crypto.timingSafeEqual` dengan panjang disamakan; perilaku 403/200 tidak berubah.
**Test regresi (rencana H):** password benar → 200, salah → 403 (tidak berubah).

### S-07. Cabang CORS mati (Rendah)

**Bukti:** `api/index.js:26-27` membandingkan `origin.host` (hostname tanpa skema) dengan entri `ALLOWED_ORIGINS` (origin penuh) → tidak pernah cocok. Kebijakan sebenarnya ditentukan baris 24 (allowlist + same-origin) dan gagal-tertutup (callback `false`).
**Dampak:** tidak ada (fail-closed); hanya kebingungan pemeliharaan.
**Mitigasi (rencana F):** hapus/benahi cabang mati tanpa mengubah perilaku; verifikasi ACAO tidak dikirim untuk origin asing.

### S-08. Kebocoran informasi via pesan error (Rendah)

**Bukti:** banyak handler mengembalikan `err.message` pada 500; `check-block` mengembalikan `note: out.error` (mis. pesan DNS/connection) ke klien publik.
**Dampak:** membantu pemetaan internal (hostname, jenis kegagalan); tidak langsung sensitif.
**Mitigasi (rencana F):** pesan generik untuk 500; log detail hanya server-side; sanitasi `note` check-block.

### S-09. Kredensial di sessionStorage (Sedang, residual)

**Bukti:** password admin diketik di modal lalu disimpan di `sessionStorage` (per tab) dan dikirim sebagai header `X-Admin-Password`. Tidak ada cookie/sesi server.
**Dampak:** siapa pun yang dapat menjalankan skrip di origin yang sama (lihat S-03) dapat membaca kredensial. Tidak ada perlindungan enkripsi; desain ini disengaja agar tanpa sesi server.
**Mitigasi:** tidak diubah dalam siklus ini (mengganti ke sesi server = perubahan arsitektur di luar scope). Mitigasi tidak langsung: tutup semua XSS (S-03) + header CSP (S-12). Didokumentasikan sebagai residual.

### S-10. Fallback sandi dev (Info, gating terverifikasi)

**Bukti:** `api/index.js` 287-288: `'rahasia123'` hanya aktif bila `NODE_ENV !== 'production'` dan bukan Vercel; `requireLocalDevOnly` (334-339) menolak request non-lokal dengan 503; bila `ADMIN_PASSWORD` kosong di produksi endpoint admin → 503 (310-312).
**Kesimpulan:** gating sesuai desain; risiko residual kecil (dokumentasi: jangan mengekspos instance dev ke jaringan).
**Test regresi (rencana H):** tanpa `ADMIN_PASSWORD` + `NODE_ENV=production` → 503; perilaku dev lokal tidak berubah.

### S-11. Kerentanan dependensi (Tinggi, sebagian rantai build)

**Bukti:** `npm audit --omit=dev`: 15 kerentanan (3 low, 2 moderate, 8 high, 2 critical). Contoh utama: `proxy-addr` (critical, IP spoofing IPv4-mapped IPv6 → relevan untuk rate limit berbasis IP), `body-parser` (DoS limit enforcement), `ws` (memory disclosure/DoS; kemungkinan dari `@supabase/supabase-js` yang unused), `sqlite3 → node-gyp → tar/make-fetch-happen/brace-expansion` (rantai build/install, bukan jalur request runtime), `ip-address` (SSRF-ish, transitif build).
**Dampak:** sebagian hanya memengaruhi proses build/install; yang runtime-relevan: `proxy-addr` (trust proxy → spoof `req.ip`) dan `body-parser`.
**Mitigasi (rencana F/G):** hapus `@supabase/supabase-js` + `uuid` (unused) lebih dulu → audit ulang; jalankan `npm audit fix` (non-breaking) untuk patch; verifikasi server tetap start + seluruh test lulus; jika sisa temuan hanya rantai build `sqlite3`, dokumentasikan sebagai residual dengan rekomendasi upgrade `sqlite3` mayor (butuh evaluasi terpisah).
**Test regresi (rencana H):** `npm audit --omit=dev` pasca-perbaikan dicatat; smoke API tetap 200; test suite lulus.

### S-12. Header keamanan (Rendah)

**Bukti:** tidak ada `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` yang diset di `api/index.js`.
**Dampak:** memperbesar dampak XSS (tidak ada CSP), potensi MIME sniffing; clickjacking berdampak kecil karena auth berbasis header per tab (frame baru tidak memiliki kredensial).
**Mitigasi (rencana F, opsional):** middleware header dasar (`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`); CSP ketat berisiko memecah Preline/Chart.js/font CDN → evaluasi hati-hati, dahulukan header non-breaking. Jika CSP tidak dapat diterapkan tanpa regresi, dokumentasikan.

## Kontrol yang Sudah Baik (Terverifikasi)

- SQL parameterized di seluruh query (`api/index.js`; tidak ditemukan konkatenasi string).
- CORS dibatasi same-origin + `ALLOWED_ORIGINS`, gagal-tertutup (baris 24-27).
- Endpoint state-changing admin ter-gate `requireLocalDevOnly + requireAdmin`; `GET /api/settings` menyembunyikan `gsb_api_key` tanpa admin.
- Tidak ada cookie/sesi → tidak ada permukaan CSRF klasik; auth header per request.
- `GET /.env` → 404; `.gitignore` mengecualikan `.env`, DB, log.
- `sw.js` hanya cache same-origin, `/api` dikecualikan → tidak ada cache respons terautentikasi.
- Tidak ada upload file ke server; impor TXT diproses di klien.
- Dev fallback ter-gate ketat (S-10).

## Risiko Residual (Tidak Diperbaiki dalam Siklus Ini)

1. Password admin di `sessionStorage` (S-09) — mitigasi: hilangkan XSS, header CSP; perubahan sesi server = di luar scope.
2. Rate limit in-memory tidak efektif multi-instance (S-05) — butuh store eksternal.
3. Sebagian kerentanan dependensi berada di rantai build `sqlite3` (S-11) — upgrade mayor perlu evaluasi terpisah.
4. SSRF: jaminan bergantung implementasi `lookup` terikat koneksi (S-01); jika tidak memungkinkan, batasan didokumentasikan dan status tidak diklaim "tertutup penuh".
5. CDN eksternal (Preline/Chart.js/marked/fonts) — risiko supply chain + batasan offline; self-host di luar scope.

## Rencana Verifikasi Ulang (Fase H)

- Semua test regresi S-01..S-12 di atas dijalankan via `node:test` (tanpa dependensi baru) + smoke HTTP lokal.
- Tidak ada test yang menghubungi layanan internal/publik yang tidak diperlukan; target internal disimulasikan dengan server lokal ber-hit-counter.
- Hasil aktual dicatat di `docs/QA_REPORT.md`; klaim PASS hanya untuk yang benar-benar dieksekusi.
