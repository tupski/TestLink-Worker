/**
 * Unit test js/utils.js — jalankan via `npm test` (node:test, tanpa dependensi baru).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { escapeHtml, escapeAttr, isSafeHttpUrl } = require('../js/utils.js');

test('escapeHtml meng-escape karakter berbahaya', () => {
    assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    assert.equal(escapeHtml("a & b 'c'"), 'a &amp; b &#039;c&#039;');
});

test('escapeHtml: null/undefined jadi string kosong, nilai primitif lain tetap tampil', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(0), '0');
    assert.equal(escapeHtml(false), 'false');
});

test('escapeHtml: teks aman tidak berubah, entity lama ter-escape ganda', () => {
    assert.equal(escapeHtml('Halo dunia 123'), 'Halo dunia 123');
    assert.equal(escapeHtml('&amp;'), '&amp;amp;');
});

test('escapeAttr: kutip dan tag di dalam nilai atribut ter-escape', () => {
    assert.equal(escapeAttr('x" onmouseover="alert(1)'), 'x&quot; onmouseover=&quot;alert(1)');
    assert.equal(escapeAttr("'><img src=x>"), '&#039;&gt;&lt;img src=x&gt;');
});

test('isSafeHttpUrl: hanya URL absolut http/https', () => {
    assert.equal(isSafeHttpUrl('https://example.com/a?b=1#c'), true);
    assert.equal(isSafeHttpUrl('http://192.168.1.1/'), true);
    assert.equal(isSafeHttpUrl('  https://example.com  '), true);
    assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
    assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);
    assert.equal(isSafeHttpUrl('ftp://example.com'), false);
    assert.equal(isSafeHttpUrl('example.com'), false);
    assert.equal(isSafeHttpUrl('/relatif'), false);
    assert.equal(isSafeHttpUrl(''), false);
    assert.equal(isSafeHttpUrl('   '), false);
    assert.equal(isSafeHttpUrl(null), false);
    assert.equal(isSafeHttpUrl(undefined), false);
    assert.equal(isSafeHttpUrl(123), false);
});
