/**
 * Utilities untuk menentukan root direktori proyek
 */
const path = require('path');
const fs = require('fs');

/**
 * Menentukan root direktori proyek
 * Mendukung berbagai environment: local, Vercel, Docker
 * @returns {string} Path absolut ke root direktori proyek
 */
function resolveProjectRoot() {
    // 1. Coba dari process.cwd() (seringkali root di Vercel)
    const cwd = process.cwd();
    if (fs.existsSync(path.join(cwd, 'index.html'))) return cwd;

    // 2. Coba naik dari __dirname (jika di api/index.js)
    let dir = path.resolve(__dirname);
    if (dir.endsWith('api')) dir = path.dirname(dir);
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;

    // 3. Fallback standar
    return path.resolve(path.join(__dirname, '..'));
}

module.exports = {
    resolveProjectRoot
};