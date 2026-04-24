export enum Resistor {
  NoPull = -1,
  PullDown,
  PullUp,
}

export enum Edge {
  Low = 0,
  High = 1,
  Both = "both",
  Unknown = "unknown",
}

export enum PinMode {
  Out = "out",
  In = "in",
}

export enum GpioScheme {
  Physical = "physical",
  Broadcom = "broadcom",
}

export enum Mode {
  Real = "real",
  Emulated = "emulated",
}

export default {
  Resistor,
  Edge,
  PinMode,
  GpioScheme,
  Mode,
};
