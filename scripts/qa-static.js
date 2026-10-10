/**
 * QA statis TestLink v2: cek referensi ID, handler onclick, dan kontras WCAG.
 *
 * Jalankan: node scripts/qa-static.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const pages = ['index.html', 'admin.html', 'about.html', 'index2.html'];
const scripts = ['js/utils.js', 'js/dialog.js', 'js/app.js', 'js/admin.js', 'js/admin-links.js', 'js/pwa.js'];

const htmlAll = pages.map(read).join('\n');
// Script inline di halaman (mis. window.v2SetTheme) dihitung sebagai definisi fungsi juga.
const inlineJs = pages
    .map((p) => [...read(p).matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n'))
    .join('\n');
const jsAll = scripts.map(read).join('\n') + '\n' + inlineJs;

const problems = [];
const notes = [];

// ---------- 1. getElementById di JS harus ada id-nya di HTML ----------
const idsInHtml = new Set([...htmlAll.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
// ID yang dibuat dinamis oleh JS (innerHTML atau el.id = '...') dianggap ada.
const idsCreatedInJs = new Set([
    ...[...jsAll.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]),
    ...[...jsAll.matchAll(/\.id\s*=\s*'([^']+)'/g)].map((m) => m[1])
]);
const idExists = (id) => idsInHtml.has(id) || idsCreatedInJs.has(id);
const idsUsed = new Set([...jsAll.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]));
const missingIds = [...idsUsed].filter((id) => !idExists(id));
if (missingIds.length) problems.push(`ID dipakai JS tapi tidak ada di HTML: ${missingIds.join(', ')}`);

// ---------- 2. querySelector('#id') juga ----------
const selIds = new Set([...jsAll.matchAll(/querySelector\(\s*'#([A-Za-z0-9_-]+)'/g)].map((m) => m[1]));
const missingSel = [...selIds].filter((id) => !idExists(id));
if (missingSel.length) problems.push(`Selector #id tidak ditemukan: ${missingSel.join(', ')}`);

// ---------- 3. handler onclick/onchange di HTML harus punya fungsinya ----------
const handlers = new Set(
    [...htmlAll.matchAll(/\bon(?:click|change|input)="([^"]+)"/g)]
        .map((m) => m[1])
        .flatMap((body) => [...body.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)].map((mm) => mm[1]))
        .filter((fn) => !['if', 'return', 'this', 'document', 'console', 'Number', 'parseInt', 'String'].includes(fn))
);
const jsFns = new Set([
    ...[...jsAll.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
    ...[...jsAll.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g)].map((m) => m[1]),
    ...[...jsAll.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1])
]);
const missingFns = [...handlers].filter((fn) => !jsFns.has(fn));
if (missingFns.length) problems.push(`Handler tanpa fungsi: ${missingFns.join(', ')}`);

// ---------- 4. tidak ada alert()/confirm() yang tersisa di worker ----------
const appJs = read('js/app.js');
const alertLeft = (appJs.match(/\balert\(/g) || []).length;
const confirmLeft = (appJs.match(/\bconfirm\(/g) || []).length;
notes.push(`js/app.js: alert=${alertLeft}, confirm=${confirmLeft}`);

// ---------- 5. kontras WCAG AA untuk pasangan warna yang dipakai ----------
function hexToRgb(h) {
    const s = h.replace('#', '');
    const v = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
function lum([r, g, b]) {
    const f = (c) => {
        const x = c / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
    const [l1, l2] = [lum(hexToRgb(a)), lum(hexToRgb(b))].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
}

const surface = '#020617';
const card = '#0f172a';
const pairs = [
    ['teks utama di kartu', '#f1f5f9', card],
    ['teks utama di latar', '#f1f5f9', surface],
    ['teks sekunder di kartu', '#94a3b8', card],
    ['teks sekunder di latar', '#94a3b8', surface],
    ['teks samar (--text-faint) di kartu', '#94a3b8', card],
    ['aksen indigo di kartu', '#818cf8', card],
    ['sukses emerald di kartu', '#34d399', card],
    ['bahaya red di kartu', '#f87171', card],
    ['peringatan amber di kartu', '#fbbf24', card],
    ['teks putih di tombol primer', '#ffffff', '#4f46e5'],
    ['badge sukses (teks di tint)', '#34d399', '#0f2a34'],
    ['badge bahaya (teks di tint)', '#f87171', '#291c22'],
    ['badge peringatan (teks di tint)', '#fbbf24', '#2a2418'],
    ['badge netral (teks di tint)', '#94a3b8', '#1e293b'],
    ['teks di tombol sekunder', '#f1f5f9', '#1e293b']
];

console.log('--- Kontras (WCAG AA: normal 4.5:1, besar 3:1) ---');
pairs.forEach(([label, fg, bg]) => {
    const ratio = contrast(fg, bg);
    const verdict = ratio >= 4.5 ? 'PASS' : ratio >= 3 ? 'LULUS-besar' : 'GAGAL';
    console.log(`${ratio.toFixed(2).padStart(5)}:1  ${verdict.padEnd(11)} ${label}`);
    if (verdict === 'GAGAL') problems.push(`Kontras gagal: ${label} (${ratio.toFixed(2)}:1)`);
});

console.log('\n--- Catatan ---');
notes.forEach((n) => console.log(n));

console.log('\n--- Hasil ---');
if (problems.length === 0) {
    console.log('OK: tidak ada masalah statis yang terdeteksi.');
} else {
    problems.forEach((p) => console.log('MASALAH: ' + p));
    process.exitCode = 1;
}
