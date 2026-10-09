# ARCHITECTURE_AUDIT — TestLink Worker

Tanggal audit: 2026-10-09. Branch: `v2` (HEAD `646c587`, sinkron `origin/v2`, working tree bersih sebelum audit). Metode: inspeksi kode langsung (grep + pembacaan file dengan nomor baris), smoke test server lokal, `node --check`, `scripts/qa-static.js`, `npm audit`. Prinsip: tanpa framework/bundler/abstraksi baru; tidak memindahkan file hanya demi kerapian; kontrak API, skema DB, URL publik, dan perilaku PWA dijaga; data pengguna tidak disentuh.

Dokumen terkait: `docs/UI_UX_AUDIT.md` (UI), `docs/SECURITY_AUDIT.md` (keamanan), `docs/DESIGN_SYSTEM.md`, `docs/PLAN.md`.

## 1. Inventaris File dan Tanggung Jawab

| File | Baris | Tanggung jawab aktual | Catatan |
|---|---|---|---|
| `index.html` | 552 | Shell worker: kartu runner, daftar antrean, modal (koneksi, speedtest, ping, history, diff, keluar), 35 inline `onclick` | Memuat `tailwind-built.css` lalu `styles.css`; script `pwa.js` + `app.js` + inline init |
| `admin.html` | 403 | Shell admin: 7 tab (Ringkas, Link Manager, Antrean, Pengaturan, Riwayat, Sistem, Tentang), sidebar + drawer Preline, 15 inline `onclick` | **Tidak memuat `styles.css`** (temuan A-01); script `pwa.js` + `admin-links.js` + `admin.js` |
| `about.html` | kecil | Halaman tentang + changelog (marked.js CDN) | Memuat kedua CSS; `styles.css` inline sebagian |
| `js/app.js` | 1117 | Runner (2 mode), render antrean, ping/skip blokir, speedtest simulasi, history + diff, verifikasi koneksi, guard keluar | State global ±18 variabel; 5 `addEventListener`; section berupa komentar (`// ---`), bukan modul |
| `js/admin.js` | 620 | Auth admin, Ringkas, CRUD Antrean, Pengaturan (4 tab), Riwayat, toast | 2 helper escape berbeda (`escapeHtmlAdmin` 200-207, `escapeHtml` DOM 318-322) |
| `js/admin-links.js` | 365 | Link Manager: search/filter/pagination/bulk/copy/dedupe/ekspor | State `LM_STATE`; helper escape ketiga `lmEsc` (111-118); `normalizeUrl` |
| `js/pwa.js` | kecil | Registrasi SW + banner update (SKIP_WAITING/APP_UPDATED) | 6 listener; tidak menyentuh navigasi |
| `api/index.js` | 717 | Express 5 + SQLite: auth header + rate limit, CORS whitelist, sites/progress/history/settings, GSB, static root | `module.exports = app` (mendukung test); SQL parameterized seluruhnya |
| `sw.js` | 43 | Cache-first shell `testlink-v10`, `/api` dikecualikan | ASSETS tidak memuat `icons/icon-maskable-512.png` (temuan G) |
| `css/styles.css` | 561 | Token + komponen: `.btn` (100-145), `.input` (155-167), `.badge` (181-195), `.empty-state` (221-234), `.admin-nav-item` (261-284), `.settings-tab` (287+), toast, table | **Tidak ikut bundle Tailwind** (input build hanya `@tailwind`), jadi hanya aktif di halaman yang memuatnya langsung |
| `css/tailwind.css` → `css/tailwind-built.css` | 29,76 KB | Build CLI (`tailwindcss -i ./css/tailwind.css -o ./css/tailwind-built.css --minify`) | Deterministik (build ulang tanpa diff); dimuat ketiga halaman |
| `scripts/qa-static.js` | 114 | Cek ID JS↔HTML, handler `onclick`, kontras WCAG 15 pasangan; hitung `alert/confirm` hanya di `app.js` | Exit 1 bila ada masalah; belum terhubung npm |
| `scripts/make_icons.py` | kecil | Generator ikon | Tidak dipakai runtime |
| `server.js` | 3 | Shim legacy ke `api/index.js` | `npm start` langsung `node api/index.js`; kandidat arsip |
| `cloudflare/worker.js` + `wrangler.toml` | 44 | Reverse proxy ke `BACKEND_URL` | Deployment alternatif; tidak memengaruhi struktur repo |
| `vercel.json` | kecil | includeFiles: `*.html,*.md,*.png,css/**,js/**,icons/**,manifest.webmanifest,sw.js,data/**` | Setiap file baru harus dicek terhadap pola ini |
| `403.html`, `404.html`, `500.html` | kecil | Error statis | `404.html` dipakai fallback API; `403.html` + `500.html` **tidak direferensikan** |
| `data/database.sqlite` | - | DB bundel (Vercel: copy ke `/tmp`) | `.gitignore` sudah mengecualikan; terekspos HTTP (temuan A-04) |
| `link.txt` | 21 KB | Data contoh link (file pengguna) | Tidak direferensikan kode; dipertahankan (keputusan pemilik) |
| `docs/` | - | Dokumentasi proyek | Ikut ter-deploy; `CHANGELOG.md` wajib tetap dapat diakses (precache SW + halaman about) |

