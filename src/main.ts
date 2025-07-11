import type ArrayGpio from "array-gpio";
import { AckEventEmitter } from "./helpers/ackevents";
import { BroadcomScheme } from "./helpers/gpio-scheme";
import {
  Callback,
  ObserversPack,
  PinState,
  ResistorType,
  StateCallback,
  StateEdgeCallback,
  StateModeResistorCallback,
} from "./types/types";
import { Edge, GpioScheme, Mode, PinMode, Resistor } from "./types/enums";
import { EventEmitter } from "events";

export { ObserverHandler, ObserversPack } from "./types/types";

type BitState = 1 | true | 0 | false;

export default class MightyGpio {
  static _mode = Mode.Real;
  static _inverted = false;

  static _events = new AckEventEmitter();
  static _gpioEvents = new EventEmitter();

  static _gpioScheme = GpioScheme.Physical;

  public static arrayGpio: Promise<typeof ArrayGpio | null>;

  private static observers: ObserversPack = {};

  public static forceEmulation = () => (MightyGpio._mode = Mode.Emulated);

  public static setInverted = () => {
    if (MightyGpio._mode === Mode.Real) {
      MightyGpio._inverted = true;
    }
  };

  public static useBroadcomScheme = () => {
    MightyGpio._gpioScheme = GpioScheme.Broadcom;
  };

  public static isBroadcomScheme = () =>
    MightyGpio._gpioScheme === GpioScheme.Broadcom;

  public static supportsPeripherals = () => MightyGpio._mode === Mode.Real;

  public static supportsPWM = MightyGpio.supportsPeripherals;

  public static supportsI2C = MightyGpio.supportsPeripherals;

  public static supportsSPI = MightyGpio.supportsPeripherals;

  public static setObservers(observers: ObserversPack) {
    MightyGpio.observers = observers;

    MightyGpio._events.removeAllListeners("state-assigned");

    MightyGpio.observers.receive?.(async (pin, state, mode, resistor) => {
      /**
       * Input and Output classes replicate this functionality differently.
       * For this reason here we would only send event that there is a pin
       * state change registered.
       */

      return await MightyGpio._events.invoke(
        `state-received[${pin}]`,
        +state,
        mode,
        resistor,
      );
    });

    MightyGpio._events.on(
      "state-assigned",
      (pin: number, state: boolean, mode: PinMode, resistor?: Resistor) => {
        MightyGpio.observers.send?.(pin, state, mode, resistor);
      },
    );

    MightyGpio._gpioEvents.emit("inform-state");
  }

  // Public methods

  public static setInput = (...param: [number | ArrayGpio.Option] | number[]) =>
    <InputPin>MightyGpio.initPin(param, InputPin);
  public static in = MightyGpio.setInput;

  public static setOutput = (
    ...param: [number | ArrayGpio.Option] | number[]
  ) => <OutputPin>MightyGpio.initPin(param, OutputPin);
  public static out = MightyGpio.setOutput;

  public static watchInput(
    ...args: [Callback | Edge, (number | Callback)?, number?]
  ) {
    const {
      edge: requestedEdge,
      callback,
      s: scanRate,
    } = MightyGpio.parseWatchInputArgs(...args);

    // Assigning Infinity to resolve the first time even if set fast
    let lastReported = 0;

    MightyGpio._events.on("state-watch", (edge: Edge) => {
      const dateNow = Date.now();
      const isRateReached = lastReported + scanRate <= dateNow;
      const isTargetEdge =
        requestedEdge === edge || requestedEdge === Edge.Both;

      if (!isRateReached || !isTargetEdge) return;

      lastReported = dateNow;
      callback();
    });
  }

  public static unwatchInput() {
    MightyGpio._events.removeAllListeners("state-watch");
  }

  public static async startPWM(
    pin: number,
    freq: ArrayGpio.Frequency,
    t: number,
    pw: number,
  ) {
    MightyGpio._importArrayGpio();

    const arrayGpio = await MightyGpio.arrayGpio;

    const pwm = arrayGpio?.startPWM(pin, freq, t, pw);

    if (!pwm) {
      throw Error("PWM isn't supported in emulation mode");
    }

    return pwm;
  }

