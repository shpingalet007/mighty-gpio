import { expect } from "chai";

import type * as MightyGpioDeclaration from "mighty-gpio";

import _MightyGpio, { ObserverHandler } from "../src/main";
import { GpioScheme, Mode, PinMode, Resistor } from "../src/types/enums";
import { EventEmitter } from "events";
import delay from "../src/helpers/delay";

const MightyGpio = (<unknown>_MightyGpio) as typeof MightyGpioDeclaration;

const events = new EventEmitter();

MightyGpio.setObservers({
  send: async (
    pin: number,
    state: boolean,
    mode: PinMode,
    resistor?: Resistor,
  ) => {
    events.emit("observer-send-called");
  },
  receive: (handler: ObserverHandler) => {
    events.on("observer-receive-called", handler);
  },
});

function setPin(
  pin: number,
  state: boolean,
  mode: PinMode,
  resistor?: Resistor,
) {
  events.emit("observer-receive-called", pin, state, mode, resistor);
}

describe("Mighty parameters", () => {
  it("Invert GPIO pin states", () => {
    MightyGpio.setInverted();

    expect(MightyGpio._inverted).to.equal(true);

    MightyGpio._inverted = false;
  });

  it("Change GPIO mapping scheme", () => {
    expect(MightyGpio._gpioScheme).to.equal(GpioScheme.Physical);
    expect(MightyGpio.isBroadcomScheme()).to.equal(false);

    MightyGpio.useBroadcomScheme();

    expect(MightyGpio._gpioScheme).to.equal(GpioScheme.Broadcom);
    expect(MightyGpio.isBroadcomScheme()).to.equal(true);

    MightyGpio._gpioScheme = GpioScheme.Physical;
  });

  it("Force emulation mode", () => {
    MightyGpio.forceEmulation();

    expect(MightyGpio._mode).to.equal(Mode.Emulated);

    MightyGpio._mode = Mode.Real;
  });
});

