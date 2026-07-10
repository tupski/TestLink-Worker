# 🎯 Cara Menjalankan di Local (Bahasa Indonesia)

Panduan super mudah untuk menjalankan TestLink Worker di komputer Anda!

---

## 📋 Yang Anda Butuhkan

✅ **Node.js** (versi 16 atau lebih baru)
- Belum punya? Download di: https://nodejs.org/
- Pilih versi **LTS** (Long Term Support)
- Install seperti biasa (Next → Next → Finish)

✅ **Text Editor** (optional, untuk edit konfigurasi)
- Notepad++ / VS Code / Sublime Text

---

## 🚀 Cara Paling Mudah (Windows)

### Metode 1: Pakai Script Otomatis

1. **Double-click** file `setup.bat`
   - Script akan otomatis install dan build
   - Tunggu sampai selesai (2-3 menit)

2. **Double-click** file `start.bat`
   - Server akan jalan otomatis
   - Jangan tutup window CMD yang muncul!

3. **Buka browser**, ketik:
   ```
   http://localhost:3030/
   ```

4. **Selesai!** ✨

---

### Metode 2: Manual (Pakai Command Prompt)

1. **Buka Command Prompt** di folder project
   - Cara: Shift + Klik Kanan di folder → "Open PowerShell window here"
   - Atau: Ketik `cmd` di address bar File Explorer

2. **Install dependencies:**
   ```bash
   npm install
   ```
   Tunggu sampai selesai (2-3 menit)

3. **Build project:**
   ```bash
   npm run build
   ```
   Tunggu sampai selesai (~30 detik)

4. **Jalankan server:**
   ```bash
   npm start
   ```

5. **Buka browser:**
   ```
   http://localhost:3030/
   ```

---

## 🎨 Halaman yang Bisa Diakses

Setelah server jalan, buka di browser:

### 1. **Worker Page** (Halaman Utama)
```
http://localhost:3030/
```
- Untuk test link
- Pilih kategori
- Jalankan test otomatis

### 2. **Admin Panel** (Halaman Admin)
```
http://localhost:3030/admin.html
```
- **Password**: `admin123`
- Tambah/edit kategori
- Lihat statistik
- Atur pengaturan

### 3. **About Page** (Halaman Tentang)
```
http://localhost:3030/about.html
```
- Info aplikasi
- Bisa di-customize di admin panel

### 4. **Health Check** (Cek Status)
```
http://localhost:3030/api/health
```
- Cek apakah server running
- Lihat status database

---

## ⚙️ Ubah Konfigurasi (Optional)

### Ubah Port (Jika Port 3030 Sudah Dipakai)

1. Buka file `.env` dengan text editor
2. Cari baris:
   ```env
   PORT=3030
   ```
3. Ubah jadi port lain, misalnya:
   ```env
   PORT=3031
   ```
4. Save file
5. Restart server

### Ubah Password Admin

1. Buka file `.env`
2. Cari baris:
   ```env
   ADMIN_PASSWORD=admin123
   ```
3. Ubah jadi password baru:
   ```env
   ADMIN_PASSWORD=password_saya
   ```
4. Save file
5. Restart server

---

## 🎯 Cara Pakai Aplikasi

### 1. Login ke Admin Panel

1. Buka: http://localhost:3030/admin.html
2. Masukkan password: `admin123`
3. Klik **Masuk**

### 2. Tambah Kategori Pertama

1. Di admin panel, klik tab **Kategori**
2. Isi **Nama skenario**: `Test Bundle Telkomsel`
3. Isi **Links** (satu per baris):
   ```
   https://google.com
   https://facebook.com
   https://youtube.com
   ```
4. Klik **Simpan ke server**
5. Kategori berhasil ditambahkan! ✅

### 3. Test Link di Worker Page

1. Buka: http://localhost:3030/
2. Pilih kategori yang tadi dibuat
3. Klik **Mulai Test**
4. Lihat hasilnya!

### 4. Lihat Statistik

1. Di admin panel, klik tab **Ringkas**
2. Lihat:
   - Jumlah kategori
   - Total link
   - Riwayat aktivitas
3. Klik **Quick Actions** untuk navigasi cepat

---

## 🛑 Cara Stop Server

### Metode 1: Tutup Window
- Tutup window Command Prompt / PowerShell
- Server otomatis berhenti

### Metode 2: Keyboard Shortcut
- Tekan `Ctrl + C` di window Command Prompt
- Ketik `Y` lalu Enter
- Server berhenti

---

## 🐛 Masalah yang Sering Terjadi

### ❌ Error: "Port 3030 already in use"

**Solusi:**
1. Ubah PORT di file `.env` jadi port lain (misalnya 3031)
2. Atau stop aplikasi lain yang pakai port 3030

### ❌ Error: "Cannot find module"

**Solusi:**
```bash
npm install
npm run build
```

### ❌ Error: "npm is not recognized"