  public static async startI2C() {
    MightyGpio._importArrayGpio();

    const arrayGpio = await MightyGpio.arrayGpio;

    const i2c = arrayGpio?.startI2C();

    if (!i2c) {
      throw Error("I2C isn't supported in emulation mode");
    }

    return i2c;
  }

  public static async startSPI() {
    MightyGpio._importArrayGpio();

    const arrayGpio = await MightyGpio.arrayGpio;

    const spi = arrayGpio?.startSPI();

    if (!spi) {
      throw Error("SPI isn't supported in emulation mode");
    }

    return spi;
  }

  public static async ready(...pins: (InputPin | OutputPin)[]) {
    const prepared = [pins].flat().map((pin) => pin.ready());

    return await Promise.all(prepared).then(() => true);
  }

  // Service methods
  private static initPin(
    param: [number | ArrayGpio.Option] | number[],
    Instance: typeof InputPin | typeof OutputPin,
  ) {
    const isOnePin = param.length === 1 && typeof param[0] === "number";
    const isMultiplePins = Array.isArray(param) && param.length > 1;

    const firstParam = param[0];

    if (isOnePin) {
      return new Instance(<number>firstParam);
    }

    if (isMultiplePins) {
      return (<number[]>param).map((pin) => new Instance(pin));
    }

    if (typeof firstParam === "object") {
      const pins = firstParam.pin.map((pin) => new Instance(pin));

      if (!firstParam.index) {
        return pins;
      }

      const indexed: InputPin[] | OutputPin[] = [];

      pins.forEach((pin) => {
        indexed[pin.pin] = pin;
      });

      return indexed;
    }

    throw new Error("Invalid parameter");
  }

  private static parseWatchInputArgs(
    ...args: [Callback | Edge, (number | Callback)?, number?]
  ) {
    let edge = Edge.Both;
    let callback: Callback;
    let s: number = 100;

    if (typeof args[0] === "function") {
      // Case: watchInput(callback) or watchInput(callback, s)
      callback = args[0];
      if (typeof args[1] === "number") {
        s = args[1];
      }
    } else {
      // Case: watchInput(edge, callback) or watchInput(edge, callback, s)
      edge = args[0];
      callback = args[1] as Callback;
      if (typeof args[2] === "number") {
        s = args[2];
      }
    }

    return { edge, callback, s };
  }

  public static _importArrayGpio() {
    if (!MightyGpio.arrayGpio) {
      MightyGpio.arrayGpio = import("array-gpio")
        .then((m) => m.default)
        .catch((_) => null);
    }
  }
}

class Pin {
  protected mode: PinMode | undefined;
  protected resistor: Resistor = Resistor.NoPull;

  public state: PinState = 0;

  private id = Math.floor(Math.random() * 10 ** 5).toString(26);

  public isMighty: boolean = true;

  protected gpioPromise: Promise<
    (ArrayGpio.OutputPin | ArrayGpio.InputPin) | undefined
  > = Promise.resolve(undefined);

  protected gpio: (ArrayGpio.OutputPin | ArrayGpio.InputPin) | undefined;

  protected isHardware: boolean = false;

  get isOff(): boolean {
    return this.state === 0;
  }

  get isOn(): boolean {
    return this.state === 1;
  }

  public pin: number;

  constructor(pin: number) {
    // This import has effect only on any first GPIO use
    MightyGpio._importArrayGpio();

    this.listenInform();

    this.pin = pin;
    this.state = 0;
  }

  public ready() {
    return this.gpioPromise.then(() => this);
  }

  public close() {
    this.unhandleStateReceived();
    this.unhandleStateConfirmed();
    this.unlistenInform();

    this.mode = undefined;
    this.resistor = Resistor.NoPull;

    this.setObserverState(0);

    if (this.gpio) {
      this.gpio?.close();
      return;
    }

    (async () => {
      const hwPin = await this.gpioPromise;
      hwPin?.close();
    })();
  }

