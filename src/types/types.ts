import { Edge, Resistor } from "./enums";

export type StateCallback = (state: boolean) => void;
export type StateEdgeCallback = (edge: Edge, state: boolean) => void;
export type Callback = () => void;

export type ObserverHandler = (pin: number, state: boolean) => Promise<boolean>;
export type RemoteObserverHandler = (handler: ObserverHandler) => void;

export type ResistorType = Resistor | "pu" | "pd";

export type ReverseMap<T extends Record<keyof T, keyof any>> = {
  [K in keyof T as T[K]]: K;
};
