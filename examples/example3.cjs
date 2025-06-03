const r = require('mighty-gpio');

let sw = r.in(11);
let led = r.out(33);

// Difference from array-gpio is that inputs and outputs initialization is async
// Call ready() to be sure that pins are ready

r.ready(sw, led).then(() => {
    console.log(sw.isOn); // false
    console.log(led.isOn); // false

    console.log(sw.isOff); // true
    console.log(led.isOff); // true
});