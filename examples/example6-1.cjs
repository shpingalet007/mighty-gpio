const r = require('mighty-gpio');

const installSocketObserver = require("./observer.cjs");
installSocketObserver(r);

r.useBroadcomScheme();
//r.setInverted();

const sw = r.in({pin:[4, 22], index:'pin'});

sw[4].setPud(1);
sw[22].setPud(1);

const led = r.out({pin:[13, 19, 26, 27, 12]});

let LedOn = () => {
    let t = 0;

    for (let x in led) {
        t += 500;
        led[x].on(t);
    }
}

let LedOff = () => {
    let t = 0;

    for (let x in led) {
        t += 500;
        led[x].off(t);
    }
}

r.watchInput(() => {
    if (sw[4].isOn) {
        LedOn();
    } else if (sw[22].isOn) {
        LedOff();
    }
});