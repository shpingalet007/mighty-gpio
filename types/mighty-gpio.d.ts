import { GpioScheme, Mode } from "./enums";
import {ObserversPack, PinData, PinMode, PinState } from "./types";

declare module "@pinlab/mighty-gpio" {
  /* For internal use only */
  export let _mode: Mode;
  export let _inverted: boolean;
  export let _gpioScheme: GpioScheme;

  /* Mighty GPIO methods */
  export const setInverted: () => void;
  export const useBroadcomScheme: () => void;
  export const forceEmulation: () => boolean;
  export const isBroadcomScheme: () => boolean;
  export const supportsPeripherals: () => boolean;
  export const supportsPWM: () => boolean;
  export const supportsI2C: () => boolean;
  export const supportsSPI: () => boolean;
  export const ready: (...pins: Pin[]) => Promise<boolean>;
  export const readAllData: () => PinData[];

  interface Pin {
    state: PinState;

    isOn: boolean;
    isOff: boolean;

    pin: number;

    close(): void;
    read(callback?: StateCallback): PinState;

    readData(): PinData;
  }

  export interface InputPin extends Pin {
    watch(edge: Edge, callback: StateCallback, s?: number): void;
    watch(callback: StateCallback, s?: number): void;

    unwatch(): void;

    /** @deprecated */
    setR(value?: Resistor): void;

    setPud(value?: Resistor): void;

    setInverted(): void;

    /* For internal use only */
    ready(): InputPin;
  }

  export interface OutputPin extends Pin {
    on(t?: number, callback?: StateCallback): void;
    on(callback?: StateCallback): void;

    off(t?: number, callback?: StateCallback): void;
    off(callback?: StateCallback): void;

    write(bit: BitState, callback?: StateCallback): void;

    pulse(pw: number, callback?: Callback): void;

    /* For internal use only */
    ready(): OutputPin;
  }

  type Option = {
    pin: number[];
    index?: string;
  };

  type Edge = 0 | 1 | "both";
  type Frequency = 10 | 100 | 1000;

  type Callback = () => void;
  type StateCallback = (state: PinState) => void;
  type StatePinCallback = (state: BitState, pin: number) => void;

  type Resistor = 1 | "pu" | 0 | "pd";

  type BitState = 1 | true | 0 | false;

  type DataMode = 0 | 1 | 2 | 3;
  type ChipSelect = 0 | 1 | 2 | 3;
  type PinState = 0 | 1;

  export function setObservers(observers: ObserversPack): void;

  export function setInput(pin: number): InputPin;
  export function setInput(...pin: number[]): InputPin[];
  export function setInput(option: Option): InputPin[];

  // @ts-ignore
  export { setInput as in };

  export function setOutput(pin: number): OutputPin;
  export function setOutput(...pin: number[]): OutputPin[];
  export function setOutput(option: Option): OutputPin[];

  // @ts-ignore
  export { setOutput as out };

  export function watchInput(callback: Callback): void;
  export function watchInput(callback: Callback, s?: number): void;
  export function watchInput(edge: Edge, callback: Callback): void;
  export function watchInput(edge: Edge, callback: Callback, s?: number): void;

  export function unwatchInput(): void;

  interface ComProtocol {
    setClockFreq(div: number): void;
  }

  interface ComProtocolIO extends ComProtocol {
    write(wbuf: Buffer, n: number): void;
    read(rbuf: Buffer, n: number): void;
  }

  export function startPWM(pin: number): PWM;
  export function startPWM(
    pin: number,
    freq: Frequency,
    t: number,
    pw: number,
  ): PWM;

  interface PWM extends ComProtocol {
    setRange(range: number): void;
    setData(data: number): void;
    pulse(pw?: number): void;

    stop(): void;
    close(): void;
  }

  export function startI2C(): I2C;

  interface I2C extends ComProtocolIO {
    begin(): void;
    end(): void;

    setTransferSpeed(baud: number): void;
    selectSlave(addr: number): void;
  }

  /**
   * SPI
   */
  export function startSPI(): SPI;

  interface SPI extends ComProtocolIO {
    chipSelect(cs: ChipSelect): void;
    setCSPolarity(cs: ChipSelect, active: PinState): void;
    setDataMode(mode: DataMode): void;
    transfer(wbuf: Buffer, rbuf: Buffer, n: number): void;

    begin(): void;
    end(): void;
  }
}
