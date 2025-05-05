import { EventEmitter } from "events";
import type ArrayGpio from "array-gpio";

// TODO: Move types

export enum Mode {
  Auto = "auto",
  Real = "real",
  Emulated = "emulated",
  // Experimental = 'experimental',
}

enum Resistor {
  PullDown,
  PullUp,
}

enum PinType {
  Input = "input",
  Output = "output",
}

export enum Edge {
  Low = 0,
  High = 1,
  Both = "both",
}

type ResistorType = Resistor | "pu" | "pd";

type StateCallback = (state: boolean) => void;
export type HandlerCallback = (pin: number, state: boolean) => Promise<boolean>;
type Callback = () => void;

type ObserverHandler = (pin: number, state: boolean) => Promise<boolean>;
type RemoteObserverHandler = (handler: HandlerCallback) => void;
type BitState = 1 | true | 0 | false;

interface ObserversPack {
  send?: ObserverHandler;
  receive?: RemoteObserverHandler;
}

export class MightyGpio {
  static StaleTime = 10 * 1000;

  public static mode = Mode.Auto;
  public static inverted = false;
  public static events = new EventEmitter();

  static arrayGpio: Promise<typeof ArrayGpio | null>;

  private static _observers: ObserversPack = {};

  public static setMode(mode: Mode) {
    MightyGpio.mode = mode;
  }

  public static setInverted() {
    MightyGpio.inverted = true;
  }

  public static setObservers(observers: ObserversPack) {
    MightyGpio._observers = observers;

    MightyGpio._observers.receive?.((pinNumber, state) => {
      if (MightyGpio.inverted) {
        state = !state;
      }

      return new Promise((resolve: (state: boolean) => void, reject) => {
        this.events.once(
          `pin[${pinNumber}]:observer:receive:confirm`,
          (state: boolean) => resolve(state),
        );

        //console.log('[DBG] Receive', pinNumber, state);
        this.events.emit(`pin[${pinNumber}]:observer:receive`, state);
      });
    });

    this.events.removeAllListeners("pin:observer:send");

    this.events.on(
      "pin:observer:send",
      async (pinNumber: number, state: boolean) => {
        if (MightyGpio.inverted) {
          state = !state;
        }

        await MightyGpio._observers.send?.(pinNumber, state);
        this.events.emit(`pin[${pinNumber}]:observer:send:confirm`, state);
      },
    );
  }

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

    MightyGpio.unwatchInput();

    let lastReported = Date.now();

    MightyGpio.events.on("pin:watch", (edge: Edge) => {
      const dateNow = Date.now();
      const isRateReached = lastReported + scanRate > dateNow;
      const isTargetEdge = requestedEdge === edge;

      if (isRateReached || isTargetEdge) return;

      lastReported = dateNow;
      callback();
    });
  }

  public static unwatchInput() {
    MightyGpio.events.removeAllListeners("pin:watch");
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
  public isMighty: boolean = true;

  protected gpio: Promise<
    (ArrayGpio.OutputPin | ArrayGpio.InputPin) | undefined
  > = Promise.resolve(undefined);

  protected resistor?: Resistor = Resistor.PullDown;

  protected _state: boolean = false;

  protected get state(): boolean {
    return this._state;
  }

  protected set state(value: boolean) {
    this.setState(value);
  }

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

    MightyGpio.events.on(
      `pin[${this.pin}]:observer:receive`,
      (state: boolean) => {
        console.log('[DBG] Pin Watcher');

        this.setStateSilent(state);

        MightyGpio.events.emit(
          `pin[${this.pin}]:observer:receive:confirm`,
          state,
        );
      },
    );
  }

  public close() {
    this.gpio?.then((gpio) => {
      gpio?.close();
    });
  }

  public read(callback?: StateCallback): void {
    callback?.(this.state);
  }

  protected sendEvent(state: boolean, edge?: Edge) {
    MightyGpio.events.emit("pin:observer:send", this.pin, state, edge);
  }

  private async receiveEvent(): Promise<void> {
    return new Promise((resolve: () => void, reject) => {
      if (MightyGpio.mode === Mode.Emulated) {
        setTimeout(() => {
          // TODO: Enable stale again after debug 01 may 2025
          // reject(Error("Event Receive is stale"));
        }, MightyGpio.StaleTime);

        return;
      }

      resolve();
    });
  }

  private setRemoteState(state: boolean) {
    this.sendEvent(state);

    const responsePromise = this.receiveEvent();

    if (MightyGpio.mode === Mode.Emulated) {
      return responsePromise;
    }

    return Promise.resolve();
  }

  /*private async sendStateToObserver(state: boolean) {
    if (MightyGpio.mode === Mode.Emulated) {
      const result = await MightyGpio._observers.send?.(this.pin, state);

      if (result === undefined) throw Error("STATE_ERROR");

      this.setStateSilent(result);

      return result;
    }

    // TODO: This must be removed
    return this.state;
  }*/

  protected setStateSilent(state: boolean) {
    this._state = state;
  }

  protected async setState(value: boolean) {
    this.setStateSilent(value);
    await this.setRemoteState(value);
    return this.state;
  }
}

export class InputPin extends Pin {
  protected watcher?: NodeJS.Timeout;
  protected gpio: Promise<ArrayGpio.InputPin | undefined>;

