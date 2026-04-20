# 📜 Changelog

Semua perubahan penting pada proyek **Test Link** akan didokumentasikan di file ini. Format ini didasarkan pada [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.9.220426] - 2026-04-20
### Added
- **WIB Timezone Support**: Implementasi zona waktu WIB (UTC+7) untuk semua timestamp di server dan client.
- **Proper Timestamp Formatting**: Fungsi `getNowWIB()` di backend dan `formatWIBTimestamp()` di frontend untuk konsistensi timezone.

### Changed
- **Database Timestamps**: Mengubah dari `CURRENT_TIMESTAMP` (UTC) ke explicit WIB timestamps menggunakan `getNowWIB()`.
- **History Display**: Riwayat perubahan data sekarang menampilkan waktu dalam WIB yang akurat sesuai zona waktu lokal.
- **Timestamp Format**: Format penyimpanan waktu di database menjadi `YYYY-MM-DD HH:mm:ss` (WIB).

### Fixed
- Sinkronisasi waktu server dengan waktu lokal pengguna yang menggunakan zona WIB.
- Ketidaksesuaian timestamp antara waktu update server dan tampilan di riwayat.

---

## [0.8.442106] - 2026-04-12
### Added
- **PWA Full Support**: Implementasi `sw.js` (Service Worker) dan `manifest.webmanifest`.
- **Floating Tool Sheet**: Mengganti navigation bar tradisional dengan FAB (Floating Action Button) yang membuka panel alat modern.
- **Maintenance Mode**: Integrasi pengaturan server untuk menampilkan pesan perawatan secara dinamis.
- **Advanced Network Info**: Menambahkan deteksi tipe koneksi (Wi-Fi/Cellular) menggunakan Network Information API.
- **Push Badges**: Dukungan lencana pada icon aplikasi untuk menandai adanya perubahan riwayat data baru.
- **Health Check API**: Integrasi `api/check-block` untuk verifikasi status link yang lebih akurat melalui backend.

### Changed
- **UI Refresh**: Transisi penuh ke premium dark mode dengan header baru yang lebih informatif.
- **Countdown Logic**: Pindah ke `deadlineWatchId` (checking vs `Date.now()`) yang jauh lebih stabil saat tab kehilangan fokus di background.
- **Manual Validation UI**: Menggunakan skema warna indigo yang lebih konsisten dan tombol tindakan yang lebih tegas.

### Fixed
- Sinkronisasi status *visibilitychange* pada mode runner otomatis.
- Perbaikan layouting footer agar tetap proporsional pada layar mobile.

---

## [0.7.110424] - 2026-04-11
### Added
- **Mini Countdown UI**: Memindahkan timer dari overlay layar penuh ke kotak kecil di header antara nama situs dan progres.
- **History Pagination**: Menambahkan opsi 5 dan 10 riwayat per halaman.
- **Auto-Cleanup**: Logika pembersihan riwayat otomatis untuk data yang berumur lebih dari 7 hari.
- **Ping Modal V2**: Terminal bergaya modern dengan auto-scroll dan stripping protocol `https://` untuk keterbacaan.

### Changed
- **Otomatis Jeda Logic**: Memungkinkan runner berjalan tanpa memerlukan fokus kembali ke tab (bypass `visibilityChange` jika mode Jeda aktif).
- **Badge Status Ping**: Implementasi badge dinamis "OK" hijau dan "FAIL" merah pada header terminal ping.

---

## [0.5.000001]
### Added
- Inisialisasi modernisasi UI menggunakan Glassmorphism.
- Implementasi dasar Speedtest simulasi menggunakan Chart.js.
- Integrasi IP & DNS Resolver API.
- Sistem verifikasi ISP untuk deteksi provider lokal (Tsel/XL/Indosat).

---

## [0.1.000000]
### Added
- Basis aplikasi Test Link Tracker (Runner, Site List, Admin Panel).
- Integrasi SQLite & Node.js backend.
- Fungsi dasar buka tab otomatis.
