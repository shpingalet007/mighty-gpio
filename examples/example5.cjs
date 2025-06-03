const r = require('mighty-gpio');
const {setInput, setOutput, watchInput} = r;

const installSocketObserver = require("./observer.cjs");
installSocketObserver(r);

r.useBroadcomScheme();
//r.setInverted();

let sw1 = setInput(6);
let sw2 = setInput(21);

//sw1.setR(1);
//sw2.setR(1);

let led = setOutput(13);

watchInput(() => {
    if (sw1.isOn) {
        led.on(1000);
    } else if (sw2.isOn) {
        led.off(500);
    }
});