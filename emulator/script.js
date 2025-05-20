class MachineEmulator extends EventTarget {
    constructor() {
        super()
        this.initListeners()
    }

    getAllOutputs = () => [...document.querySelectorAll("[out]")]
    getOutputs = (pin) => [...document.querySelectorAll(`[out="${pin}"]`)]

    getAllInputs = () => [...document.querySelectorAll("[in]")]
    getInputs = (pin, res) => [...document.querySelectorAll(`[in="${pin}"],[in="${res}:${pin}"]`)]

    initListeners() {
        const inputs = this.getAllInputs()

        inputs.forEach((input) => {
            input.addEventListener("mousedown", () => {
                if (input.blocked) return
                input.blocked = true

                this.setInState(input, 1);

                input.clicktime = Date.now()

                const pinParams = input.getAttribute("in");

                console.log(`InputPin ${pinParams} state HIGH`)

                const inState = new CustomEvent("in-state", {
                    detail: {
                        state: 1,
                        pin: MachineEmulator.getPinNumber(pinParams),
                        mode: "in",
                        resistor: MachineEmulator.getResistor(pinParams),
                    },
                })

                this.dispatchEvent(inState)
            })

            input.addEventListener("mouseup", () => {
                const sendEvent = () => {
                    input.blocked = false;

                    const pinParams = input.getAttribute("in");

                    this.setInState(input, 0);

                    const inState = new CustomEvent("in-state", {
                        detail: {
                            state: 0,
                            pin: MachineEmulator.getPinNumber(pinParams),
                            mode: "in",
                            resistor: MachineEmulator.getResistor(pinParams),
                        },
                    })

                    this.dispatchEvent(inState)
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

        this.addEventListener("out-state", (event) => {
            console.log(event);

            /*let strResistor;

            switch (event.detail.resistor) {
                case 0: strResistor = "pd"; break;
                case 1: strResistor = "pu"; break;
                case -1: strResistor = "pn"; break;
            }*/

            const targetOutputs = this.getOutputs(event.detail.pin)

            targetOutputs.forEach((output) => {
                this.setOutState(output, event.detail.state)
            })
        })

        this.addEventListener("in-state-watcher", (event) => {
            console.log(event);

            let resistorString;

            switch (event.detail.resistor) {
                case "PullUp": resistorString = "pu"; break;
                case "PullDown": resistorString = "pd"; break;
                case "NoPull": resistorString = "pn"; break;
            }

            const targetInputs = this.getInputs(event.detail.pin, resistorString)

            targetInputs.forEach((inputs) => {
                this.setInState(inputs, event.detail.state)
            })
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
        return new CustomEvent("out-state", {
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

    onInState(callback) {
        // TODO: Incoming pin state is echoed back due to events issue. PROCEED

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

    static getPinNumber(params) {
        const pinParams = params.split(":").reverse();
        return pinParams[0];
    }
}

const emu = new MachineEmulator()

//const socket = new WebSocket("ws://192.168.7.237:8080/gpio");
const socket = io("http://192.168.7.107:4000");
//const socket = io("http://192.168.7.116:4000");

socket.on('connect', () => {
    emu.onInState((pin, state, mode, resistor) => {
        socket.emit("pin:toggle", pin, !!state, mode, resistor, () => {
            console.log('Hello world');
        });
    });

    socket.on("pin:send", (pin, state, mode, resistor, callback) => {
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