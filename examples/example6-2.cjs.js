const {setInput, setOutput, watchInput} = require('mighty-gpio');
const r = require("mighty-gpio");

const installSocketObserver = require("./observer.cjs");
installSocketObserver(r);

r.useBroadcomScheme();
//r.setInverted();

const sw = r.in({pin:[4, 22], index:'pin'});

sw[4].setR(1);
sw[22].setR(1);

const led = r.out({pin:[13, 19, 26, 27, 12]});

let LedOn = () => {
    let t = 0;
    led.forEach((output) => {
        t += 500;
        output.on(t);
    })
}

let LedOff = () => {
    let t = 0;
    led.forEach((output) => {
        t += 500;
        output.off(t);
    })
}

watchInput(() => {
    sw.forEach((input) => {
        if(input.pin === 4 && input.isOn){
            LedOn();
        }
        else if(input.pin === 22 && input.isOn){
            LedOff();
        }
    })
});