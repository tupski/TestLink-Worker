# DESIGN SYSTEM v2 - Halaman Worker TestLink (index2.html)

Status: arah baru yang menggantikan DESIGN_SYSTEM.md (dark slate + indigo) untuk halaman worker.
Berlaku untuk: `index2.html` + `css/v2.css`. Halaman lain (index.html, admin.html, about.html) belum
disentuh sampai promosi disetujui.

## 1. Prinsip

1. Terang dan tenang. Kanvas kertas hangat, permukaan putih, tinta hijau-arang. Fokus ke isi, bukan efek.
2. Satu aksen. Hanya satu warna aksi (emerald pekat). Warna lain hanya untuk status.
3. Jempol dulu. Semua aksi utama berada di sepertiga bawah layar. Target sentuh minimal 44px, aksi utama 48px.
4. Terbaca di lapangan. Ukuran teks minimum 12px, kontras teks minimal 4.5:1, angka pakai tabular-nums.
5. Gerak secukupnya. Transisi 160-240ms, hormati `prefers-reduced-motion`.
6. Larangan: teks italic untuk UI, bobot 900, teks di bawah 12px, radius 3rem, glow/shadow berwarna,
   emoji sebagai ikon, em dash di teks, huruf kapital semua untuk kalimat panjang.

## 2. Token Warna (dipakai sebagai CSS custom property di css/v2.css)

| Token | Nilai | Pemakaian |
|---|---|---|
| --bg | #F6F7F4 | Kanvas halaman |
| --surface | #FFFFFF | Kartu, bar, modal |
| --surface-2 | #EFF1EC | Blok dalam kartu, zebra, chip netral |
| --border | #E2E6DF | Garis pemisah, tepi kartu |
| --border-strong | #C9D1C7 | Tepi input aktif, tombol sekunder |
| --ink | #17211B | Teks utama |
| --ink-2 | #45524A | Teks sekunder |
| --ink-3 | #6B7871 | Teks bantu / caption |
| --accent | #0E7A5F | Tombol utama, tautan, indikator aktif |
| --accent-strong | #0A5F4A | Hover / pressed tombol utama |
| --accent-soft | #E3F2EC | Latar chip dan sorotan aksen |
| --success | #16794C | Status berhasil |
| --success-soft | #E4F4E9 | Latar chip berhasil |
| --warning | #9A6700 | Status peringatan |
| --warning-soft | #FBF0D9 | Latar chip peringatan |
| --danger | #B3261E | Status gagal / bahaya |
| --danger-soft | #FCE8E6 | Latar chip gagal |
| --terminal-bg | #101713 | Blok terminal (satu-satunya area gelap) |
| --terminal-ink | #D7E3DB | Teks terminal |
| --focus-ring | rgba(14, 122, 95, .35) | Ring fokus keyboard |

Aturan kontras: --ink-3 hanya untuk teks >=12px di atas permukaan terang; jangan di atas --bg untuk teks panjang.

## 3. Tipografi

- Keluarga: Plus Jakarta Sans (sudah dimuat, tidak ada font baru).
- Bobot yang dipakai: 400, 500, 600, 700. Tidak ada 800/900.
- Skala: display 28/1.15 (600), h1 22/1.2 (600), h2 17/1.3 (600), body 15/1.5 (400),
  body-strong 15/1.5 (600), small 13/1.45 (400), caption 12/1.4 (500).
- Eyebrow (label kecil di atas judul): 11px, 600, huruf kapital, letter-spacing .08em, warna --ink-3.
  Hanya untuk label sependek 1-3 kata.
- Angka dinamis (counter, persen, timer): font-variant-numeric: tabular-nums.

## 4. Ruang, Radius, Elevasi

- Spasi kelipatan 4: 4, 8, 12, 16, 20, 24, 32. Padding kartu 16 (mobile) / 20 (layar >=480px).
- Radius: 10 (kontrol kecil), 14 (kartu, input, tombol), 18 (modal, sheet), 999 (chip, dot, progress).
- Elevasi: kartu memakai tepi 1px --border tanpa bayangan. Bar lengket: 0 1px 2px rgba(23,33,27,.06).
  Modal: 0 12px 32px rgba(23,33,27,.18). Tanpa glow berwarna.