## 2. Temuan Prioritas

### P1 (perlu tindakan dalam siklus ini)

**A-01. `admin.html` tidak memuat `styles.css` padahal memakai kelas komponennya.**
Bukti: `admin.html` head (baris 1-19) hanya memuat `tailwind-built.css` + `<style>` inline (font, no-scrollbar); grep `styles.css` pada admin.html = 0. Penggunaan kelas komponen di admin.html: `.input` 15×, `.btn` 15×, `.label` 11×, `.admin-nav-item` 7×, `.btn--ghost` 6×, `.btn--primary` 5×, `.settings-tab` 4×, `.btn--secondary` 4×, `.btn--block` 2×. Definisi kelas ada di `css/styles.css:100-287`, dan `grep "btn--primary\|admin-nav-item\|--primary:" css/tailwind-built.css` = 0 (tidak ikut bundle).
Dampak: sebagian elemen admin kehilangan state komponen (hover, disabled, focus, badge, toast, empty-state); inkonsistensi worker vs admin. Sebagian dikompensasi utility Tailwind sehingga dampak visual bervariasi per elemen (wajib diverifikasi visual di fase E).
Rekomendasi: tambahkan `<link rel="stylesheet" href="/css/styles.css">` setelah `tailwind-built.css` di admin.html (fase B1), lalu verifikasi visual per elemen + `qa-static` + click-through.

**Status (Fase B1, 2026-10-09): selesai** — link ditambahkan setelah `tailwind-built.css`; terverifikasi smoke HTTP + browser (urutan stylesheet benar, 0 error console). Verifikasi visual per elemen tetap dilakukan di fase E.

**A-02. Empat implementasi escape tersebar, satu di antaranya rusak.**
Bukti: `js/app.js:14-21` `escapeHtml` rusak (replaceAll ke string identik, hanya apostrophe yang berfungsi); `js/admin.js:200-207` `escapeHtmlAdmin` benar; `js/admin.js:318-322` `escapeHtml` DOM-based benar (nama berbeda); `js/admin-links.js:111-118` `lmEsc` benar (duplikat logika). Sink yang tidak memakai helper sama sekali terverifikasi di `app.js:262-280`, `app.js:631-638`, `app.js:912-919`, `app.js:1101`, `admin.js:306`, `admin.js:421-428`.
Dampak: XSS tersimpan (lihat `SECURITY_AUDIT.md` S-03) + risiko perbaikan parsial jika konsolidasi tidak disiplin.
Rekomendasi: konsolidasi ke `js/utils.js` (escape + escapeAttr + validasi skema URL) dimuat sebelum seluruh pemanggil (fase B1), terapkan di semua sink (fase C).

**Status (Fase B1, 2026-10-09): konsolidasi selesai** — satu implementasi di `js/utils.js` (`escapeHtml` diperbaiki, `escapeAttr`, `isSafeHttpUrl`; UMD-lite); 4 definisi lama dihapus; dimuat paling awal di 3 halaman; sw.js v11 + precache; 5 unit test lulus. Penerapan di sisa sink + validasi skema href = fase C.

**A-03. `js/app.js` (1117 baris) memikul 6+ tanggung jawab.**
Bukti: section komentar menandai area runner/antrean (285-641), provider/DNS + verifikasi koneksi (642-783), speedtest (784-843), ping (844-966), history (967-1117), state global (23-39). Inline `onclick` HTML bergantung pada fungsi global (35 titik di index.html).
Dampak: sulit dinavigasi, risiko konflik nama saat perubahan; bukan bug fungsional.
Rekomendasi: pemecahan bertahap **kondisional** (fase B2) memakai classic script (bukan ES module) agar kontrak global tetap; setiap pecahan diverifikasi terpisah; jika risiko > manfaat, dokumentasikan sebagai follow-up dan lewati.

