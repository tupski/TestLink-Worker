# PLAN — UI/UX Overhaul TestLink (branch `v2`)

Spesifikasi: `docs/Hermes Master Prompt — TestLink UI/UX Overhaul.md`.
Library: Preline UI free (`docs/UI_LIBRARY_DECISION.md`). Desain: `docs/DESIGN_SYSTEM.md`. Audit: `docs/UI_UX_AUDIT.md`.

## Fasa

- [x] **Fasa 0 — Audit** (2026-09-13): audit repo + `UI_UX_AUDIT.md` + `UI_LIBRARY_DECISION.md` + `DESIGN_SYSTEM.md` + `PLAN.md`. Tanpa perubahan UI.
- [ ] **Fasa 1 — Foundation**: integrasi Preline free, token desain (tipografi, spasi, warna), komponen reusable, state responsif. Verifikasi aplikasi masih jalan.
- [ ] **Fasa 2 — App Shell**: sidebar desktop (admin), header/navigasi mobile, layout halaman, sistem toast/dialog global. Perilaku runner belum diubah.
- [ ] **Fasa 3 — Runner Redesign**: state Idle/Running/Paused/Completed eksplisit, countdown, progres; pertahankan navigasi nyata, manual mode, otomatis mode, pause/resume/stop. Prioritas tertinggi.
- [ ] **Fasa 4 — Queue & Link Manager**: UI antrean (Queue), link manager (search, pagination, filter, bulk, TXT import/export, duplikat), empty/error states.
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