  public read(callback?: StateCallback): PinState {
    callback?.(this.state);
    return this.state;
  }

  protected handleStateReceived(handler: StateModeResistorCallback): void {
    MightyGpio._events.handle(`state-received[${this.pin}]`, handler);
  }

  protected unhandleStateReceived(): void {
    MightyGpio._events.unhandle(`state-received[${this.pin}]`);
  }

  private _informListener = () => {
    this.setObserverState(this.state);
  };

  protected listenInform(): void {
    MightyGpio._gpioEvents.on("inform-state", this._informListener);
  }

  protected unlistenInform(): void {
    MightyGpio._gpioEvents.off("inform-state", this._informListener);
  }

  protected handleStateConfirmed(handler: StateEdgeCallback): void {
    MightyGpio._events.handle(`state-confirmed[${this.pin}]`, handler);
  }

  protected unhandleStateConfirmed(): void {
    MightyGpio._events.unhandle(`state-confirmed[${this.pin}]`);
  }

  protected invokeStateConfirmed(edge: Edge, state: PinState) {
    return MightyGpio._events
      .invoke(`state-confirmed[${this.pin}]`, edge, state)
      .catch((err) => {
        console.error(err);
      });
  }

  protected setObserverState(state: PinState, resistor?: keyof typeof Resistor) {
    MightyGpio._events.emit(
      "state-assigned",
      this.pin,
      !!state,
      <PinMode>this.mode,
      resistor,
    );
  }

  protected static async getGpioPin(
    pin: number,
    mode: PinMode,
  ): Promise<ArrayGpio.OutputPin | ArrayGpio.InputPin | undefined> {
    const arrayGpio = await MightyGpio.arrayGpio;

    let gpioPin;

    if (mode === PinMode.In) {
      gpioPin = arrayGpio?.setInput(pin);
    } else {
      gpioPin = arrayGpio?.setOutput(pin);
    }

    return gpioPin;
  }
}

class InputPin extends Pin {
  protected readonly mode = PinMode.In;

  protected gpioPromise: Promise<ArrayGpio.InputPin | undefined>;
  protected gpio: ArrayGpio.InputPin | undefined;

  protected resistor: Resistor = Resistor.NoPull;

  constructor(pin: number) {
    super(pin);
    this.gpioPromise = this.initGpio(this.pin);

    this.setObserverState(this.state);

    this.handleStateConfirmed((edge, state) => {
      MightyGpio._events.emit("state-watch", this.pin, edge, state);
      MightyGpio._events.emit(`state-watch[${this.pin}]`, edge, state);

      return !!state;
    });

    this.handleStateReceived(async (state, mode, resistor) => {
      if (mode !== this.mode) return;

      const prevState = this.state;

      const isResistorCorrect = Resistor[resistor] !== this.resistor;
      const isResistorSpecified = !!resistor;

      if (isResistorSpecified && isResistorCorrect) {
        // TODO: State must not be confirmed. It is placed here just to not break handlers
        this.invokeStateConfirmed(Edge.Unknown, this.state);
        return;
      }

      if (prevState === state) {
        // TODO: State must not be confirmed. It is placed here just to not break handlers
        this.invokeStateConfirmed(Edge.Unknown, this.state);
        return;
      }

      this.state = state;

      const isLowToHigh = !!this.state && !prevState;
      const isHighToLow = !this.state && !!prevState;

      let targetEdge: Edge = Edge.Low;

      if (isLowToHigh) {
        targetEdge = Edge.High;
      } else if (isHighToLow) {
        targetEdge = Edge.Low;
      }

      this.invokeStateConfirmed(targetEdge, state);
      MightyGpio._events.emit("state-watch", this.pin, targetEdge, state);

      /**
       * We can't assign InputPin real state so just setting
       * this.state as new state and acting like it is really
       * set on hardware level.
       */
    });
  }

