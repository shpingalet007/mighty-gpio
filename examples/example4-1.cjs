const r = require('mighty-gpio');

const installSocketObserver = require("./observer.cjs");
installSocketObserver(r);

r.useBroadcomScheme();
//r.setInverted();

let sw1 = r.in(6), sw2 = r.in(21);

sw1.setR(1);
sw2.setR(1);

let led1 = r.out(13), led2 = r.out(19);

r.watchInput(() => {
    if (sw1.isOn) {
        led1.on();
    } else if (sw1.isOff) {
        led1.off();
    }

    if (sw2.isOn) {
        led2.on();
    } else if (sw2.isOff) {
        led2.off();
    }
});