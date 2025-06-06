const r = require('mighty-gpio');

const installSocketObserver = require("../observer.cjs");
installSocketObserver(r);

r.useBroadcomScheme();
r.setInverted();

let sw = r.in(22);
sw.setR(1);

let led = r.out(24);

sw.watch((state) => {
    if (state) {
        led.on();
    } else {
        led.off();
    }
});