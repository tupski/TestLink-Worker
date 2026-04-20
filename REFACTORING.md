# TestLink Refactoring Documentation

## Struktur Baru (Maintainable)

### **Backend API (`src/api/`)**

```
src/api/
├── config/
│   └── constants.js          # Konstanta aplikasi (block markers, settings keys, dll)
├── services/
│   ├── database.js           # Database service (connection, initialization, CRUD)
│   ├── block-detector.js     # Block detection logic (URL & HTML analysis)
│   ├── gsb-service.js        # Google Safe Browsing integration
│   ├── settings-service.js   # Settings business logic
│   └── site-service.js       # Site CRUD business logic
├── middleware/
│   └── auth.js               # Authentication middleware
├── routes/
│   ├── auth.js               # POST /api/auth
│   ├── settings.js           # GET/PUT /api/settings
│   ├── sites.js              # CRUD /api/sites
│   ├── history.js            # GET/DELETE /api/history
│   ├── check-block.js        # POST /api/check-block
│   ├── progress.js           # POST /api/progress
│   └── stats.js              # GET /api/admin/stats
└── utils/
    ├── time.js               # Time utilities (WIB formatting)
    ├── uuid.js               # UUID generation
    └── project-root.js       # Project root resolution
```

### **Frontend Admin (`src/frontend/admin/`)**

```
src/frontend/admin/
├── services/
│   └── api.js                # API client abstraction
├── components/
│   └── sites.js              # Sites list component
└── utils/
    └── formatters.js         # Date/text formatters
```

---

## Alesan Refactor Kode

### **1. Lebih Modular**
- Setiap file punya 1 tanggung jawab jelas (Single Responsibility Principle)
- Mudah menemukan dan mengubah kode
- Kode yang terkait dikelompokkan bersama

### **2. Lebih Maintainable**
- Struktur folder yang jelas dan konsisten
- Nama file dan fungsi yang deskriptif
- Mudah untuk onboarding developer baru

### **3. Lebih Testable**
- Services bisa di-test secara terpisah
- API client abstraction memudahkan mocking
- Business logic terpisah dari routing

### **4. Lebih Clean**
- Kode lebih terorganisir
- Mengurangi duplikasi
- Mengikuti best practices

### **5. Lebih Scalable**
- Mudah menambah fitur baru
- Tidak perlu mengubah file besar
- Bisa menambah routes/services baru tanpa mengganggu yang existing

---

## Perbandingan Sebelum & Sesudah

| Aspek | Sebelum | Sesudah |
|-------|---------|---------|
| **File terbesar** | 638 baris (api/index.js) | ~100 baris/file |
| **Jumlah file** | 1 file besar | 15+ file terorganisir |
| **Testability** | ❌ Sulit di-test | ✅ Mudah di-test |
| **Maintainability** | ❌ Sulit dicari | ✅ Terorganisir |
| **Onboarding** | ❌ Membingungkan | ✅ Jelas struktur |
| **Bug fixing** | ❌ Risiko tinggi | ✅ Isolasi baik |

---

## 🚀 Cara Menjalankan

### **Development**
```bash
npm run dev
```

### **Production**
```bash
npm start
```

---

## Testing (Coming Soon)

Struktur modular ini memungkinkan testing yang lebih baik:

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

---

## Contoh Penggunaan

### **Menambah Route Baru**

1. Buat file route baru di `src/api/routes/new-feature.js`:
```javascript
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Hello from new feature!' });
});

module.exports = router;
```

2. Daftarkan di `api/index.js`:
```javascript
const newFeatureRoutes = require('../src/api/routes/new-feature');
app.use('/api/new-feature', newFeatureRoutes);
```

### **Menambah Service Baru**

1. Buat file service baru di `src/api/services/new-service.js`:
```javascript
class NewService {
    static async doSomething() {
        // Business logic here
    }
}

module.exports = { NewService };
```

2. Gunakan di route:
```javascript
const { NewService } = require('../services/new-service');

router.get('/', async (req, res) => {
    const result = await NewService.doSomething();
    res.json(result);
});
```

---

## Konfigurasi

### **Environment Variables**
- `PORT` - Port server (default: 3000)
- `ADMIN_PASSWORD` - Password admin (default: rahasia123)
- `VERCEL` - Set to '1' jika deploy di Vercel
- `NODE_ENV` - Environment (development/production/test)

### **Database**
- SQLite database disimpan di `data/database.sqlite`
- Di Vercel, database disimpan di `/tmp/` (volatile)

---

## Resources

- [Express.js Documentation](https://expressjs.com/)
- [SQLite3 Documentation](https://www.npmjs.com/package/sqlite3)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## Kontribusi

1. Buat branch baru untuk fitur/fix
2. Ikuti struktur folder yang sudah ada
3. Tulis tests untuk fitur baru
4. Submit pull request

---

## License

ISC