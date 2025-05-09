import type ArrayGpio from "array-gpio";
import { AckEventEmitter } from "./helpers/ackevents";
import { BroadcomScheme } from "./helpers/gpio-scheme";
import { Edge, Resistor } from "./types/enums";
import {
  Callback,
  ObserverHandler,
  RemoteObserverHandler,
  ResistorType,
  StateCallback,
  StateEdgeCallback,
} from "./types/types";

export { Edge, Resistor } from "./types/enums";

interface ObserversPack {
  send?: ObserverHandler;
  receive?: RemoteObserverHandler;
}

enum Mode {
  Real = "real",
  Emulated = "emulated",
}

type BitState = 1 | true | 0 | false;

enum PinMode {
  Out = "out",
  In = "in",
}

enum GpioScheme {
  Physical = "physical",
  Broadcom = "broadcom",
}

export class MightyGpio {
  static mode = Mode.Real;
  static inverted = false;
  static gpioScheme = GpioScheme.Physical;

  public static events = new AckEventEmitter();

  public static arrayGpio: Promise<typeof ArrayGpio | null>;

  private static _observers: ObserversPack = {};

  public static forceEmulation = () => (this.mode = Mode.Emulated);

  public static setInverted = () => {
    if (this.mode === Mode.Real) {
      MightyGpio.inverted = true;
    }
  };

  public static useBroadcomScheme = () => {
    this.gpioScheme = GpioScheme.Broadcom;
  };

  public static isBroadcomScheme = () =>
    this.gpioScheme === GpioScheme.Broadcom;

  public static setObservers(observers: ObserversPack) {
    MightyGpio._observers = observers;

    MightyGpio._observers.receive?.(async (pin, state) => {
      /**
       * Input and Output classes replicate this functionality differently.
       * For this reason here we would only send event that there is a pin
       * state change registered.
       */

      return await this.events.invoke(`state-received[${pin}]`, state);
    });

    MightyGpio.events.on("state-assigned", (pin: number, state: boolean) => {
      MightyGpio._observers.send?.(pin, state);
    });
  }

  // Public methods

  public static setInput = (pin: number) => new InputPin(pin);
  public static in = this.setInput;

  public static setOutput = (pin: number) => new OutputPin(pin);
  public static out = this.setOutput;

  public static watchInput(
    ...args: [Callback | Edge, (number | Callback)?, number?]
  ) {
    const {
      edge: requestedEdge,
      callback,
      s: scanRate,
    } = this.parseWatchInputArgs(...args);

    let lastReported = Date.now();

    MightyGpio.events.on(
      "state-watch",
      (pin: number, edge: Edge, state: boolean) => {
        const dateNow = Date.now();
        const isRateReached = lastReported + scanRate > dateNow;
        const isTargetEdge = requestedEdge === edge;

        if (!isRateReached || !isTargetEdge) return;

        lastReported = dateNow;
        callback();
      },
    );
  }

  public static unwatchInput() {
    MightyGpio.events.removeAllListeners("state-watch");
  }

  // Service methods

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
  public isMighty: boolean = true;

  protected gpio: Promise<
    (ArrayGpio.OutputPin | ArrayGpio.InputPin) | undefined
  > = Promise.resolve(undefined);

  protected resistor?: Resistor = Resistor.PullDown;

  protected state: boolean = false;
  protected isHardware: boolean = false;

  get isOff(): boolean {
    return !this.state;
  }

  get isOn(): boolean {
    return this.state;
  }

  public pin: number;

  constructor(pin: number) {
    // This import has effect only on any first GPIO use
    MightyGpio._importArrayGpio();

    this.pin = pin;
    this.state = false;
  }

  public close() {
    this.unhandleStateReceived();
    this.unhandleStateConfirmed();

    (async () => {
      const hwPin = await this.gpio;
      hwPin?.close();
    })();
  }

  public read(callback?: StateCallback): void {
    callback?.(this.state);
  }

  protected handleStateReceived(handler: StateCallback): void {
    MightyGpio.events.handle(`state-received[${this.pin}]`, handler);
  }

  protected unhandleStateReceived(): void {
    MightyGpio.events.unhandle(`state-received[${this.pin}]`);
  }

  protected invokeStateReceived(state: boolean) {
    return MightyGpio.events.invoke(`state-received[${this.pin}]`, state);
  }

  protected handleStateConfirmed(handler: StateEdgeCallback): void {
    MightyGpio.events.handle(`state-confirmed[${this.pin}]`, handler);
  }

  protected unhandleStateConfirmed(): void {
    MightyGpio.events.unhandle(`state-confirmed[${this.pin}]`);
  }