**Status (Fase B2, 2026-10-09): ditunda** — 35 kontrak `onclick` inline di index.html + ±18 state global; fase C/D/E akan menyentuh file yang sama; harness test runner baru ada di fase H. Risiko > manfaat saat ini; evaluasi ulang sebagai follow-up setelah C/D/E stabil + harness H tersedia.

**A-04. `express.static(ROOT)` menyajikan seluruh root proyek, termasuk sumber daya sensitif.**
Bukti smoke test lokal: `GET /api/index.js` → 200, `GET /package.json` → 200, `GET /docs/PLAN.md` → 200, `GET /server.js` → 200, `GET /link.txt` → 200, `GET /data/database.sqlite` → 200. `GET /.env` → 404 (dotfiles diabaikan `express.static` secara default).
Dampak: kebocoran kode server, dokumentasi (termasuk dokumen audit ini), struktur dependensi, dan isi DB.
Rekomendasi: middleware deny sebelum `express.static` (fase F) untuk `data/`, `api/`, `scripts/`, `docs/` (kecuali yang dibutuhkan), `*.sqlite`, `*.json` konfigurasi, `server.js`, `cloudflare/`, `tests/`; pertahankan halaman, `css/`, `js/`, `icons/`, `manifest.webmanifest`, `sw.js`, `/CHANGELOG.md`, `link.txt` (keputusan pemilik). Verifikasi: test regresi + smoke ulang.

### P2 (perbaikan terjadwal)

**A-05. Duplikasi string kelas dan pola UI antar file.** Tombol/badge dibangun ulang di JS (mis. tombol simpan admin, `PING_BADGE_*` di app.js) padahal komponen `.btn/.badge` tersedia. Dampak: perubahan gaya harus disentuh di banyak tempat. Rekomendasi: gunakan komponen `styles.css` saat menyentuh kode terkait (fase C/E), tanpa sweeping rewrite.

**A-06. State global tanpa batas kepemilikan.** `app.js` ±18 variabel (sitesData, isRunning, runnerState, dll), `LM_STATE` di admin-links.js, state form di admin.js. Dampak: risiko tabrakan nama saat pemecahan file. Rekomendasi: daftar kepemilikan variabel per area sebelum B2; tidak perlu namespace/modul.

**A-07. Dua sistem dialog.** Modal custom per halaman + 5 `confirm()` native + 1 fallback `alert()` (app.js:1108; admin.js:139, 325, 609; admin-links.js:141, 297). Rekomendasi: satu komponen dialog aksesibel (fase D).

**A-08. Dependensi CDN tidak offline-safe.** Preline, Chart.js, marked, Google Fonts dimuat dari CDN; SW hanya cache same-origin. Dampak: saat offline, komponen interaktif/grafik/konten changelog bisa absen (fitur inti runner tetap jalan). Status: batasan PWA existing, bukan regresi; self-host = kandidat follow-up (di luar scope).

**A-09. Pola event campuran.** Inline `onclick` dominan (35 index, 15 admin); `addEventListener` rendah (app.js 5, admin.js 4, admin-links.js 6, pwa.js 6) dan tidak ditemukan listener ganda. Kontrak global wajib dijaga saat refactor; jangan menambah inline handler baru berisi data dinamis (fase C).

**A-10. Dead code / aset / dependensi tak terpakai.** `uuid` dan `@supabase/supabase-js` tidak di-`require` di kode mana pun (grep `js/ api/ scripts/ server.js cloudflare/`); `403.html` + `500.html` tidak direferensikan; `server.js` shim legacy; referensi `countdown-worker.js` hanya tersisa di dokumen lama; `.codebuddy/` untracked (direktori tooling). Rekomendasi: hapus dependensi (fase G, dengan verifikasi server tetap start), koreksi dokumen, pertimbangkan arsip `403/500.html` + `server.js` (butuh approval pemilik), tambahkan `.codebuddy/` ke `.gitignore` (opsional).

### P3 (kebersihan, tidak memblokir)

- **A-11.** `api/index.js:26-27` cabang CORS mati (`origin.host` vs origin penuh) — redundant, fail-closed; rapikan saat menyentuh file (fase F).
- **A-12.** Rate-limit Map tanpa pembersihan entri (pertumbuhan memori kecil); sekaligus hitungan menghitung request sukses (lihat S-05).
- **A-13.** `api/index.js` check-block: kondisi `if (out.ok || !out.ok)` selalu true (GSB selalu dipanggil meski target unreachable) — code smell, rapikan saat hardening SSRF (fase F).
- **A-14.** Export `window.*` tidak konsisten (hanya satu) sementara fungsi lain global murni; gaya campuran, bukan bug.