  public watch(
    ...args: [Edge | StateCallback, (StateCallback | number)?, number?]
  ) {
    const {
      edge: requestedEdge,
      callback,
      s: scanRate,
    } = this.parseWatchArgs(...args);

    let lastReported = 0;

    MightyGpio._events.on(
      `state-watch[${this.pin}]`,
      (edge: Edge, state: PinState) => {
        const dateNow = Date.now();
        const isRateReached = lastReported + scanRate <= dateNow;
        const isTargetEdge =
          requestedEdge === edge || requestedEdge === Edge.Both;

        if (!isRateReached || !isTargetEdge) return false;

        lastReported = dateNow;
        callback(state);
      },
    );
  }

  public unwatch() {
    this.unhandleStateConfirmed();
    MightyGpio._events.removeAllListeners(`state-watch[${this.pin}]`);

    if (this.gpio) {
      this.gpio?.unwatch();
      return;
    }

    (async () => {
      const hwPin = await this.gpioPromise;
      hwPin?.unwatch();
    })();
  }

  public close() {
    super.close();
    this.unwatch();
  }

  public setPud(value?: ResistorType) {
    if (value === undefined) {
      this.resistor = Resistor.NoPull;
    } else if (value === "pu" || value === 1) {
      this.resistor = Resistor.PullUp;
    } else if (value === "pd" || value === 0) {
      this.resistor = Resistor.PullDown;
    }

    if (this.gpio) {
      this.gpio?.setPud(value);
      return;
    }

    (async () => {
      const hwPin = await this.gpioPromise;
      hwPin?.setPud(value);
    })();
  }

  private parseWatchArgs(
    ...args: [Edge | StateCallback, StateCallback | number | undefined, number?]
  ) {
    let edge = Edge.Both;
    let callback: StateCallback;
    let s: number = 100;

    if (typeof args[0] === "function") {
      // watch(callback, s?)
      callback = args[0];
      if (typeof args[1] === "number") {
        s = args[1];
      }
    } else {
      // watch(edge, callback, s?)
      edge = args[0];
      callback = args[1] as StateCallback;
      if (typeof args[2] === "number") {
        s = args[2];
      }
    }

    return { edge, callback, s };
  }

  protected async initGpio(pin: number) {
    if (MightyGpio._mode === Mode.Emulated) return;

    if (MightyGpio._gpioScheme === GpioScheme.Broadcom) {
      pin = BroadcomScheme[pin as keyof typeof BroadcomScheme];
    }

    const hwPin = <ArrayGpio.InputPin>await Pin.getGpioPin(pin, PinMode.In);

    this.gpio = hwPin;

    this.state = +!!this.gpio?.state as PinState;
    this.isHardware = !!this.gpio;

    const MinScanRate = 1;

    let prevState = this.state;

    hwPin?.watch(
      Edge.Both,
      (state: PinState) => {
        if (MightyGpio._inverted) {
          state = +!state as PinState;
        }

        this.state = state;

        if (state === prevState) return;

        const isLowToHigh = state === 1 && prevState === 0;
        const isHighToLow = state === 0 && prevState === 1;

        if (isLowToHigh) {
          this.invokeStateConfirmed(Edge.High, state);
        } else if (isHighToLow) {
          this.invokeStateConfirmed(Edge.Low, state);
        }

        if (isLowToHigh || isHighToLow) {
          prevState = state;

          const resistorString = Resistor[
            this.resistor
          ] as keyof typeof Resistor;

          this.setObserverState(state, resistorString);
        }
      },
      MinScanRate,
    );

    return hwPin;
  }
}

class OutputPin extends Pin {
  protected readonly mode = PinMode.Out;

  protected gpioPromise: Promise<ArrayGpio.OutputPin | undefined>;
  protected gpio: ArrayGpio.OutputPin | undefined;