describe("Input methods", () => {
  describe("Initialize", () => {
    it("Single pin", () => {
      const in20 = MightyGpio.setInput(20);

      // @ts-ignore
      expect(in20.resistor).to.equal(Resistor.NoPull);

      in20.setPud(Resistor.PullUp);

      // @ts-ignore
      expect(in20.resistor).to.equal(Resistor.PullUp);

      in20.setPud(Resistor.PullDown);

      // @ts-ignore
      expect(in20.resistor).to.equal(Resistor.PullDown);

      in20.setPud();

      // @ts-ignore
      expect(in20.resistor).to.equal(Resistor.NoPull);

      expect(in20.constructor.name).to.equal("InputPin");
      expect(in20.pin).to.be.equal(20);
      expect(in20.state).to.equal(0);
      expect(in20.isOff).to.equal(true);
      expect(in20.isOn).to.equal(false);
      expect(in20.read()).to.equal(0);

      in20.read((state) => {
        expect(state).to.equal(0);
      });

      in20.close();
    });

    it("Multiple pins", () => {
      const ins1 = MightyGpio.setInput({ pin: [20, 21] });
      const ins2 = MightyGpio.setInput(20, 21);

      expect(ins1[0].constructor.name).to.equal("InputPin");
      expect(ins1[1].constructor.name).to.equal("InputPin");
      expect(ins1[0].pin).to.be.equal(20);
      expect(ins1[1].pin).to.be.equal(21);
      expect(ins1[0].state).to.equal(0);
      expect(ins1[1].state).to.equal(0);
      expect(ins1[0].isOff).to.equal(true);
      expect(ins1[1].isOff).to.equal(true);
      expect(ins1[0].isOn).to.equal(false);
      expect(ins1[1].isOn).to.equal(false);
      expect(ins1[0].read()).to.equal(0);
      expect(ins1[1].read()).to.equal(0);

      ins1[0].read((state) => {
        expect(state).to.equal(0);
      });

      ins1[1].read((state) => {
        expect(state).to.equal(0);
      });

      expect(ins2[0].constructor.name).to.equal("InputPin");
      expect(ins2[1].constructor.name).to.equal("InputPin");
      expect(ins2[0].pin).to.be.equal(20);
      expect(ins2[1].pin).to.be.equal(21);
      expect(ins2[0].state).to.equal(0);
      expect(ins2[1].state).to.equal(0);
      expect(ins2[0].isOff).to.equal(true);
      expect(ins2[1].isOff).to.equal(true);
      expect(ins2[0].isOn).to.equal(false);
      expect(ins2[1].isOn).to.equal(false);
      expect(ins2[0].read()).to.equal(0);
      expect(ins2[1].read()).to.equal(0);

      ins2[0].read((state) => {
        expect(state).to.equal(0);
      });

      ins2[1].read((state) => {
        expect(state).to.equal(0);
      });

      ins1[0].close();
      ins2[1].close();
    });

    it("Multiple pins indexed", () => {
      const ins = MightyGpio.setInput({ pin: [20, 21], index: "pin" });

      expect(ins[20].constructor.name).to.equal("InputPin");
      expect(ins[21].constructor.name).to.equal("InputPin");
      expect(ins[20].pin).to.be.equal(20);
      expect(ins[21].pin).to.be.equal(21);
      expect(ins[20].state).to.equal(0);
      expect(ins[21].state).to.equal(0);
      expect(ins[20].isOff).to.equal(true);
      expect(ins[21].isOff).to.equal(true);
      expect(ins[20].isOn).to.equal(false);
      expect(ins[21].isOn).to.equal(false);
      expect(ins[20].read()).to.equal(0);
      expect(ins[21].read()).to.equal(0);

      ins[20].read((state) => {
        expect(state).to.equal(0);
      });

      ins[21].read((state) => {
        expect(state).to.equal(0);
      });

      ins[20].close();
      ins[21].close();
    });
  });
  describe("Watch and Unwatch", () => {
    it("Watch pin directly", async () => {
      const in20 = MightyGpio.setInput(20);

      function initWatchExpecting(expectation: 0 | 1): Promise<void> {
        return new Promise((resolve, reject) => {
          in20.watch((state) => {
            try {
              expect(in20.state).to.equal(expectation);
              expect(state).to.equal(expectation);
            } catch (error) {
              reject(error);
            }

            resolve();
          });

          setTimeout(reject, 10);
        });
      }

      function checkWatcher(): Promise<void> {
        return new Promise((resolve, reject) => {
          const w1 = initWatchExpecting(1);
          const w2 = initWatchExpecting(1);

          setPin(20, true, PinMode.In);

          // TODO: PROCEED

          const rw1 = initWatchExpecting(0)
            .catch(() => "TIMEOUT")
            .then((res) => {
              if (res === "TIMEOUT") return Promise.resolve();
              return Promise.reject();
            });
          const rw2 = initWatchExpecting(0)
            .catch(() => "TIMEOUT")
            .then((res) => {
              if (res === "TIMEOUT") return Promise.resolve();
              return Promise.reject();
            });

          in20.unwatch();

          setPin(20, false, PinMode.In);

          Promise.all([
            Promise.all([w1, w2]).catch(() => "WATCH_FAIL"),
            Promise.all([rw1, rw2]).catch(() => "UNWATCH_FAIL"),
          ]).then((res) => {
            if (res[0] === "WATCH_FAIL")
              reject(Error("Failed to set pin watchers"));
            if (res[1] === "UNWATCH_FAIL")
              reject(Error("Failed to unset pin watchers"));

            resolve();
          });
        });
      }

      return checkWatcher().then(() => in20.close());
    });

    it("Watch all pins", async () => {
      const in20 = MightyGpio.setInput(20);

      function initWatchExpecting(expectation: 0 | 1): Promise<void> {
        return new Promise((resolve, reject) => {
          MightyGpio.watchInput(() => {
            try {
              expect(in20.state).to.equal(expectation);
            } catch (error) {
              reject(error);
            }

            resolve();
          });

          setTimeout(reject, 10);
        });
      }

      function checkWatcher(): Promise<void> {
        return new Promise((resolve, reject) => {
          const w1 = initWatchExpecting(1);
          const w2 = initWatchExpecting(1);

          setPin(20, true, PinMode.In);

          const rw1 = initWatchExpecting(0)
            .catch(() => "TIMEOUT")
            .then((res) => {
              if (res === "TIMEOUT") return Promise.resolve();
              return Promise.reject();
            });

          const rw2 = initWatchExpecting(0)
            .catch(() => "TIMEOUT")
            .then((res) => {
              if (res === "TIMEOUT") return Promise.resolve();
              return Promise.reject();
            });

          MightyGpio.unwatchInput();

          setPin(20, false, PinMode.In);

          Promise.all([
            Promise.all([w1, w2]).catch(() => "WATCH_FAIL"),
            Promise.all([rw1, rw2]).catch(() => "UNWATCH_FAIL"),
          ]).then((res) => {
            if (res[0] === "WATCH_FAIL")
              reject(Error("Failed to set global pin watchers"));
            else if (res[1] === "UNWATCH_FAIL")
              reject(Error("Failed to unset global pin watchers"));
            else resolve();
          });
        });
      }

      return checkWatcher().then(() => in20.close());
    });

    it("Unwatch completely", async () => {
      let in20 = MightyGpio.setInput(20);

      let marker1 = false;
      let marker2 = false;

      in20.watch(1, () => {
        marker1 = true;
      });

      in20.close();

      in20 = MightyGpio.setInput(20);

      in20.watch(1, () => {
        marker2 = true;
      });

      setPin(20, true, PinMode.In);

      return new Promise((resolve, reject) => {
        setTimeout(() => {
          expect(marker1).to.equal(false);
          expect(marker2).to.equal(true);

          in20.close();
          resolve();
        }, 300);
      });
    });
  });
});

