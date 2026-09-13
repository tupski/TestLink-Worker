# PLAN — UI/UX Overhaul TestLink (branch `v2`)

Spesifikasi: `docs/Hermes Master Prompt — TestLink UI/UX Overhaul.md`.
Library: Preline UI free (`docs/UI_LIBRARY_DECISION.md`). Desain: `docs/DESIGN_SYSTEM.md`. Audit: `docs/UI_UX_AUDIT.md`.

## Fasa

- [x] **Fasa 0 — Audit** (2026-09-13): audit repo + `UI_UX_AUDIT.md` + `UI_LIBRARY_DECISION.md` + `DESIGN_SYSTEM.md` + `PLAN.md`. Tanpa perubahan UI.
- [x] **Fasa 1 — Foundation** (2026-09-13): Preline free (CDN `preline@2`) di 3 halaman, token desain + komponen di `css/styles.css` (palet, tipografi 14px, radius 8/12/16, focus-visible, reduced-motion, .btn/.card/.input/.badge/.table/.empty-state/.progress), hapus gradient/glow/glass berlebih, font non-italic, SW cache bump v4. Verifikasi: server lokal 200 di `/`, `/admin.html`, `/about.html`, `/css/styles.css`, `/api/*`; Preline script & font baru tersaji.
- [x] **Fasa 2 — App Shell** (2026-09-13): Tailwind CLI build + plugin Preline (ganti Play CDN), admin shell sidebar desktop + drawer mobile (Preline offcanvas), header worker & tools sheet dirapikan. Sistem toast/dialog global menyusul per fasa (toast ada, dialog konfirmasi custom menyusul).
- [x] **Fasa 3 — Runner Redesign** (2026-09-13): kartu runner dirancang ulang dengan state eksplisit (Pengecekan/Siap/Berjalan/Jeda/Menunggu tab/Validasi/Selesai) via `renderRunnerState()` + badge status; progress bar; tombol Mulai/Jeda/Lanjut/Stop/Ulangi dari awal/Kembali ke antrean; konfigurasi terkunci saat berjalan; `alert()` diganti toast. Navigasi nyata (`window.open`), mode manual/otomatis, countdown deadline, dan sinkron progres per device tidak berubah.
- [x] **Fasa 4 — Queue & Link Manager** (2026-09-13): antrean worker dikartukan dengan progress + badge Selesai + tombol Lanjut/Buka/Reset pakai `.btn/.badge`; empty state dengan link ke admin; admin antrean jadi tabel (urutan, nama, status Aktif/Nonaktif badge, jumlah link, aksi Edit/Nonaktifkan/Hapus + naik/turun); `alert()` → toast; link manager primitif tetap di textarea (pindah ke Fasa 5/6 untuk full manager).
- [ ] **Fasa 5 — History**: redesign riwayat internal (jelas berbeda dari history browser), search/filter/pagination.
- [ ] **Fasa 6 — Admin Panel**: admin.html full redesign (Overview, Links, Queues, History, Settings, System) dengan sistem komponen yang sama.
- [ ] **Fasa 7 — Settings**: reorganisasi pengaturan (General/Runner/Network/PWA/Notifications/Maintenance/Security/About), tanpa menghapus fungsionalitas existing.
- [ ] **Fasa 8 — PWA Polish**: manifest (icon PNG + maskable), SW update handling, apple-touch-icon, standalone/mobile layout, verifikasi navigasi otomatis tetap navigasi browser nyata.
- [ ] **Fasa 9 — Security & Cleanup**: hapus fallback password hardcoded, pertimbangkan session auth, XSS escape, CORS, hapus kode mati (countdown-worker.js di SW ASSETS, dll).
- [ ] **Fasa 10 — QA**: klik--through semua kontrol (runner manual/otomatis, queue CRUD, history, admin, PWA install/update), mobile 320–1440, laporan bukti per elemen (R-35).

## Git

Commit logis per fasa (docs:/feat:/fix:/chore:). Branch `v2`.

## Catatan antislop (mode DURING)

Filter: `C:\Users\Kakarama Room\.hermes\skills\antislop\SKILL.md` (core only). Dial ENERGY 1 / RHYTHM 1 / MOTION 1. Delivery Gate dijalankan sebelum setiap fasa UI dinyatakan selesai.