  constructor(pin: number) {
    super(pin);
    this.gpioPromise = this.initGpio(this.pin);

    this.setObserverState(this.state);

    this.handleStateReceived(async (state, mode) => {
      if (mode !== this.mode) return;

      const prevState = this.state;
      this.state = state;

      if (prevState === this.state) {
        // TODO: State must not be confirmed. It is placed here just to not break handlers
        this.invokeStateConfirmed(Edge.Unknown, state);
        return;
      }

      const isLowToHigh = this.state && !prevState;
      const isHighToLow = !this.state && prevState;

      let targetEdge: Edge = Edge.Low;

      if (isLowToHigh) {
        targetEdge = Edge.High;
      } else if (isHighToLow) {
        targetEdge = Edge.Low;
      }

      this.invokeStateConfirmed(targetEdge, state);

      const gpio = await this.gpioPromise;
      gpio?.write(state);
    });
  }

  public on(...args: [(number | StateCallback)?, StateCallback?]) {
    this.setStateWithDelay(1, ...args);
  }

  public off(...args: [(number | StateCallback)?, StateCallback?]) {
    this.setStateWithDelay(0, ...args);
  }

  public write(bit: BitState, callback?: StateCallback) {
    this.setStateWithDelay(+!!bit as PinState, callback);
  }

  public pulse(pw: number, callback?: Callback) {
    this.setStateWithDelay(1, () => {
      setTimeout(() => {
        this.setStateWithDelay(0, callback);
      }, pw);
    });
  }

  private setStateWithDelay(
    state: PinState,
    ...args: [(number | StateCallback)?, StateCallback?]
  ) {
    const { t: delay, callback } = this.parseOnOffArgs(...args);

    const dispatcher = (hwPin: ArrayGpio.OutputPin | undefined) => {
      const prevState = this.state;
      this.state = state;

      if (!hwPin) callback?.(state);
      else hwPin?.write(state, (state) => callback?.(state));

      const isLowToHigh = state === 1 && prevState === 0;
      const isHighToLow = state === 0 && prevState === 1;

      if (isLowToHigh || isHighToLow) {
        this.setObserverState(
          state,
          Resistor[this.resistor] as keyof typeof Resistor,
        );
      }
    };

    if (!delay) {
      if (this.gpio) {
        dispatcher(this.gpio);
        return;
      }

      return this.gpioPromise.then((gpio) => {
        dispatcher(gpio);
      });
    }

    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        this.gpioPromise.then((gpio) => {
          dispatcher(gpio);
          resolve();
        });
      }, delay);
    });
  }

  private parseOnOffArgs(...args: [(number | StateCallback)?, StateCallback?]) {
    let t = 0;
    let callback: StateCallback | undefined;

    if (typeof args[0] === "function") {
      // on(callback)
      callback = args[0];
    } else if (typeof args[0] === "number") {
      // on(t, callback?)
      t = args[0];
      if (typeof args[1] === "function") {
        callback = args[1];
      }
    }

    return { t, callback };
  }

  protected async initGpio(pin: number) {
    if (MightyGpio._mode === Mode.Emulated) return;

    if (MightyGpio._gpioScheme === GpioScheme.Broadcom) {
      pin = BroadcomScheme[pin as keyof typeof BroadcomScheme];
    }

    const hwPin = <ArrayGpio.OutputPin>await Pin.getGpioPin(pin, PinMode.Out);

    this.gpio = hwPin;

    this.state = +!!this.gpio?.state as PinState;
    this.isHardware = !!this.gpio;

    return hwPin;
  }
}

const maxPinsInUse = Object.values(BroadcomScheme).length;
MightyGpio._gpioEvents.setMaxListeners(maxPinsInUse);

export const setInput = MightyGpio.setInput;
export { setInput as in };

export const setOutput = MightyGpio.setOutput;
export const out = MightyGpio.setOutput;

export const watchInput = MightyGpio.watchInput;

export const setInverted = MightyGpio.setInverted;
export const forceEmulation = MightyGpio.forceEmulation;
export const useBroadcomScheme = MightyGpio.useBroadcomScheme;
export const setObservers = MightyGpio.setObservers;
export const ready = MightyGpio.ready;

export const startPWM = MightyGpio.startPWM;
export const startSPI = MightyGpio.startSPI;
export const startI2C = MightyGpio.startI2C;
