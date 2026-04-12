/* Countdown berbasis deadline — interval di worker kurang ter-throttle dibanding main thread */
let iv = null;
self.onmessage = function (e) {
    if (e.data.type === 'cancel') {
        if (iv) clearInterval(iv);
        iv = null;
        return;
    }
    if (e.data.type === 'start') {
        if (iv) clearInterval(iv);
        const deadline = e.data.deadline;
        iv = setInterval(function () {
            const remaining = deadline - Date.now();
            self.postMessage({ type: 'tick', remaining: Math.max(0, remaining) });
            if (remaining <= 0) {
                clearInterval(iv);
                iv = null;
                self.postMessage({ type: 'done' });
            }
        }, 100);
    }
};
