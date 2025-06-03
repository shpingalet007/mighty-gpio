// create a raspberry pi (r) object
const r = require('mighty-gpio');
const { setInput, setOutput } = r;

let input = r.in(10);
let output = r.out(11);

let sw = setInput(12);
let led = setOutput(12);

// Difference from array-gpio is that inputs and outputs need to be closed explicitly

input.close();
output.close();
sw.close();
led.close();