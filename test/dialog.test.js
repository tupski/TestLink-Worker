const test = require('node:test');
const assert = require('node:assert');
const dialog = require('../js/dialog.js');

test('dialog.js mengekspor showConfirmDialog dan showAlertDialog', () => {
    assert.strictEqual(typeof dialog.showConfirmDialog, 'function');
    assert.strictEqual(typeof dialog.showAlertDialog, 'function');
});

test('require dialog.js tidak menyentuh DOM saat load', () => {
    assert.ok(dialog.showConfirmDialog.length <= 1);
    assert.ok(dialog.showAlertDialog.length <= 1);
});
