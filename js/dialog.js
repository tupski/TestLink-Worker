/**
 * Dialog konfirmasi dan pemberitahuan, pengganti confirm()/alert() native.
 * Satu elemen dialog di-reuse. Fokus terperangkap di dalam dialog, Escape membatalkan,
 * fokus kembali ke elemen pemicu setelah dialog tertutup.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        const api = factory();
        root.showConfirmDialog = api.showConfirmDialog;
        root.showAlertDialog = api.showAlertDialog;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    let host = null;
    let els = null;
    let active = null;

    function prefersReducedMotion() {
        return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function build() {
        if (host) return;
        host = document.createElement('div');
        host.className = 'hidden fixed inset-0 bg-slate-950/85 z-[2100] flex items-center justify-center p-4';
        host.setAttribute('role', 'alertdialog');
        host.setAttribute('aria-modal', 'true');
        host.setAttribute('aria-labelledby', 'dlgTitle');
        host.setAttribute('aria-describedby', 'dlgMsg');
        host.innerHTML = `
            <div class="card w-full max-w-sm">
                <h3 id="dlgTitle" class="text-base font-bold text-white mb-2"></h3>
                <p id="dlgMsg" class="text-sm text-slate-400 mb-6 leading-relaxed whitespace-pre-line"></p>
                <div class="flex gap-3">
                    <button type="button" class="btn btn--secondary flex-1" data-dlg-cancel></button>
                    <button type="button" class="btn flex-1" data-dlg-confirm></button>
                </div>
            </div>`;
        document.body.appendChild(host);
        els = {
            title: host.querySelector('#dlgTitle'),
            msg: host.querySelector('#dlgMsg'),
            cancel: host.querySelector('[data-dlg-cancel]'),
            confirm: host.querySelector('[data-dlg-confirm]')
        };
        els.cancel.addEventListener('click', () => settle(false));
        els.confirm.addEventListener('click', () => settle(true));
        host.addEventListener('click', (e) => {
            if (e.target === host) settle(false);
        });
        // Listener di document, bukan host: Escape tetap bekerja walau fokus
        // sempat keluar dialog (mis. lewat tombol browser), sama seperti confirm() native.
        document.addEventListener('keydown', onKeydown);
    }

    function onKeydown(e) {
        if (!active) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            settle(false);
            return;
        }
        if (e.key !== 'Tab') return;
        const first = els.cancel.classList.contains('hidden') ? els.confirm : els.cancel;
        const last = els.confirm;
        if (!host.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    function settle(result) {
        if (!active) return;
        const { resolve, prevFocus, prevOverflow } = active;
        active = null;
        const dur = prefersReducedMotion() ? 0 : 160;
        host.style.opacity = '0';
        setTimeout(() => {
            host.classList.add('hidden');
            host.style.opacity = '';
            document.body.style.overflow = prevOverflow;
            if (prevFocus && prevFocus.isConnected) prevFocus.focus();
            resolve(result);
        }, dur);
    }

    function open(opts) {
        build();
        if (active) return Promise.resolve(false);
        return new Promise((resolve) => {
            active = {
                resolve,
                prevFocus: document.activeElement,
                prevOverflow: document.body.style.overflow
            };
            els.title.textContent = opts.title || '';
            els.msg.textContent = opts.message || '';
            els.confirm.textContent = opts.confirmText || 'Lanjutkan';
            els.confirm.className = opts.danger === false ? 'btn btn--primary flex-1' : 'btn btn--danger flex-1';
            els.cancel.textContent = opts.cancelText || 'Batal';
            els.cancel.classList.toggle('hidden', opts.alert === true);
            host.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            if (prefersReducedMotion()) {
                host.style.opacity = '';
            } else {
                host.style.transition = 'opacity 160ms ease';
                host.style.opacity = '0';
                requestAnimationFrame(() => {
                    host.style.opacity = '1';
                });
            }
            (opts.alert ? els.confirm : els.cancel).focus();
        });
    }

    function showConfirmDialog(opts) {
        return open(Object.assign({}, opts, { alert: false }));
    }

    function showAlertDialog(opts) {
        return open(Object.assign({ confirmText: 'Mengerti' }, opts, { alert: true, danger: false }));
    }

    return { showConfirmDialog, showAlertDialog };
});
