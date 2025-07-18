class MachineEmulator extends EventTarget {
    constructor() {
        super()
        this.initListeners()
    }

    getAllOutputs = () => [...document.querySelectorAll("[out]")]
    getOutputs = (pin) => [
        ...document.querySelectorAll(`[out="${pin}"]`),
        ...document.querySelectorAll(`[out^="${pin}|"]`),
        ...document.querySelectorAll(`[out*="|${pin}|"]`),
        ...document.querySelectorAll(`[out$="|${pin}"]`),
    ]

    getAllInputs = () => [...document.querySelectorAll("[in]")]
    getInputs = (pin, res) => [
        ...document.querySelectorAll(`[in="${pin}"],[in="${res}:${pin}"]`),
        ...document.querySelectorAll(`[in^="${pin}|"],[in="${res}:${pin}|"]`),
        ...document.querySelectorAll(`[in*="|${pin}|"],[in="|${res}:${pin}|"]`),
        ...document.querySelectorAll(`[in$="|${pin}"],[in="|${res}:${pin}"]`),
    ]

    getAllPins = () => [...this.getAllInputs(), ...this.getAllOutputs()];
    getPins = (pin) => [...this.getInputs(pin), ...this.getOutputs(pin)];

    initListeners() {
        const inputs = this.getAllInputs()

        inputs.forEach((input) => {
            input.addEventListener("mousedown", () => {
                const isBlocked = input.blocked;
                const isDisabled = input.hasAttribute("disabled");
                const isInput = input.hasAttribute("in");

                if (isDisabled || isBlocked || !isInput) return;

                input.blocked = true;

                this.setInState(input, 1);

                input.clicktime = Date.now()

                const pinParams = input.getAttribute("in");

                console.log(`InputPin ${pinParams} state HIGH`)

                const pinSelections = MachineEmulator.getPinParams(pinParams);

                pinSelections.forEach((pinParams) => {
                    const inState = new CustomEvent("in-state", {
                        detail: {
                            state: 1,
                            pin: pinParams.pin,
                            mode: "in",
                            resistor: pinParams.resistor,
                        },
                    })

                    this.dispatchEvent(inState)
                });
            })

            input.addEventListener("mouseup", () => {
                const sendEvent = () => {
                    const isBlocked = input.blocked;

                    if (!isBlocked) return;

                    const pinParams = input.getAttribute("in");

                    this.setInState(input, 0);

                    const pinSelections = MachineEmulator.getPinParams(pinParams);

                    pinSelections.forEach((pinParams) => {
                        const inState = new CustomEvent("in-state", {
                            detail: {
                                state: 0,
                                pin: pinParams.pin,
                                mode: "in",
                                resistor: pinParams.resistor,
                            },
                        });

                        this.dispatchEvent(inState);
                    });

                    input.blocked = false;
                }

                const timePassed = Date.now() - input.clicktime;
                const delay = input.getAttribute("t") | 0

                console.log(`InputPin ${input.getAttribute("in")} state LOW`)

                if (timePassed >= delay) {
                    sendEvent()
                    return;
                }

                console.log(delay, timePassed)
                setTimeout(sendEvent, delay - timePassed)
            })
        })

        this.addEventListener("out-state-watcher", (event) => {
            console.log(event);

            /*let strResistor;

            switch (event.detail.resistor) {
                case 0: strResistor = "pd"; break;
                case 1: strResistor = "pu"; break;
                case -1: strResistor = "pn"; break;
            }*/

            const targetOutputs = this.getOutputs(event.detail.pin);

            targetOutputs.forEach((output) => {
                this.setOutState(output, event.detail.state);

                if (output.getAttribute("in") == event.detail.pin) {
                    this.removeIn(output);
                }

                this.enable(output);
            });
        })

        this.addEventListener("in-state-watcher", (event) => {
            console.log(event);

            let resistorString;

            switch (event.detail.resistor) {
                case "PullUp": resistorString = "pu"; break;
                case "PullDown": resistorString = "pd"; break;
                case "NoPull": resistorString = "pn"; break;
            }

            const targetInputs = this.getInputs(event.detail.pin, resistorString);

            targetInputs.forEach((input) => {
                this.setInState(input, event.detail.state);

                if (input.getAttribute("out") == event.detail.pin) {
                    this.removeOut(input);
                }

                this.enable(input);
            });
        })
    }

    setOutState(element, state) {
        if (state === 1) {
            element.classList.add("out-on");
        } else if (state === 0) {
            element.classList.remove("out-on");
        }
    }

    setInState(element, state) {
        if (state === 1) {
            element.classList.add("in-on")
        } else if (state === 0) {
            element.classList.remove("in-on");
        }
    }

    enable(element) {
        element.removeAttribute("disabled");
    }

    disable(element) {
        element.setAttribute("disabled", "");
    }

    removeOut(element) {
        element.removeAttribute("out");
    }

    removeIn(element) {
        element.removeAttribute("in");
    }

    static createInputEvent(pin, state) {
        return new CustomEvent("in-state", {
            detail: { pin, state },
        })
    }

    static createInputWatcherEvent(pin, resistor, state) {
        return new CustomEvent("in-state-watcher", {
            detail: { pin, resistor, state },
        })
    }

    static createOutputEvent(pin, state) {
        return new CustomEvent("out-state-watcher", {
            detail: { pin, state },
        })
    }

    setOutHigh(pin) {
        const event = MachineEmulator.createOutputEvent(pin, 1);
        this.dispatchEvent(event);
    }

    setOutLow(pin) {
        const event = MachineEmulator.createOutputEvent(pin, 0);
        this.dispatchEvent(event);
    }

    setInHigh(pin, resistor) {
        const event = MachineEmulator.createInputWatcherEvent(pin, resistor, 1);
        this.dispatchEvent(event);
    }

    setInLow(pin, resistor) {
        const event = MachineEmulator.createInputWatcherEvent(pin, resistor, 0);
        this.dispatchEvent(event);
    }

    setDisabled(pin) {
        this.getPins(pin).forEach((elem) => this.disable(elem));
    }

    setEnabled(pin) {
        this.getPins(pin).forEach((elem) => this.enable(elem));
    }

    disableAll() {
        this.getAllPins().forEach((elem) => this.disable(elem));
    }

    onInState(callback) {
        this.addEventListener("in-state", (event) => {
            callback(event.detail.pin, event.detail.state, event.detail.mode, event.detail.resistor);
        });
    }

    static getResistor(params) {
        const pinParams = params.split(":").reverse();

        switch (pinParams[1]) {
            case "pu": return "PullUp";
            case "pd": return "PullDown";
            case "pn": return "NoPull";
        }
    }

    static getPinParams(params) {
        const selections = params.split("|");

        return selections.map((selection) => {
            const pinParams = selection.split(":").reverse();

            return {
                pin: pinParams[0],
                resistor: pinParams[1],
            };
        });
    }
}

const emu = new MachineEmulator()

const socket = io("http://127.0.0.1:46992");

let conChecker;

socket.on('disconnect', () => {
    emu.disableAll();
    clearInterval(conChecker);
});

socket.on('connect', () => {
    conChecker = setInterval(() => {
        socket.emit("ping");
    }, 1000);

    emu.onInState((pin, state, mode, resistor) => {
        socket.emit("pin:toggle", pin, !!state, mode, resistor, () => {
            console.log('Hello world');
        });
    });

    socket.on("pin:send", (pin, state, mode, resistor, callback) => {
        console.log(`Pin ${pin}: ${state} ${mode} ${resistor}`);

        if (!mode) {
            emu.setDisabled(pin);
            return;
        }

        if (mode === "in") {
            if (state === true) {
                emu.setInHigh(pin, resistor);
            } else {
                emu.setInLow(pin, resistor);
            }
        }

        if (mode === "out") {
            if (state === true) {
                emu.setOutHigh(pin);
            } else {
                emu.setOutLow(pin);
            }
        }

        callback(state);
    });
});