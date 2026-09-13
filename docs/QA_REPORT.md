# QA Report — TestLink UI/UX Overhaul (branch `v2`)

Tanggal: 2026-09-13. Fase 10 (QA).

## Ringkasan

| Area | Metode | Hasil |
| --- | --- | --- |
| Integritas referensi ID (JS ↔ HTML) | `node scripts/qa-static.js` | OK — 0 ID hilang |
| Handler `onclick`/`onchange` ↔ fungsi JS | `node scripts/qa-static.js` | OK — 0 handler tanpa fungsi |
| Kontras WCAG AA (16 pasangan warna) | `node scripts/qa-static.js` | OK — 16/16 lulus (min 5,71:1) |
| Tap target minimum 44px | audit kelas tombol | OK — `!min-h-0` dihapus di 12 tempat |
| Native `alert()` di worker | audit `js/app.js` | OK — 0 (sisa 1 `confirm()` untuk reset progres) |
| Halaman & endpoint HTTP | curl lokal | OK — `/`, `/admin.html`, `/about.html`, `/api/*`, ikon, manifest 200 |
| CRUD antrean (POST/PUT/GET/DELETE) | curl end-to-end | OK — data terhapus bersih setelah uji |
| Pengaturan PUT/GET round-trip | curl | OK — `default_interval` 3→5→3 |
| Auth admin | curl, 2 mode | OK — dev local 200; prod tanpa `ADMIN_PASSWORD` 503 |
| Rate limit auth | 25 percobaan salah | OK — 429 setelah batas |
| Kebocoran `gsb_api_key` | curl tanpa header admin | OK — tidak terekspos |
| CORS origin asing | curl dengan `Origin` palsu | OK — tidak ada `Access-Control-Allow-Origin` |
| Navigasi nyata (inti produk) | audit `window.open` | OK — masih satu-satunya jalur buka URL di runner |
| Syntax JS | `node --check` (6 file) | OK |

## Perbaikan yang muncul dari QA

1. **Kontras gagal AA** — `text-slate-500` (3,75:1) dan `text-slate-600` (±2,3:1) dipakai di 58 tempat; diganti `text-slate-400` (6,96:1), dan token `--text-faint` dinaikkan dari `#64748b` ke `#94a3b8`. Teks 11–12px di tabel/admin kini lolos WCAG AA.
2. **Tap target < 44px** — kelas `!min-h-0` pada 12 tombol ikon (kontrol urutan, aksi tabel, pagination) dihapus agar kembali ke `min-height: 44px` sesuai R-03.
3. **Skrip QA** (`scripts/qa-static.js`) mengenali ID yang dibuat dinamis oleh JS, sehingga tidak lagi menghasilkan temuan palsu.

## Yang belum bisa diverifikasi otomatis (butuh pengujian manual di browser)

Ini perlu Anda cek langsung karena butuh browser nyata / perangkat:

1. **Runner nyata** — mode Fokus Tab: klik Mulai, pastikan tab baru terbuka, kembali ke tab worker, progres naik, tombol Jeda lalu Lanjut bekerja, Stop menghentikan, selesai memunculkan state "Selesai" + tombol Ulangi.
2. **Mode Otomatis Jeda** — countdown berjalan, tab mengganti URL sendiri, dan setiap URL masuk history browser.
3. **Validasi manual** — aktifkan toggle, pastikan kotak Normal/Blokir/Error muncul setiap kembali dari tab tujuan.
4. **History browser nyata** — buka `chrome://history`, pastikan URL dari runner tercatat (ini tujuan utama produk).
5. **PWA install** — pasang dari Chrome (ikon TL muncul), buka standalone, pastikan layout aman di safe-area.
6. **Banner update PWA** — deploy versi baru, pastikan banner "Versi baru TestLink tersedia" muncul dan tombol Muat ulang mengambil versi baru.
7. **Responsif** — 320 / 375 / 390 / 768 / 1024 / 1440 px: sidebar admin jadi drawer di mobile, tabel bisa di-scroll horizontal, tidak ada teks terpotong.
8. **Deteksi ISP/DNS & speedtest** — jalankan dari perangkat asli (butuh jaringan telekomunikasi nyata).

## Catatan terbuka

- `confirm()` masih dipakai di satu tempat (`resetProgress`) — sengaja; dialog konfirmasi custom bisa masuk pekerjaan lanjutan.
- Speedtest masih memakai angka simulasi (`Math.random()`); belum diganti data nyata. Ini keputusan produk yang perlu Anda putuskan: hapus, atau ganti pengukuran nyata.
- Worker/admin memuat Preline dari CDN. Jika ingin sepenuhnya offline-PWA, bundel file Preline ke repo.
