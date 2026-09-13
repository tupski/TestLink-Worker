# Keputusan Library UI — TestLink Worker

Tanggal: 2026-09-13. Status: diputuskan (arahan pemilik proyek: **Preline UI free**).

## Library terpilih: Preline UI (Free)

https://preline.co — komponen Tailwind + plugin JS vanilla (tanpa framework).

### Alasan

1. **Arahan eksplisit pemilik proyek** (2026-09-13).
2. Kompatibel **vanilla JS**: plugin JS-nya berbasis data-attribute (`data-hs-*`), tidak butuh React/Vue.
3. Kompatibel **Tailwind** (proyek sudah Tailwind).
4. Lisensi: Preline UI Free (komponen inti gratis, lisensi terbuka untuk penggunaan; Pro berbayar tidak dipakai).
5. Cakupan kebutuhan spesifikasi §5: modal (hs-overlay), dropdown, select, toggle, tabs, accordion, input, dsb.
6. Tidak menambah framework baru; ukuran wajar via CDN/build.

### Alternatif yang dipertimbangkan

| Alternatif | Catatan |
|---|---|
| Flowbite | Mirip, vanilla + Tailwind; Preline lebih lengkap untuk modal/dropdown/select. |
| daisyUI | CSS-only, tapi gaya komponen kuat menentukan tampilan; kurang kontrol untuk desain sistem sendiri. |
| Shoelace (Web Components) | Bagus, tapi menambah runtime Web Components + shadow DOM; lebih berat dari kebutuhan. |
| Manual | Melanggar spesifikasi ("jangan bangun komponen manual jika library gratis tersedia"). |

### Strategi integrasi

- Preline **free** via CDN pada `index.html`, `admin.html`, `about.html`:
  - CSS: sudah Tailwind; Preline butuh sedikit CSS plugin/plugin Tailwind bila pakai build. Dengan Tailwind CDN sekarang, pakai bundel JS Preline + salin class komponen sesuai dokumentasi.
  - JS: `https://cdn.jsdelivr.net/npm/preline@.../index.js` (auto-init via `data-hs-*`).
- Komponen yang dipakai: modal/overlay (`data-hs-overlay`), dropdown, select, toggle, tabs, input dengan label, button variants, table, badge, alert, offcanvas (drawer mobile admin), accordion (pengaturan).
- Komponen yang TIDAK dipakai: apa pun dari koleksi Pro (berbayar), chart (Chart.js existing tetap), mega-menu/marketing blocks yang tidak relevan aplikasi utility.
- Toast & pagination: pola existing sudah berfungsi; diseragamkan gayanya, tidak wajib ganti ke plugin Preline.

### Risiko

- Tailwind CDN (JIT browser) tidak direkomendasikan untuk produksi; saat fasa fondasi, pertimbangkan build Tailwind + plugin Preline. Jika CDN dipertahankan, dokumentasikan batasannya.
- SW cache shell harus di-bump (`CACHE`) setiap aset JS/CSS berubah agar PWA menerima update.