## 5. Struktur Halaman (mobile-first)

- Topbar ringkas: eyebrow "Worker", judul + tagline (id appBrandTitle/appBrandTagline),
  chip status (statusIndicator + focusStatus), tautan Beranda. Baris ID device (deviceIdDisplay).
- Bottom nav 3 tab, tinggi 64px + safe-area:
  1. Antrean (listDisplay, kartu situs dari app.js)
  2. Proses (kartu runner statusCard + kontrol fase)
  3. Alat (Cek koneksi & DNS, Speed test, Riwayat, Tentang, Panel admin)
- Tab Proses punya empty state sendiri saat statusCard tersembunyi.
- Saat runner berjalan, baris aksi (pingControls/runnerControls/completedControls) lengket
  di bawah viewport (sticky, bottom = tinggi nav + safe-area + 12px) supaya selalu terjangkau.
- Konten diberi padding bawah >= tinggi nav agar tidak tertutup.

## 6. Komponen Wajib (didefinisikan di css/v2.css)

- Tombol: primary (accent, teks putih), secondary (permukaan putih, tepi strong), ghost (tanpa latar),
  danger (merah), semuanya min-height 48px, radius 14, fokus ring 3px --focus-ring, transisi 160ms.
- Kartu (.card, .site-card), baris daftar, chip/badge (.badge--neutral/success/warning/danger),
  progress bar 8px, switch 44px+, input/select/search min-height 48px, toast, modal, empty state.
- Terminal ping: blok gelap --terminal-bg, teks mono 12px, tanpa italic.
- Kompat app.js: app.js menyuntik kelas utility Tailwind (mis. text-white, bg-slate-900) ke dalam
  kartu situs, laporan GSB, terminal ping, dan tabel riwayat. css/v2.css memuat blok override
  ter-scope (mis. .site-card .text-white) supaya semua tetap terbaca di tema terang. Daftar lengkap
  ada di bagian "Kompatibilitas app.js" pada css/v2.css.

## 7. State yang Wajib Ada

kosong, memuat, error, offline (banner), standby, menghitung (countdown), berjalan, dijeda,
menunggu kembali ke tab, validasi manual, selesai, laporan link diblokir, update PWA tersedia.

## 8. Aksesibilitas

- Focus-visible selalu terlihat (ring accent), termasuk di modal.
- aria-live untuk status (toast, badge runner, ping).
- Kontras: teks utama >= 4.5:1 di atas --surface dan --bg.
- `prefers-reduced-motion: reduce` mematikan animasi slide/pulse.
- Target sentuh 44px; jarak antar target >= 8px.

## 9. Aturan File

- index2.html memuat: /css/tailwind-built.css (kompat utility untuk markup yang disuntik app.js),
  lalu /css/v2.css. styles.css TIDAK dimuat di index2.html.
- js/app.js, js/utils.js, js/dialog.js, js/pwa.js tidak diubah. Semua id DOM yang dibaca app.js
  dipertahankan (daftar di riwayat sesi dan diverifikasi lewat uji browser).
- sw.js: /index2.html dan /css/v2.css dikecualikan dari cache runtime sampai promosi.

## 10. Mode Gelap & Pemilih Tema

- Pilihan: `Sistem` (default) / `Terang` / `Gelap`, disimpan di localStorage `tlw-theme`.
- Script inline di <head> index2.html menetapkan `data-theme` pada <html> sebelum paint
  (anti-FOUC), memperbarui meta theme-color, dan menyinkronkan tombol (aria-pressed).
- Token gelap ada di css/v2.css: `:root[data-theme="dark"]`. Semua komponen memakai token yang
  sama, jadi tidak perlu override per-komponen; terminal tetap gelap di kedua tema.
- Token tambahan lintas tema: --on-accent, --on-danger, --accent-line, --success-line,
  --warning-line, --danger-line, --warning-ink, --scrim, --topbar-backdrop, --scroll-thumb.
- Kontras teks dijaga >= 4.5:1 di kedua tema; `color-scheme` di-set per tema agar kontrol
  bawaan browser ikut menyesuaikan.
- Saat mode Sistem aktif, perubahan prefers-color-scheme langsung diikuti (listener matchMedia).
