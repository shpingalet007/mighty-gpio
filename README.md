# mighty-gpio

> Emulate GPIO hardware on Raspberry Pi. Debug smarter. Build faster.

`mighty-gpio` is an emulation layer for [array-gpio](https://www.npmjs.com/package/array-gpio) that lets you develop and test GPIO-based Node.js applications without needing physical Raspberry Pi hardware.

Working with GPIO usually means testing on real devices — which slows things down. Every change means redeploying, reconnecting, and manually verifying the results.

This module helps by wrapping the `array-gpio` API in software. You can run your app directly on your dev machine (macOS, Windows, or Linux), and it will behave as if it is Raspberry Pi with GPIO. If actual hardware is available, it uses it. If not, it automatically switches to simulation mode — no need to change your code.

## ✨ Features
- **Same API as `array-gpio`** — keep your existing code.
- **Run locally** without needing a Raspberry Pi during development.
- **Built-in web UI** (via Socket.io example) for monitoring and controlling GPIO states.
- **Useful for writing unit tests** that depend on GPIO signals.
- **Supports "observer" mode** to monitor hardware signals and forward them elsewhere.
- **Fully supports TypeScript** — works out of the box with typings and type checking.

Great for prototyping, debugging, or writing tests for IoT and hardware-related Node.js projects.

> ## ⚠️ Limitations
> PWM, I2C, and SPI are not supported in emulation mode. You’ll still need real hardware to test those.
> Some helper methods are available to check if peripherals are supported at runtime. See the docs for details.

# Documentation

Consider checking `array-gpio` documentation. In this documentation would be covered only extra methods, mechanics and
differences between official documentation.

## Mechanics differences

This module requires the use of `async/await` for pin initialization. This change was necessary due to how the internal mechanics work — it couldn’t be done differently, unfortunately.

This means some method calls are slightly different compared to the original module. There are two ways to initialize pins:

```js
const mighty = require("mighty-gpio");

// Option 1 — Call .ready() on each pin
const btn = await mighty.in(10).ready();
const led = await mighty.out(20).ready();

// Option 2 — Group initialization using mighty.ready()
const btn = mighty.in(10);
const led = mighty.out(20);

await mighty.ready(btn, led);

// Then use the pins normally
btn.watch(1, () => {
    led.pulse(1000);
});
```

> ⚠️ Technically, you don't have to await a pin's .ready() if you don't access its state immediately. But it's strongly
> discouraged. Delaying initialization can lead to race conditions or unexpected behavior. Always prefer resolving the
> initialization promise before using the pin.


## Specific to mighty-gpio methods

### setObservers({ sendHandler, receiveHandler })
Observer handlers are set using this function.

### setInverted()
This method introduces ability to invert GPIO states. Some hardware might mess the states and in this case method can
be useful.

### useBroadcomScheme()
This method allows to use Broadcom pins scheme numbering. It can be easier to debug.

### forceEmulation()
This method forces emulation mode. Either if the software is able to use GPIO, this method forces it in emulated mode.

### isBroadcomScheme()
Checks if Broadcom pins scheme numbering is used.

### ready(...pins) or pin.ready()
This async method allows to check pins for readiness.

### supportsPeripherals()
Might be used to gracefully condition use PWM, I2C and SPI only on real device.

### supportsPWM()
At the moment just alias to `supportsPeripherals()`, but in future when some peripherals would be emulated, could be
used to specifically check PWM.

### supportsI2C()
At the moment just alias to `supportsPeripherals()`, but in future when some peripherals would be emulated, could be
used to specifically check I2C.

### supportsSPI()
At the moment just alias to `supportsPeripherals()`, but in future when some peripherals would be emulated, could be
used to specifically check SPI.