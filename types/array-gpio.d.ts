declare module "array-gpio" {
  interface Pin {
    state: PinState;

    isOn: boolean;
    isOff: boolean;

    pin: number;

    close(): void;
    read(callback?: StateCallback): number[];
  }

  interface InputPin extends Pin {
    watch(edge: Edge, callback: StateCallback, s?: number): void;
    watch(callback: StateCallback, s?: number): void;

    unwatch(): void;

    /** @deprecated */
    setR(value?: Resistor): void;

    setPud(value?: Resistor): void;
  }

  interface OutputPin extends Pin {
    on(t?: number, callback?: StateCallback): void;
    on(callback?: StateCallback): void;

    off(t?: number, callback?: StateCallback): void;
    off(callback?: StateCallback): void;

    write(bit: BitState, callback?: StateCallback): void;

    pulse(pw: number, callback?: Callback): void;
  }

  type Option = {
    pin: number[];
    index?: string;
  };

  type Edge = 0 | 1 | "both";
  type Frequency = 10 | 100 | 1000;

  type Callback = () => void;
  export type StateCallback = (state: PinState) => void;

  type Resistor = 1 | "pu" | 0 | "pd";

  type BitState = 1 | true | 0 | false;

  type DataMode = 0 | 1 | 2 | 3;
  type ChipSelect = 0 | 1 | 2 | 3;
  type PinState = 0 | 1;

  function setInput(pin: number): InputPin;
  function setInput(...pin: number[]): InputPin[];
  function setInput(option: Option): InputPin[];
  "in" = setInput;

  function setOutput(pin: number): OutputPin;
  function setOutput(...pin: number[]): OutputPin[];
  function setOutput(option: Option): OutputPin[];
  out = setOutput;

  function watchInput(callback: Callback): void;
  function watchInput(callback: Callback, s?: number): void;
  function watchInput(edge: Edge, callback: Callback): void;
  function watchInput(edge: Edge, callback: Callback, s?: number): void;

  function unwatchInput(): void;

  interface ComProtocol {
    setClockFreq(div: number): void;
  }

  interface ComProtocolIO extends ComProtocol {
    write(wbuf: Buffer, n: number): void;
    read(rbuf: Buffer, n: number): void;
  }

  /**
   * PWM
   */
  function startPWM(pin: number): PWM;
  function startPWM(pin: number, freq: Frequency, t: number, pw: number): PWM;

  interface PWM extends ComProtocol {
    setRange(range: number): void;
    setData(data: number): void;
    pulse(pw?: number): void;

    stop(): void;
    close(): void;
  }

  /**
   * I2C
   */
  function startI2C(): I2C;

  interface I2C extends ComProtocolIO {
    begin(): void;
    end(): void;

    setTransferSpeed(baud: number): void;
    selectSlave(addr: number): void;
  }

  /**
   * SPI
   */
  function startSPI(): SPI;

  interface SPI extends ComProtocolIO {
    chipSelect(cs: ChipSelect): void;
    setCSPolarity(cs: ChipSelect, active: PinState): void;
    setDataMode(mode: DataMode): void;
    transfer(wbuf: Buffer, rbuf: Buffer, n: number): void;

    begin(): void;
    end(): void;
  }
}