**Solusi:**
- Node.js belum terinstall atau belum masuk PATH
- Install ulang Node.js dari https://nodejs.org/
- Restart Command Prompt setelah install

### ❌ Browser tidak bisa akses localhost:3030

**Solusi:**
1. Pastikan server masih running (jangan tutup CMD window)
2. Cek di CMD, harus ada tulisan: `Server running on port 3030`
3. Coba akses: http://127.0.0.1:3030/
4. Cek firewall, pastikan port 3030 tidak diblok

### ❌ Admin panel tidak bisa login

**Solusi:**
1. Cek password di file `.env`
2. Default password: `admin123`
3. Pastikan tidak ada spasi di awal/akhir password
4. Refresh browser (Ctrl + F5)

---

## 📱 Akses dari HP/Tablet

Ingin test dari HP di jaringan yang sama?

### 1. Cari IP Address Komputer

**Windows:**
```bash
ipconfig
```
Cari **IPv4 Address**, contoh: `192.168.1.100`

### 2. Akses dari HP

Di browser HP, ketik:
```
http://192.168.1.100:3030/
```
(Ganti `192.168.1.100` dengan IP komputer Anda)

**Syarat:**
- HP dan komputer harus di WiFi yang sama
- Firewall tidak memblok port 3030

---

## 🔄 Development Mode (Auto-Reload)

Untuk development, pakai mode auto-reload:

```bash
npm run dev
```

**Keuntungan:**
- Server otomatis restart saat ada perubahan file
- Tidak perlu restart manual
- Cocok untuk development

---

## 📊 Database

### SQLite (Default)

- File database: `data/database.sqlite`
- Otomatis dibuat saat pertama kali jalan
- Tidak perlu install database server
- Cocok untuk local development

### MySQL (Optional)

Jika ingin pakai MySQL:

1. Install MySQL (XAMPP/MySQL Workbench)
2. Buat database dan user
3. Edit `.env`:
   ```env
   DB_TYPE=mysql
   DB_HOST=localhost
   DB_USER=testlink_user
   DB_PASSWORD=your_password
   DB_NAME=testlink_db
   ```
4. Restart server

---

## 🎨 Customize Aplikasi

### 1. Ubah Judul & Tagline

1. Login admin panel
2. Tab **Pengaturan**
3. Edit:
   - Judul aplikasi
   - Tagline
4. Klik **Simpan pengaturan**
5. Refresh worker page

### 2. Edit Halaman About

1. Login admin panel
2. Tab **Tentang**
3. Edit:
   - Judul halaman
   - Isi konten
4. Klik **Simpan halaman Tentang**

### 3. Maintenance Mode

1. Login admin panel
2. Tab **Pengaturan**
3. Centang **Mode maintenance**
4. Isi pesan maintenance
5. Klik **Simpan pengaturan**

---

## 📚 File Penting

```
TestLink Worker/
├── setup.bat              ← Double-click untuk setup
├── start.bat              ← Double-click untuk start server
├── .env                   ← Konfigurasi (port, password, dll)
├── package.json           ← Dependencies
├── QUICK_START.md         ← Panduan cepat (English)
├── CARA_JALANKAN.md       ← Panduan ini
├── README_LOCAL_SETUP.md  ← Panduan lengkap
└── data/
    └── database.sqlite    ← Database file (otomatis dibuat)
```

---

## ✅ Checklist

Pastikan semua langkah sudah dilakukan:

- [ ] Node.js sudah terinstall
- [ ] Dependencies sudah di-install (`npm install`)
- [ ] Project sudah di-build (`npm run build`)
- [ ] Server sudah jalan (`npm start`)
- [ ] Browser bisa akses http://localhost:3030/
- [ ] Admin panel bisa login dengan password `admin123`
- [ ] Sudah tambah minimal 1 kategori
- [ ] Sudah test link di worker page

---

## 🎉 Selamat!

Aplikasi TestLink Worker sudah jalan di komputer Anda!

**Langkah Selanjutnya:**
1. ✅ Explore semua fitur di admin panel
2. ✅ Tambah beberapa kategori untuk testing
3. ✅ Customize branding sesuai kebutuhan
4. ✅ Test dari berbagai device (HP, tablet)
5. ✅ Deploy ke server production (aaPanel)

---

## 🆘 Butuh Bantuan?

### Dokumentasi Lengkap
- **QUICK_START.md** - Panduan cepat (English)
- **README_LOCAL_SETUP.md** - Panduan detail setup
- **README_DEPLOYMENT.md** - Deploy ke aaPanel
- **README.md** - Overview aplikasi

### Check Status
```bash
# Cek apakah server running
curl http://localhost:3030/api/health
```

### Logs
Perhatikan output di Command Prompt:
- ✅ Hijau = OK
- ❌ Merah = Error

---

**Happy Testing!** 🚀

**Version**: 1.0.0
**Last Updated**: 2026-05-25