  constructor(pin: number) {
    super(pin);
    this.gpio = this.initGpio(pin);

    this.gpio.then((gpio) => {
      console.log('GPIO INPUT WATCH HACK');

      gpio?.watch((state) => {
        this.setState(state);
        MightyGpio.events.emit(`pin[${this.pin}]:dispatch:watch`, state);
      }, 1);
    });

    // @ts-ignore
    /*const getState = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this.gpio), 'state').bind(this.gpio);

    Object.defineProperty(this.gpio, 'state', {
      set(newVal) {
        this._value = newVal;
      },
      get() {
        getState();
        return this._value;
      },
      configurable: true,
      enumerable: true,
    });*/
  }

  public watch(
    ...args: [Edge | StateCallback, (StateCallback | number)?, number?]
  ) {
    const {
      edge: requestedEdge,
      callback,
      s: scanRate,
    } = this.parseWatchArgs(...args);

    this.unwatch();

    let lastReported = Date.now();
    let prevState = this.state;

    const dispatchEvent = (state: boolean) => {
      console.log('[DBG] InputPin Watcher');

      const dateNow = Date.now();
      const isRateReached = lastReported + scanRate <= dateNow;

      if (!isRateReached) return;

      const isLowToHigh = this.state === true && prevState === false;
      const isHighToLow = this.state === false && prevState === true;
      const isStateNotSame = isLowToHigh || isHighToLow;

      console.log(`[DBG] CURR= ${this.state} PREV=${prevState}`);

      prevState = this.state;

      console.log(`[DBG] LH? ${isLowToHigh} HL? ${isHighToLow}`);
      if (!isLowToHigh && !isHighToLow) return;

      const forHigh = requestedEdge === Edge.High && isLowToHigh;
      const forLow = requestedEdge === Edge.Low && isHighToLow;
      const forAny = requestedEdge === "both" && isStateNotSame;

      console.log('[DBG] Callback?', forAny || forHigh || forLow);
      console.log('[DBG] Checks', forAny, forHigh, forLow);
      console.log('[DBG] State is now', this.state);
      if (forAny || forHigh || forLow) {
        callback(this.state);
        lastReported = dateNow;
      }
    };

    MightyGpio.events.on(`pin[${this.pin}]:dispatch:watch`, dispatchEvent);
    MightyGpio.events.on(`pin[${this.pin}]:observer:receive`, dispatchEvent);



    /*MightyGpio.events.on(
      `pin[${this.pin}]:observer:receive`,
      (state: boolean) => {
        // TODO: Check if state is ok to remove
        const dateNow = Date.now();
        const isRateReached = lastReported + scanRate > dateNow;

        if (!isRateReached) return;

        const isLowToHigh = this.state && !prevState;
        const isHighToLow = !this.state && prevState;

        if (!isLowToHigh && !isHighToLow) return;

        const forHigh = requestedEdge === 1 && isLowToHigh;
        const forLow = requestedEdge === 0 && isHighToLow;
        const forAny = requestedEdge === "both" && this.state !== prevState;

        if (forHigh || forLow || forAny) {
          callback(this.state);
          MightyGpio.events.emit(
            "pin:watch",
            requestedEdge,
            this.pin,
            this.state,
          );
        }
      },
    );*/
  }

  public unwatch() {
    clearInterval(this.watcher);
  }

  public close() {
    this.unwatch();
    super.close();
  }

  public setR(value: ResistorType) {
    switch (value) {
      case "pu":
        this.resistor = 1;
        break;
      case "pd":
        this.resistor = 0;
        break;
      default:
        this.resistor = value;
    }
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

  // FIXME: This method is not possible as the state is not assignable
  /*protected async setState(value: boolean): Promise<boolean> {
    const state = await super.setState(value);

    //const gpio = <ArrayGpio.InputPin> await this.gpio;
    //gpio.state = state;

    return state;
  }*/

  private async initGpio(pin: number) {
    const arrayGpio = await MightyGpio.arrayGpio;
    const rawGpio = arrayGpio?.setInput(pin);

    const gpio = <ArrayGpio.InputPin> rawGpio;

    this.setStateSilent(!!gpio?.state);

    gpio?.watch(
      Edge.Both,
      (state: boolean) => {
        this.setStateSilent(state);
      },
      1,
    );

    return gpio;
  }
}

export class OutputPin extends Pin {
  protected gpio: Promise<ArrayGpio.OutputPin | undefined>;

  constructor(pin: number) {
    super(pin);
    this.gpio = this.initGpio(pin);
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
    const { t, callback } = this.parseOnOffArgs(...args);

    const asyncProcessor = async () => {
      await this.setState(state);
      callback?.(this.state);
    };

    if (t === 0) {
      asyncProcessor();
    } else {
      setTimeout(asyncProcessor, t);
    }
  }

  public write(bit: BitState, callback?: StateCallback) {
    this.state = !!bit;
    callback?.(this.state);
  }

  public pulse(pw: number, callback?: Callback) {
    const asyncProcessor = async () => {
      await this.setState(true);

      setTimeout(async () => {
        await this.setState(false);
        callback?.();
      }, pw);
    };

    asyncProcessor();
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

  protected async setState(value: boolean) {
    await super.setState(value);

    const gpio = await this.gpio;

    return new Promise((resolve: StateCallback, reject) => {
      if (gpio) {
        gpio.write(value, resolve);
        return;
      }

      resolve(this.state);
    });
  }

  private async initGpio(pin: number) {
    const rawGpio = await MightyGpio.arrayGpio?.then((arrayGpio) =>
      arrayGpio?.setOutput(pin),
    );

    const gpio = <ArrayGpio.OutputPin>rawGpio;
    this._state = !!gpio?.state;

    return gpio;
  }
}

export const setInput = MightyGpio.setInput;
export const setOutput = MightyGpio.setOutput;