## 3. Risiko Pindah / Rename File

| Aset | Konsumen yang terikat | Aturan |
|---|---|---|
| `index.html`, `admin.html`, `about.html` | manifest `shortcuts` + `start_url`, `sw.js` ASSETS, vercel includeFiles, URL publik/histori | **Jangan rename** tanpa keputusan rilis |
| `js/*.js` | script tag di 3 HTML, `sw.js` ASSETS, vercel `js/**` | Menambah/memecah file: perbarui script tag + ASSETS + bump cache (v10 → v11); urutan muat wajib benar (util sebelum pemanggil) |
| `css/styles.css`, `css/tailwind-built.css` | link di halaman | Jangan rename; `tailwind-built.css` hanya berubah via `npm run build:css` |
| `data/**` | vercel includeFiles; runtime DB | Jangan dipindah/dihapus; akses HTTP ditutup lewat middleware (bukan pemindahan) |
| `/CHANGELOG.md` | precache `sw.js` + halaman about | Harus tetap dapat diakses HTTP setelah deny-list fase F |
| `link.txt` | tidak direferensikan kode (file pemilik) | Dipertahankan apa adanya |
| `docs/**` | vercel includeFiles `*.md` | Setelah deny-list, docs tidak lagi tersaji HTTP kecuali yang dibutuhkan |
| `scripts/`, `cloudflare/`, `tests/` (baru) | tidak dibutuhkan runtime | Tidak perlu disajikan; `tests/` tidak ikut vercel includeFiles (aman) |

## 4. Usulan Struktur (Bertahap, Tanpa Framework/Bundler)

**Tahap minimal (dipilih untuk siklus ini):**

1. `js/utils.js` — satu sumber escape (`escapeHtml`, `escapeAttr`), validasi skema URL (`isSafeHttpUrl`), helper format ringan; pola classic script + ekspor UMD-lite (`module.exports` bila tersedia) agar dapat diuji `node:test`. Dimuat paling awal di ketiga halaman.
2. `js/dialog.js` — dialog konfirmasi/notifikasi aksesibel (menggantikan `confirm()`/`alert()`), dipakai worker + admin; bergantung pada `utils.js` hanya jika perlu.
3. Perbaikan A-01 (link `styles.css` di admin.html) sebagai perubahan terpisah yang mudah diverifikasi.

**Tahap lanjutan (kondisional, hanya jika B2 dieksekusi):** pecah `app.js` per area (`runner`, `sites`, `history`, `ping`, `speedtest`, `connection`) sebagai classic script dengan urutan muat eksplisit; `admin.js`/`admin-links.js` cukup ekstraksi dialog/toast bila menyentuh.

**Aturan migrasi:** satu tahap = satu perubahan terverifikasi (qa-static + click-through + smoke); jangan mencampur pemindahan file dengan perubahan perilaku; rollback = `git checkout` file terkait (tree bersih terjaga per fase); setiap file baru dicek terhadap vercel includeFiles + SW ASSETS + script tag.

**Yang tidak diusulkan:** pindah ke `src/`, ES modules, bundler, TypeScript, atau restrukturisasi direktori besar. Struktur flat saat ini memadai untuk skala proyek.

## 5. Peta Temuan ke Fase Eksekusi

| Temuan | Fase |
|---|---|
| A-01 link styles.css admin | B1 |
| A-02 konsolidasi escape | B1 + C |
| A-03 split app.js | B2 (kondisional) |
| A-04 deny static sensitif | F |
| A-05/A-07 konsistensi komponen + dialog | C/D/E |
| A-08 batasan offline CDN | dokumentasi (G/H) |
| A-10 dependensi tak terpakai | G |
| A-11..A-14 kebersihan | F (saat menyentuh file terkait) |

## 6. Batasan Audit Ini

- Dampak visual A-01 belum diverifikasi di browser pada fase audit ini; verifikasi dilakukan di fase E (Playwright) dan dicatat di `QA_REPORT.md`.
- Analisis dead-code fungsi per fungsi bersifat heuristik (berbasis referensi grep + `qa-static`); tidak ada klaim penghapusan tanpa verifikasi fase G.
- Tidak ada perubahan kode aplikasi pada fase audit ini; seluruh temuan di atas diverifikasi terhadap kode/status HTTP aktual per 2026-10-09.
