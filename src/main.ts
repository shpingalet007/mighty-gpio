import type ArrayGpio from "array-gpio";
import { AckEventEmitter } from "./helpers/ackevents";
import { BroadcomScheme } from "./helpers/gpio-scheme";
import {
  Callback,
  ObserversPack,
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
  public static mode = Mode.Real;
  public static inverted = false;
  public static gpioScheme = GpioScheme.Physical;

  public static events = new AckEventEmitter();
  public static gpioEvents = new EventEmitter();

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

    MightyGpio.events.removeAllListeners("state-assigned");

    MightyGpio._observers.receive?.(async (pin, state, mode, resistor) => {
      /**
       * Input and Output classes replicate this functionality differently.
       * For this reason here we would only send event that there is a pin
       * state change registered.
       */

      return await this.events.invoke(
        `state-received[${pin}]`,
        state,
        mode,
        resistor,
      );
    });

    MightyGpio.events.on(
      "state-assigned",
      (pin: number, state: boolean, mode: PinMode, resistor?: Resistor) => {
        MightyGpio._observers.send?.(pin, state, mode, resistor);
      },
    );

    MightyGpio.gpioEvents.emit("inform-state");
  }

  // Public methods

  public static setInput = (...param: [number | ArrayGpio.Option] | number[]) =>
    <InputPin>MightyGpio.initPin(param, InputPin);
  public static in = this.setInput;

  public static setOutput = (
    ...param: [number | ArrayGpio.Option] | number[]
  ) => <OutputPin>MightyGpio.initPin(param, OutputPin);
  public static out = this.setOutput;

  public static watchInput(
    ...args: [Callback | Edge, (number | Callback)?, number?]
  ) {
    const {
      edge: requestedEdge,
      callback,
      s: scanRate,
    } = this.parseWatchInputArgs(...args);

    // Assigning Infinity to resolve the first time even if set fast
    let lastReported = 0;

    MightyGpio.events.on("state-watch", (edge: Edge) => {
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
    MightyGpio.events.removeAllListeners("state-watch");
  }

  public static async ready(
    pins: InputPin | OutputPin | (InputPin | OutputPin)[],
  ) {
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

  public state: boolean = false;

  private id = Math.floor(Math.random() * 10 ** 5).toString(26);

  public isMighty: boolean = true;

  protected gpioPromise: Promise<
    (ArrayGpio.OutputPin | ArrayGpio.InputPin) | undefined
  > = Promise.resolve(undefined);

  protected gpio: (ArrayGpio.OutputPin | ArrayGpio.InputPin) | undefined;

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

    this.listenInform();

    this.pin = pin;
    this.state = false;
  }

  public ready() {
    return this.gpioPromise.then(() => true);
  }

  public close() {
    this.unhandleStateReceived();
    this.unhandleStateConfirmed();
    this.unlistenInform();

    this.mode = undefined;
    this.resistor = Resistor.NoPull;

    this.setObserverState(false);

    if (this.gpio) {
      this.gpio?.close();
      return;
    }

    (async () => {
      const hwPin = await this.gpioPromise;
      hwPin?.close();
    })();
  }

  public read(callback?: StateCallback): boolean {
    callback?.(this.state);

    return this.state;
  }

  protected handleStateReceived(handler: StateModeResistorCallback): void {
    MightyGpio.events.handle(`state-received[${this.pin}]`, handler);
  }

  protected unhandleStateReceived(): void {
    MightyGpio.events.unhandle(`state-received[${this.pin}]`);
  }

  private _informListener = () => {
    this.setObserverState(this.state);
  };

  protected listenInform(): void {
    MightyGpio.gpioEvents.on("inform-state", this._informListener);
  }

  protected unlistenInform(): void {
    MightyGpio.gpioEvents.off("inform-state", this._informListener);
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
    return MightyGpio.events
      .invoke(`state-confirmed[${this.pin}]`, edge, state)
      .catch((err) => {
        console.error(err);
      });
  }

  protected setObserverState(state: boolean, resistor?: keyof typeof Resistor) {
    MightyGpio.events.emit(
      "state-assigned",
      this.pin,
      state,
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

    // @ts-ignore
    console.log(`[MIGHTYGPIO] Input ${this.id}`);

    this.handleStateConfirmed((edge, state) => {
      MightyGpio.events.emit("state-watch", this.pin, edge, state);
      MightyGpio.events.emit(`state-watch[${this.pin}]`, edge, state);

      return true;
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

      const isLowToHigh = this.state && !prevState;
      const isHighToLow = !this.state && prevState;

      let targetEdge: Edge = Edge.Low;

      if (isLowToHigh) {
        targetEdge = Edge.High;
      } else if (isHighToLow) {
        targetEdge = Edge.Low;
      }

      this.invokeStateConfirmed(targetEdge, state);
      MightyGpio.events.emit("state-watch", this.pin, targetEdge, state);

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

    // @ts-ignore
    console.log(`[MIGHTYGPIO] Watch ${this.id}`);

    let lastReported = 0;

    MightyGpio.events.on(
      `state-watch[${this.pin}]`,
      (edge: Edge, state: boolean) => {
        // @ts-ignore
        console.log(`[MIGHTYGPIO] Signal ${this.id}`);

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
    MightyGpio.events.removeAllListeners(`state-watch[${this.pin}]`);

    // @ts-ignore
    console.log(`[MIGHTYGPIO] Unwatch ${this.id}`);

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

  public setR(value?: ResistorType) {
    if (value === undefined) {
      this.resistor = Resistor.NoPull;
    } else if (value === "pu" || value === 1) {
      this.resistor = Resistor.PullUp;
    } else if (value === "pd" || value === 0) {
      this.resistor = Resistor.PullDown;
    }

    if (this.gpio) {
      this.gpio?.setR(value);
      return;
    }

    (async () => {
      const hwPin = await this.gpioPromise;
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

    this.gpio = hwPin;

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

        this.state = state;

        if (state === prevState) return;

        const isLowToHigh = state === true && prevState === false;
        const isHighToLow = state === false && prevState === true;

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
    this.setStateWithDelay(true, ...args);
  }

  public off(...args: [(number | StateCallback)?, StateCallback?]) {
    this.setStateWithDelay(false, ...args);
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

  private setStateWithDelay(
    state: boolean,
    ...args: [(number | StateCallback)?, StateCallback?]
  ) {
    const { t: delay, callback } = this.parseOnOffArgs(...args);

    const dispatcher = (hwPin: ArrayGpio.OutputPin | undefined) => {
      const prevState = this.state;
      this.state = state;

      if (!hwPin) callback?.(state);
      else hwPin?.write(state, (state) => callback?.(state));

      const isLowToHigh = state === true && prevState === false;
      const isHighToLow = state === false && prevState === true;

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
    } else {
      setTimeout(dispatcher, delay);
    }
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

    this.gpio = hwPin;

    // Reading current hardware state as default
    this.state = !!hwPin?.state;

    return hwPin;
  }
}

const maxPinsInUse = Object.values(BroadcomScheme).length;
MightyGpio.gpioEvents.setMaxListeners(maxPinsInUse);

export const setInput = MightyGpio.setInput;
export const setOutput = MightyGpio.setOutput;
export const setInverted = MightyGpio.setInverted;
export const forceEmulation = MightyGpio.forceEmulation;
