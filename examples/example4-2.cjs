const r = require('mighty-gpio');

const installSocketObserver = require("./observer.cjs");
installSocketObserver(r);

r.useBroadcomScheme();
//r.setInverted();

let sw1 = r.in(6), sw2 = r.in(21), sw3 = r.in(5), sw4 = r.in(16);

sw1.setR(1);
sw2.setR(1);
sw3.setR(1);
sw4.setR(1);

let led1 = r.out(13), led2 = r.out(19);

r.watchInput(() => {
    if(sw1.isOn){
        led1.on();
    }
    else if(sw2.isOn){
        led1.off();
    }
    else if(sw3.isOn){
        led2.on();
    }
    else if(sw4.isOn){
        led2.off();
    }
});