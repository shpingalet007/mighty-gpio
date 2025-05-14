import { Edge, PinMode, Resistor } from "./enums";

export type StateCallback = (state: boolean) => void;
export type StateEdgeCallback = (edge: Edge, state: boolean) => void;
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
