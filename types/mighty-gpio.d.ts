declare module "mighty-gpio" {
  export { MightyGpio } from "../src/main";

  export { setInput, setOutput } from "array-gpio";

  export {
    StateCallback,
    StateEdgeCallback,
    Callback,
    RemoteObserverHandler,
    ObserverHandler,
    ResistorType,
  } from "./types/types";

  export enum Resistor {
    PullDown,
    PullUp,
  }

  export enum Edge {
    Low = 0,
    High = 1,
    Both = "both",
    Unknown = "unknown",
  }
}