  protected invokeStateConfirmed(edge: Edge, state: boolean) {
    return MightyGpio.events.invoke(
      `state-confirmed[${this.pin}]`,
      edge,
      state,
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

export class InputPin extends Pin {
  protected gpio: Promise<ArrayGpio.InputPin | undefined>;

  constructor(pin: number) {
    super(pin);
    this.gpio = this.initGpio(this.pin);

    this.handleStateReceived((state) => {
      const prevState = this.state;
      this.state = state;

      if (prevState === this.state) return;

      const isLowToHigh = this.state === true && prevState === false;
      const isHighToLow = this.state === false && prevState === true;

      if (isLowToHigh) {
        this.invokeStateConfirmed(Edge.High, state);
      } else if (isHighToLow) {
        this.invokeStateConfirmed(Edge.Low, state);
      }

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

    let lastReported = Date.now();

    this.handleStateConfirmed((edge, state) => {
      const dateNow = Date.now();
      const isRateReached = lastReported + scanRate <= dateNow;
      const isTargetEdge =
        requestedEdge === edge || requestedEdge === Edge.Both;

      if (!isRateReached || !isTargetEdge) return false;

      lastReported = dateNow;
      callback(state);

      MightyGpio.events.emit("state-watch", this.pin, edge, state);

      return true;
    });
  }

  public unwatch() {
    this.unhandleStateConfirmed();

    (async() => {
      const hwPin = await this.gpio;
      hwPin?.unwatch();
    })();
  }

  public setR(value: ResistorType) {
    switch (value) {
      case "pu":
        this.resistor = Resistor.PullUp;
        break;
      case "pd":
        this.resistor = Resistor.PullDown;
        break;
      default:
        this.resistor = value;
    }

    (async () => {
      const hwPin = await this.gpio;
      hwPin?.setR(value);
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
    if (MightyGpio.mode === Mode.Emulated) return;

    if (MightyGpio.gpioScheme === GpioScheme.Broadcom) {
      pin = BroadcomScheme[pin as keyof typeof BroadcomScheme];
    }

    const hwPin = <ArrayGpio.InputPin>await Pin.getGpioPin(pin, PinMode.In);

    // Reading current hardware state as default
    const currentState = !!hwPin?.state;

    if (hwPin) {
      this.state = !currentState;
      this.isHardware = true;
    } else {
      this.state = currentState;
    }

    const MinScanRate = 1;

    let prevState = this.state;

    hwPin?.watch(
      Edge.Both,
      (state: boolean) => {
        if (MightyGpio.inverted) {
          state = !state;
        }

        if (state === prevState) return;

        const isLowToHigh = state === true && prevState === false;
        const isHighToLow = state === false && prevState === true;

        if (isLowToHigh) {
          this.invokeStateConfirmed(Edge.High, state);
        } else if (isHighToLow) {
          this.invokeStateConfirmed(Edge.Low, state);
        }

        prevState = state;
      },
      MinScanRate,
    );

    return hwPin;
  }
}

export class OutputPin extends Pin {
  protected gpio: Promise<ArrayGpio.OutputPin | undefined>;

  constructor(pin: number) {
    super(pin);
    this.gpio = this.initGpio(this.pin);

    this.handleStateReceived(async (state) => {
      const prevState = this.state;
      this.state = state;

      if (prevState === this.state) {
        this.invokeStateConfirmed(Edge.Unknown, state);
        return;
      }

      const isLowToHigh = this.state === true && prevState === false;
      const isHighToLow = this.state === false && prevState === true;

      if (isLowToHigh) {
        this.invokeStateConfirmed(Edge.High, state);
      } else if (isHighToLow) {
        this.invokeStateConfirmed(Edge.Low, state);
      }

      const gpio = await this.gpio;
      gpio?.write(state);
    });

    this.handleStateConfirmed((edge, state) => {
      MightyGpio.events.emit("state-watch", this.pin, edge, state);
    });
  }

  public on(...args: [(number | StateCallback)?, StateCallback?]) {
    this.setStateWithDelay(true, ...args);
  }

  public off(...args: [(number | StateCallback)?, StateCallback?]) {
    this.setStateWithDelay(false, ...args);
  }

  private setStateWithDelay(
    state: boolean,
    ...args: [(number | StateCallback)?, StateCallback?]
  ) {
    const { t: delay, callback } = this.parseOnOffArgs(...args);

    const dispatcher = async () => {
      const hwPin = await this.gpio;

      if (!hwPin) callback?.(state);
      else hwPin?.write(state, (state) => callback?.(state));

      const prevState = this.state;
      this.state = state;

      const isLowToHigh = state === true && prevState === false;
      const isHighToLow = state === false && prevState === true;

      if (isLowToHigh) {
        //this.invokeStateConfirmed(Edge.High, state);
        MightyGpio.events.emit("state-assigned", this.pin, state);
      } else if (isHighToLow) {
        //this.invokeStateConfirmed(Edge.Low, state);
        MightyGpio.events.emit("state-assigned", this.pin, state);
      }
    };

    if (!delay) {
      dispatcher();
    } else {
      setTimeout(dispatcher, delay);
    }
  }

  public write(bit: BitState, callback?: StateCallback) {
    this.setStateWithDelay(!!bit, callback);
  }

  public pulse(pw: number, callback?: Callback) {
    this.setStateWithDelay(true, () => {
      setTimeout(() => {
        this.setStateWithDelay(false, callback);
      }, pw);
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
    if (MightyGpio.mode === Mode.Emulated) return;

    if (MightyGpio.gpioScheme === GpioScheme.Broadcom) {
      pin = BroadcomScheme[pin as keyof typeof BroadcomScheme];
    }

    const hwPin = <ArrayGpio.OutputPin>await Pin.getGpioPin(pin, PinMode.Out);

    // Reading current hardware state as default
    this.state = !!hwPin?.state;

    return hwPin;
  }
}

export const setInput = MightyGpio.setInput;
export const setOutput = MightyGpio.setOutput;

export { ObserverHandler } from "./types/types";
