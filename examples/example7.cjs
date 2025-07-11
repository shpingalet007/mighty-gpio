const r = require("mighty-gpio");
const {setInput, setOutput, watchInput} = r;

const installSocketObserver = require("./observer.cjs");
installSocketObserver(r);

r.useBroadcomScheme();
//r.setInverted();
//r.setObservers();

let sw1 = setInput(6);
let sw2 = setInput(21);
let sw3 = setInput(5);

sw1.setPud(1);
sw2.setPud(1);
sw3.setPud(1);

let led = setOutput(24);

watchInput(() => {
    if (sw1.isOn) {
        led.pulse(50);
    } else if (sw2.isOn) {
        led.pulse(200);
    } else if (sw3.isOn) {
        led.pulse(1000);
    }
});