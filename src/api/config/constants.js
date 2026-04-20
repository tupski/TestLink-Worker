/**
 * Konstanta dan konfigurasi aplikasi
 */

// Block page URL fragments (Indonesian internet filtering)
const BLOCK_PAGE_FRAGMENTS = [
    'internet-positif',
    'internetpositif',
    'trustpositif',
    'nawala',
    'merdeka.com/block',
    'blockpage.xlaxiata',
    'xlaxiata.co.id/block',
    'aduankonten',
    'lamanlabuh',
    'komdigi',
    'kominfo',
    'walled-garden',
    'walledgarden',
    'captive.apple',
    'telkomsel.com/block',
    'indihome.co.id/block',
    'axis.net/block',
    'access-denied'
];

// Block HTML markers (content-based detection)
const BLOCK_HTML_MARKERS = [
    'internet-positif',
    'internet positif',
    'internetpositif',
    'trustpositif',
    'trust positif',
    'lamanlabuh',
    'aduankonten',
    'blockpage',
    'situs yang anda buka',
    'tidak dapat diakses',
    'negative content',
    'konten yang melanggar',
    'pembatasan akses',
    'nawala',
    'internet sehat',
    'filtered access',
    'access to this site',
    'diblokir',
    'halaman pemblokiran',
    'walled garden',
    'captive portal',
    'komdigi'
];

// Allowed settings keys
const SETTINGS_KEYS = new Set([
    'app_title',
    'app_tagline',
    'default_interval',
    'maintenance_mode',
    'maintenance_message',
    'about_page_title',
    'about_page_body',
    'gsb_active',
    'gsb_api_key',
    'seo_visibility',
    'robot_permission'
]);

// Default settings values
const DEFAULT_SETTINGS = [
    ['app_title', 'Test Link'],
    ['app_tagline', 'Runner link & cek koneksi, satu layar.'],
    ['default_interval', '3'],
    ['maintenance_mode', '0'],
    ['maintenance_message', ''],
    ['about_page_title', 'Tentang Test Link'],
    ['about_page_body', 'Test Link membantu tim menjalankan daftar URL dengan progres per perangkat, cek koneksi/DNS, dan riwayat perubahan dari admin.\n\nGunakan mode fokus-tab untuk validasi manual, atau mode jeda otomatis untuk throughput lebih tinggi di tab yang sama.'],
    ['seo_visibility', '1'],
    ['robot_permission', 'index,follow']
];

module.exports = {
    BLOCK_PAGE_FRAGMENTS,
    BLOCK_HTML_MARKERS,
    SETTINGS_KEYS,
    DEFAULT_SETTINGS
};