describe("Output methods", () => {
  describe("Initialize", () => {
    it("Single pin", () => {
      const in20 = MightyGpio.setOutput(20);

      expect(in20.constructor.name).to.equal("OutputPin");
      expect(in20.pin).to.be.equal(20);
      expect(in20.state).to.equal(0);
      expect(in20.isOff).to.equal(true);
      expect(in20.isOn).to.equal(false);
      expect(in20.read()).to.equal(0);

      in20.read((state) => {
        expect(state).to.equal(0);
      });

      in20.close();
    });

    it("Multiple pins", () => {
      const ins = MightyGpio.setOutput({ pin: [20, 21] });

      expect(ins[0].constructor.name).to.equal("OutputPin");
      expect(ins[1].constructor.name).to.equal("OutputPin");
      expect(ins[0].pin).to.be.equal(20);
      expect(ins[1].pin).to.be.equal(21);
      expect(ins[0].state).to.equal(0);
      expect(ins[1].state).to.equal(0);
      expect(ins[0].isOff).to.equal(true);
      expect(ins[1].isOff).to.equal(true);
      expect(ins[0].isOn).to.equal(false);
      expect(ins[1].isOn).to.equal(false);
      expect(ins[0].read()).to.equal(0);
      expect(ins[1].read()).to.equal(0);

      ins[0].read((state) => {
        expect(state).to.equal(0);
      });

      ins[1].read((state) => {
        expect(state).to.equal(0);
      });

      ins[0].close();
      ins[1].close();
    });

    it("Multiple pins indexed", () => {
      const ins = MightyGpio.setOutput({ pin: [20, 21], index: "pin" });

      expect(ins[20].constructor.name).to.equal("OutputPin");
      expect(ins[21].constructor.name).to.equal("OutputPin");
      expect(ins[20].pin).to.be.equal(20);
      expect(ins[21].pin).to.be.equal(21);
      expect(ins[20].state).to.equal(0);
      expect(ins[21].state).to.equal(0);
      expect(ins[20].isOff).to.equal(true);
      expect(ins[21].isOff).to.equal(true);
      expect(ins[20].isOn).to.equal(false);
      expect(ins[21].isOn).to.equal(false);
      expect(ins[20].read()).to.equal(0);
      expect(ins[21].read()).to.equal(0);

      ins[20].read((state) => {
        expect(state).to.equal(0);
      });

      ins[21].read((state) => {
        expect(state).to.equal(0);
      });

      ins[20].close();
      ins[21].close();
    });
  });

  describe("State change", () => {
    it("Trigger with write", () => {
      const in20 = MightyGpio.setOutput(20);

      return new Promise<void>((resolve, reject) => {
        in20.write(true, (state) => {
          try {
            expect(in20.state).to.equal(1);
            expect(state).to.equal(1);
            expect(in20.isOff).to.equal(false);
            expect(in20.isOn).to.equal(true);
            expect(in20.read()).to.equal(1);

            in20.read((state) => {
              expect(state).to.equal(1);
            });

            in20.write(false, (state) => {
              try {
                expect(in20.state).to.equal(0);
                expect(state).to.equal(0);
                expect(in20.isOff).to.equal(true);
                expect(in20.isOn).to.equal(false);
                expect(in20.read()).to.equal(0);

                in20.read((state) => {
                  expect(state).to.equal(0);
                });

                in20.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            });
          } catch (error) {
            reject(error);
          }
        });
      });
    });

    it("Trigger with on/off", async () => {
      const in20 = MightyGpio.setOutput(20);

      return new Promise((resolve, reject) => {
        in20.on((state) => {
          try {
            expect(in20.state).to.equal(1);
            expect(state).to.equal(1);
            expect(in20.isOff).to.equal(false);
            expect(in20.isOn).to.equal(true);
            expect(in20.read()).to.equal(1);

            in20.read((state) => {
              expect(state).to.equal(1);
            });

            in20.off((state) => {
              try {
                expect(in20.state).to.equal(0);
                expect(state).to.equal(0);
                expect(in20.isOff).to.equal(true);
                expect(in20.isOn).to.equal(false);
                expect(in20.read()).to.equal(0);

                in20.read((state) => {
                  expect(state).to.equal(0);
                });

                in20.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            });
          } catch (error) {
            reject(error);
          }
        });
      });
    });

    it("Trigger with pulse", () => {
      const in20 = MightyGpio.setOutput(20);

      function pulse(): Promise<void> {
        return new Promise((resolve, reject) => {
          in20.pulse(10, () => {
            try {
              expect(in20.state).to.equal(0);
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });
      }

      return Promise.all([
        pulse(),
        delay(() => expect(in20.state).to.equal(1), 1),
        delay(() => expect(in20.state).to.equal(1), 10),
        delay(() => expect(in20.state).to.equal(0), 12),
      ]);
    });

    it("Trigger from Observer", async () => {
      const out20 = MightyGpio.setOutput(20);
      await MightyGpio.ready(out20);

      setPin(20, true, PinMode.Out);

      await new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          try {
            expect(out20.state).to.equal(1);
            resolve();
          } catch (err) {
            reject(err);
          }
        }, 1);
      });

      setPin(20, false, PinMode.Out);

      await new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          try {
            expect(out20.state).to.equal(0);
            resolve();
          } catch (err) {
            reject(err);
          }
        }, 1);
      });
    });
  });
});

describe("Module mighty-gpio API", () => {
  it("Check exports", () => {
    expect(MightyGpio).to.have.property("setInverted");
    expect(MightyGpio).to.have.property("useBroadcomScheme");
    expect(MightyGpio).to.have.property("isBroadcomScheme");
    expect(MightyGpio).to.have.property("forceEmulation");

    expect(MightyGpio).to.have.property("supportsPeripherals");
    expect(MightyGpio).to.have.property("supportsPWM");
    expect(MightyGpio).to.have.property("supportsI2C");
    expect(MightyGpio).to.have.property("supportsSPI");
  });
});

describe("Module array-gpio API", () => {
  it("Check exports for GPIO methods", () => {
    expect(MightyGpio).to.have.property("setInput");
    expect(MightyGpio).to.have.property("setOutput");
    expect(MightyGpio).to.have.property("in");
    expect(MightyGpio).to.have.property("out");
    expect(MightyGpio).to.have.property("watchInput");
    expect(MightyGpio).to.have.property("unwatchInput");
  });

  it("Check exports for peripherals methods", async () => {
    expect(MightyGpio).to.have.property("startPWM");
    expect(MightyGpio).to.have.property("startI2C");
    expect(MightyGpio).to.have.property("startSPI");
  });
});
