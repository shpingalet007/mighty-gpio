import { EventEmitter } from "events";
import arrayGpio from "array-gpio";

enum Mode {
  Auto = "auto",
  Real = "real",
  Emulated = "emulated",
  // Experimental = 'experimental',
}

enum Resistor {
  PullDown,
  PullUp,
}

type ResistorType = Resistor | "pu" | "pd";

type StateCallback = (state: boolean) => void;
type HandlerCallback = (pin: number, state: boolean) => Promise<boolean>;
type Callback = () => void;

type ObserverHandler = (pin: number, state: boolean) => Promise<boolean>;
type RemoteObserverHandler = (handler: HandlerCallback) => void;
type Edge = 0 | 1 | "both";
type BitState = 1 | true | 0 | false;

interface ObserversPack {
  send?: ObserverHandler;
  receive?: RemoteObserverHandler;
}

class MightyGpio {
  static StaleTime = 10 * 1000;

  public static mode = Mode.Auto;
  public static events = new EventEmitter();

  private static _observers: ObserversPack = {};

  public static setMode(mode: Mode) {
    MightyGpio.mode = mode;
  }

  public static setObservers(observers: ObserversPack) {
    MightyGpio._observers = observers;

    MightyGpio._observers.receive?.((pinNumber, state) => {
      return new Promise((resolve: (state: boolean) => void, reject) => {
        this.events.on(
          `pin[${pinNumber}]:observer:receive:confirm`,
          (state: boolean) => resolve(state)
        );

        this.events.emit(`pin[${pinNumber}]:observer:receive`, state);
      });
    });

    this.events.on(
      "pin:observer:send",
      async (pinNumber: number, state: boolean) => {
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
    let edge: Edge = "both";
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
}

class Pin {
  public isMighty: boolean = true;

  protected resistor?: Resistor = Resistor.PullDown;

  private _state: boolean = false;

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
    this.pin = pin;

    MightyGpio.events.on(
      `pin[${this.pin}]:observer:receive`,
      (state: boolean) => {
        this.setStateSilent(state);
        MightyGpio.events.emit(
          `pin[${this.pin}]:observer:receive:confirm`,
          state,
        );
      },
    );
  }

  public close() {}

  public read(callback?: StateCallback): void {
    callback?.(this.state);
  }

  protected sendEvent(state: boolean, edge?: Edge) {
    MightyGpio.events.emit("pin:observer:send", this.pin, state, edge);
  }

  private async receiveEvent(): Promise<void> {
    return new Promise((resolve: () => void, reject) => {
      if (MightyGpio.mode === Mode.Emulated) {
        MightyGpio.events.once(
          `pin[${this.pin}]:observer:send:confirm`,
          (state: boolean) => {
            resolve()
          }
        );

        setTimeout(() => {
          reject(Error("Event Receive is stale"));
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

  private setStateSilent(state: boolean) {
    // debug
    console.log(`[DEV] Set silently pin ${this.pin} to state ${state}`);

    this._state = state;
  }

  protected async setState(value: boolean) {
    this.setStateSilent(value);
    await this.setRemoteState(value);
    return this.state;
  }
}

class InputPin extends Pin {
  protected watcher?: NodeJS.Timeout;

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

    MightyGpio.events.on(
      `pin[${this.pin}]:observer:receive`,
      (state: boolean) => {
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
    );
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
    let edge: Edge = "both";
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
}

class OutputPin extends Pin {
  public on(...args: [(number | StateCallback)?, StateCallback?]) {
    // debug
    console.log(`[DEV] Switching pin ${this.pin} to state true`);

    this.setStateWithDelay(true, ...args);
  }

  public off(...args: [(number | StateCallback)?, StateCallback?]) {
    // debug
    console.log(`[DEV] Switching pin ${this.pin} to state false`);

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
}

/// DEMO

import * as crypto from "node:crypto";

const demo = new EventEmitter();

demo.on("pin:send", (id: string, pin: number, state: boolean) => {
  // debug
  console.log(`[REM] Requested to set pin ${pin} to state ${state}`);

  if (MightyGpio.mode === Mode.Emulated) {
    setTimeout(() => {
      demo.emit(`pin:send:confirm[${id}]`, state);
    }, 2000);
  }
});

function togglePin(pin: number, state: boolean) {
  demo.emit("pin:toggle", pin, state);
}

// @ts-ignore
global.togglePin = togglePin;

MightyGpio.setMode(Mode.Emulated);
MightyGpio.setObservers({
  send: (pin: number, state: boolean) => {
    return new Promise((resolve: (state: boolean) => void, reject) => {
      const id = crypto.randomBytes(4).toString("hex");

      if (MightyGpio.mode === Mode.Real) {
        
      }

      if (MightyGpio.mode === Mode.Emulated) {
        demo.once(`pin:send:confirm[${id}]`, (state: boolean) => {
          //debug
          console.log(`[OBS] Received confirmation (${pin} to state ${state})`);
          resolve(state);
        });
      }

      //debug
      console.log(`[OBS] Ask to set ${pin} to state ${state}`);
      demo.emit("pin:send", id, pin, state);
    });
  },
  receive: async (handler: HandlerCallback) => {
    demo.on("pin:toggle", async (pin: number, state: boolean) => {
      //debug
      console.log(`Observer called state change to ${state} on pin ${pin}`);

      const result = await handler(pin, state);
      demo.emit("pin:toggle:confirm", result);
    });
  },
});

/*
const in20 = MightyGpio.setInput(20);

in20.watch((state) => {
  console.log("Pin 20 watcher received state", state);
});

togglePin(20, true);
*/

const out20 = MightyGpio.setOutput(20);

out20.pulse(5000);
//out20.off();
