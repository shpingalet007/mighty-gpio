import type * as MightyGpioDeclaration from "mighty-gpio";

import _MightyGpio from "../../src/main";
const MightyGpio = (<unknown>_MightyGpio) as typeof MightyGpioDeclaration;

const in22 = MightyGpio.setInput(15);
const in14 = MightyGpio.setInput(7);

in22.watch(() => {
  console.log("All listener 1");
});

in22.watch(() => {
  console.log("All listener 2");
});

in22.watch(1, () => {
  console.log("High 1 listener");
});

in22.watch(1, () => {
  console.log("High 2 listener");
});

in22.watch(0, () => {
  console.log("Low 1 listener");
});

in22.watch(0, () => {
  console.log("Low 2 listener");
});

in14.watch(0, () => {
  in22.unwatch();
});
