# Design System — TestLink Worker

Sumber arah: `docs/Hermes Master Prompt — TestLink UI/UX Overhaul.md` §6 (arahan pemilik) + filter antislop (mode DURING, core).

**Design Read:** aplikasi utility internal untuk operator pengetesan link, bahasa Indonesia, gaya *clean modern utility* (jernih, tenang, hierarki tegas; referensi prinsip: Linear/Vercel/Raycast, tanpa meniru). Dial: **ENERGY 1 / RHYTHM 1 / MOTION 1** — tampilan harus tenang, konsisten, gerak minimal (hover/fokus/transisi state saja).

## Identitas

- **Karakter**: alat kerja yang jernih dan tenang; informasi dulu, dekorasi tidak ada.
- **Motif identitas**: satu garis status/aksen indigo pada elemen aktif (tab aktif, item antrean aktif, progress). Dipakai berulang sebagai penanda "yang sedang jalan".
- **Bahasa**: Indonesia, kalimat pendek dan lugas. Tanpa emoji, tanpa italic, tanpa uppercase menyeluruh.

## Palet (maks 2 warna inti + 1 aksen, R-29)

| Token | Nilai | Pakai |
|---|---|---|
| `--surface` | slate-950 (#020617) | Latar halaman (dark; aplikasi dipakai lama di lapangan, standar alat teknis) |
| `--surface-card` | slate-900 (#0f172a) | Kartu, panel |
| `--border` | slate-800 | Border halus, 1px |
| `--text` | slate-100 | Teks utama |
| `--text-muted` | slate-400 | Teks sekunder (min. kontras AA terhadap permukaannya) |
| `--primary` | indigo-500 (#6366f1) | Aksi utama, aksen status aktif — SATU-satunya warna aksen |
| Status | emerald-500 (sukses/normal), red-500 (blokir/error), amber-500 (peringatan) | Hanya untuk status, bukan dekorasi |

Larangan: gradient halaman, glow, border-glow, glassmorphism kecuali maksimal 1-2 elemen (mis. topbar saja), palet pelangi, dark + warna neon.

## Tipografi

- Font: **Plus Jakarta Sans** (sudah ada, dipertahankan; alasan: identitas existing, jarak aksara ramah bahasa Indonesia). Mono: font mono sistem untuk URL.
- Body 14px, sekunder 12px (bukan 7–10px), judul halaman 20–24px, angka besar (counter) 24–28px.
- Tanpa italic. Uppercase hanya untuk label kecil yang memang membantu pemindaian (mis. label kolom tabel), weight 600–700, bukan 900.

## Spasi & Radius

- Skala 4px: 4/8/12/16/24/32.
- Radius: kartu 12px (`rounded-xl`), input & tombol 8px (`rounded-lg`), modal 16px (`rounded-2xl`). Tidak ada pill/2.5rem+.
- Shadow: hanya satu level elevasi untuk overlay (modal, sheet). Kartu flat dengan border, tanpa shadow.

## Komponen (Preline UI free + gaya di atas)

Button, Icon Button, Input, Select, Checkbox, Toggle (Preline), Badge (status nyata saja), Card, Modal (Preline overlay, closable Escape + focus trap), Dropdown, Tabs, Toast (satu sistem untuk worker+admin), Alert, Table, Pagination, Empty/Loading/Error state, Progress bar, Page header, Sidebar (admin desktop), Bottom nav (mobile).

Aturan: setiap state data punya empty/loading/error (R-27); setiap kontrol punya perilaku nyata (R-26); fokus terlihat di semua kontrol (R-32); status tidak bertumpu pada warna saja (teks/ikon pendamping); tap target min 44px (R-03).

## Perilaku Responsif

- Mobile (320–430px): layout satu kolom, header ringkas, navigasi bawah/sheet, tombol full-width untuk aksi utama, tabel jadi daftar atau scroll horizontal jika perlu.
- Desktop (≥1024px): admin pakai sidebar; worker tetap satu kolom max-w-2xl (runner fokus).
- Diuji di 320/375/390/768/1024/1440.

## Gerak (MOTION 1)

Transisi state 150–200ms (hover, fokus, buka/tutup modal, perubahan progress). Tanpa animasi dekoratif, tanpa border-glow, tanpa scale-bounce. `prefers-reduced-motion` dihormati.
