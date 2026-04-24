import { Edge, PinMode, Resistor } from "./enums.js";
import { PinState } from "array-gpio";
export { PinState } from "array-gpio";

export type StateModeResistorCallback = (
  state: PinState,
  mode: PinMode,
  resistor: keyof typeof Resistor,
) => void;

export type StateCallback = (state: PinState) => void;
export type StateEdgeCallback = (edge: Edge, state: PinState) => void;
export type Callback = () => void;

export type ObserverHandler = (
  pin: number,
  state: boolean,
  mode: PinMode,
  resistor?: Resistor,
) => Promise<boolean>;
export type RemoteObserverHandler = (handler: ObserverHandler) => void;

export interface ObserversPack {
  send?: ObserverHandler;
  receive?: RemoteObserverHandler;
}

export type ResistorType = Resistor.PullUp | Resistor.PullDown | "pu" | "pd";

export type ReverseMap<T extends Record<keyof T, keyof any>> = {
  [K in keyof T as T[K]]: K;
};

export interface PinData {
  state: boolean;
  resistor: typeof Resistor;
  mode: PinMode;
}