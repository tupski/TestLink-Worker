# 📜 Changelog

Semua perubahan penting pada proyek **Test Link** akan didokumentasikan di file ini. Format ini didasarkan pada [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2026-05-25
### Added
- **MySQL Database Support**: Dukungan penuh untuk MySQL database sebagai alternatif SQLite.
- **Database Abstraction Layer**: Interface `DatabaseAdapter` untuk mendukung multiple database backends.
- **Connection Pooling**: Implementasi connection pool untuk MySQL dengan konfigurasi limit (default: 10 koneksi).
- **Migration Script**: Script `npm run migrate` untuk migrasi data dari SQLite ke MySQL.
- **TypeScript Rewrite**: Konversi seluruh backend dari JavaScript ke TypeScript.
- **Enhanced Logging**: Sistem logging terstruktur dengan level (debug, info, warn, error).
- **Slow Query Detection**: Peringatan otomatis untuk query yang memakan waktu >1 detik.
- **Connection Retry**: Mekanisme retry otomatis dengan exponential backoff untuk koneksi database.
- **Health Check Endpoint**: `GET /api/health` untuk monitoring status aplikasi dan database.
- **Graceful Shutdown**: Penanganan SIGTERM/SIGINT untuk menutup koneksi database dengan benar.
- **User-Friendly Errors**: Pesan error dalam Bahasa Indonesia untuk masalah database umum.
- **Deployment Documentation**: Panduan lengkap deployment ke aaPanel dengan Node Proxy.

#### Admin Panel UI/UX Improvements (Task 10 & 11)
- **Loading States**: 
  - Loading skeleton untuk site list dengan animasi pulse
  - Loading spinner untuk history table
  - Loading indicator untuk form submissions dengan spinning icon
  - Loading state untuk statistics cards
- **Empty States**: 
  - Enhanced empty state dengan icon, pesan, dan CTA button
  - Empty state untuk history table dengan pesan informatif
  - Call-to-action buttons yang auto-focus ke input relevan
- **Error Handling**: 
  - Toast notifications dengan type-based styling (success/error/info)
  - Error states dengan retry buttons untuk failed loads
  - Inline validation error messages dengan color coding
  - Clear error messages dengan actionable feedback
- **Confirmation Dialogs**: 
  - Custom confirmation modal menggantikan native `confirm()`
  - Modal untuk delete category dan clear history actions
  - Backdrop blur effect dan smooth animations
- **Success Feedback**: 
  - Success toast messages dengan green border
  - Prominent success indicators setelah actions
- **Form Improvements**: 
  - Character counter untuk semua text inputs (current/max)
  - Color-coded character counter (green → yellow → red)
  - Disabled button states dengan proper styling
  - Placeholder text untuk semua inputs
  - Helper text di bawah inputs menjelaskan purpose
  - Auto-focus pada password input di login modal
- **Form Validation**: 
  - Inline validation on blur untuk site name dan links
  - Success indicator (green border + checkmark) untuk valid inputs
  - Error indicator (red border + error message) untuk invalid inputs
  - Clear validation on focus untuk re-entry
  - Validation rules: nama min 3 chars, max 100 chars, links required
- **Real-time Feedback**: 
  - Real-time link counter yang update saat user mengetik
  - Menampilkan "🔗 X link terdeteksi" secara live
  - Character counter update real-time dengan color coding
- **Visual Enhancements**: 
  - Badge colors untuk action types (ADD=green, EDIT=blue, DELETE=red)
  - Smooth transitions untuk semua interactive elements
  - Hardware-accelerated CSS animations
  - Responsive design improvements untuk mobile

#### Table Display Enhancements (Task 12)
- **Pagination System**:
  - Pagination untuk history table dengan 10 items per page
  - Smart page number display (max 5 visible pages)
  - Previous/Next navigation buttons dengan disabled states
  - Display current range (e.g., "Menampilkan 1-10 dari 45 entri")
- **Timestamp Improvements**:
  - Relative time formatting ("2 jam lalu", "3 hari lalu", "Baru saja")
  - Exact timestamp on hover untuk detail lengkap
  - Intelligent time calculations (seconds, minutes, hours, days, weeks, months, years)
- **Badge System**:
  - Color-coded badges untuk action types (ADD, EDIT, DELETE)
  - Consistent badge styling across all tables
- **Responsive Tables**:
  - Horizontal scroll wrapper untuk tables di mobile
  - Touch-friendly scrolling dengan `-webkit-overflow-scrolling: touch`
  - Minimum table width untuk prevent column squashing

#### Mobile Responsiveness (Task 13)
- **Small Screen Optimization (320px minimum)**:
  - Touch-friendly button sizes (44x44px minimum)
  - Responsive typography scaling untuk readability
  - Optimized padding untuk small screens
  - Single column layouts di mobile
  - Prevent horizontal scroll di semua breakpoints
- **Responsive Layout Adjustments**:
  - Single column layout untuk stat cards below 640px
  - Full-width buttons di mobile
  - Vertical stacking untuk flex items
  - Consistent spacing across breakpoints
  - Responsive grid adjustments (1 col → 3 col → 4 col)

#### Dashboard Statistics Enhancements (Task 14)
- **Enhanced Stat Cards**:
  - Representative icons untuk setiap stat (📁 Kategori, 🔗 Link, 📊 Riwayat)
  - Trend indicators (structure ready untuk future implementation)
  - Last updated timestamp dengan format lokal
  - Hover effects dengan smooth transitions
  - Animated stat value changes dengan scale effect
- **Quick Actions Widget**:
  - 4 quick action buttons (Tambah, Setting, Riwayat, Worker)
  - Icon-based navigation dengan hover effects
  - Scale animation on hover
  - Direct navigation ke relevant sections
- **Recent Activity Widget**:
  - Display 5 most recent activities
  - Color-coded action badges
  - Relative time display
  - "View All" link ke history page
  - Slide-in animations untuk activity items

### Changed
- **Server Architecture**: Refactor ke class-based `TestLinkServer` untuk modularitas lebih baik.
- **Environment Configuration**: Konfigurasi database via environment variables (DB_TYPE, DB_HOST, dll).
- **Error Handling**: Peningkatan error handling dengan `DatabaseError` class.
- **Admin Panel UX**: Peningkatan signifikan pada user experience dengan loading states, validation, dan feedback.

### Breaking Changes
- **Environment Variables**: Perlu set `DB_TYPE=mysql` dan kredensial MySQL untuk production.
- **Build Step Required**: Perlu menjalankan `npm run build` sebelum `npm start`.
- **Entry Point Changed**: Entry point production berubah dari `api/index.js` ke `dist/index.js`.

### Migration Guide
1. Backup database SQLite existing
2. Setup MySQL database di aaPanel
3. Copy `.env.example` ke `.env` dan sesuaikan konfigurasi
4. Jalankan `npm run build`
5. Jalankan `npm run migrate` untuk migrasi data
6. Update Node Proxy startup file ke `dist/index.js`

---

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
