class MachineEmulator extends EventTarget {
    constructor() {
        super()
        this.initListeners()
    }

    getAllOutputs = () => [...document.querySelectorAll("[out]")]
    getOutputs = (pin) => [...document.querySelectorAll(`[out="${pin}"]`)]

    getAllInputs = () => [...document.querySelectorAll("[in]")]
    getInputs = (pin) => [...document.querySelectorAll(`[in="${pin}"]`)]

    initListeners() {
        const inputs = this.getAllInputs()

        inputs.forEach((input) => {
            input.addEventListener("mousedown", () => {
                if (input.blocked) return
                input.blocked = true

                input.clicktime = Date.now()

                console.log(`InputPin ${input.getAttribute("in")} state HIGH`)

                const inState = new CustomEvent("in-state", {
                    detail: {
                        state: 1,
                        pin: input.getAttribute("in"),
                    },
                })

                this.dispatchEvent(inState)
            })

            input.addEventListener("mouseup", () => {
                const sendEvent = () => {
                    input.blocked = false;

                    const inState = new CustomEvent("in-state", {
                        detail: {
                            state: 0,
                            pin: input.getAttribute("in"),
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

            const targetOutputs = this.getOutputs(event.detail.pin)

            targetOutputs.forEach((output) => {
                this.setOutState(output, event.detail.state)
            })
        })

        this.addEventListener("in-state", (event) => {
            console.log(event);

            const targetInputs = this.getInputs(event.detail.pin)

            targetInputs.forEach((inputs) => {
                this.setInState(inputs, event.detail.state)
            })
        })
    }

    setOutState(element, state) {
        if (state === 1) {
            element.classList.add("out-on")
        } else if (state === 0) {
            element.classList.remove("out-on")
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

    setInHigh(pin) {
        const event = MachineEmulator.createInputEvent(pin, 1);
        this.dispatchEvent(event);
    }

    setInLow(pin) {
        const event = MachineEmulator.createInputEvent(pin, 0);
        this.dispatchEvent(event);
    }

    onInState(callback) {
        this.addEventListener("in-state", (event) => {
            callback(event.detail.pin, event.detail.state);
        });
    }
}

const emu = new MachineEmulator()

//const socket = new WebSocket("ws://192.168.7.237:8080/gpio");
//const socket = io("http://127.0.0.1:4000");
const socket = io("http://192.168.7.107:4000");

socket.on('connect', () => {
    emu.onInState((pin, state) => {
        socket.emit("pin:toggle", pin, !!state, () => {
            console.log('Hello world')
        });
    });

    socket.on("pin:send", (pin, state, callback) => {
        if (state === true) {
            emu.setOutHigh(pin);
        } else {
            emu.setOutLow(pin);
        }

        callback(state);
    });
});