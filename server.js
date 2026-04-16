// File ini sudah dipindahkan ke api/index.js untuk kompatibilitas Vercel.
// Silakan gunakan api/index.js sebagai entry point.

// Fdb.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        name TEXT,
        links TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if(!err) {
            db.run(`ALTER TABLE sites ADD COLUMN sort_order INTEGER DEFAULT 0`, () => {});
        }
    });
    
    db.run(`CREATE TABLE IF NOT EXISTS progress (
        device_id TEXT,
        site_id TEXT,
        last_index INTEGER DEFAULT 0,
        normal_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        PRIMARY KEY (device_id, site_id)
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT,
        site_name TEXT,
        diff_summary TEXT,
        diff_details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Safe Browsing Endpoint
app.post('/api/check-safe', async (req, res) => {
    const { url } = req.body;
    const apiKey = process.env.SAFE_BROWSING_API_KEY;

    if (!apiKey) return res.json({ safe: true, message: "Tidak ada API Key di .env, lolos." });

    try {
        // v4 Endpoint Payload (Lebih stabil untuk pemeriksaan raw URL)
        // Jika client punya key v5, endpoint v4 ini umumnya tetap kompatibel untuk lookup web langsung.
        const v4Res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client: { clientId: "linkflow", clientVersion: "1.0.0" },
                threatInfo: {
                    threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                    platformTypes: ["ANY_PLATFORM"],
                    threatEntryTypes: ["URL"],
                    threatEntries: [{ url: url }]
                }
            })
        });

        const v4Data = await v4Res.json();
        
        // Pengecekan respons ancaman
        if (v4Data.matches && v4Data.matches.length > 0) {
            return res.json({ safe: false, threatType: v4Data.matches[0].threatType });
        }
        res.json({ safe: true });
    } catch (e) {
        console.error("Safe Browsing Error:", e.message);
        res.json({ safe: true, message: "Gagal memindai, bypass keamanan diaktifkan." });
    }
});
