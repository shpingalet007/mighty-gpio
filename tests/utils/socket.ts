import express from "express";
import { Server } from "socket.io";
import http from "http";

import type * as MightyGpioDeclaration from "mighty-gpio";

import _MightyGpio, { setInput, setOutput } from "../../src/main";
import { Edge, PinMode, Resistor } from "../../src/types/enums";
import { ObserverHandler } from "../../src/types/types";

const MightyGpio = (<unknown>_MightyGpio) as typeof MightyGpioDeclaration;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

server.listen(4000, () => {
  console.log("Listening on *:4000");
});

// MightyGpio.forceEmulation();
MightyGpio.useBroadcomScheme();
MightyGpio.setInverted();

io.on("connection", (socket) => {
  console.log(`Socket ${socket.id} connected`);

  MightyGpio.setObservers({
    send: (pin: number, state: boolean, mode: PinMode, resistor?: Resistor) => {
      return new Promise((resolve: (state: boolean) => void, reject) => {
        socket.emit("pin:send", pin, state, mode, resistor, resolve);
      });
    },
    receive: async (handler: ObserverHandler) => {
      type SocketResponder = (response: any) => void;

      socket.on(
        "pin:toggle",
        async (
          pin: number,
          state: boolean,
          mode: PinMode,
          resistor: Resistor,
          callback: SocketResponder,
        ) => {
          console.log(`[EMU-DEV] Ask ${state} on pin ${pin}`);

          const result = await handler(pin, state, mode, resistor);
          callback?.(result);
        },
      );
    },
  });

  // upon disconnection
  socket.on("disconnect", (reason) => {
    console.log(`Socket ${socket.id} disconnected`);
    socket.removeAllListeners("pin:toggle");
  });
});

const btn1 = setInput(6);
const dis1 = setOutput(13);
const btn2 = setInput(21);
const dis2 = setOutput(19);
const btn3 = setInput(5);
const dis3 = setOutput(26);
const btn4 = setInput(16);
const dis4 = setOutput(27);
const btn5 = setInput(20);
const dis5 = setOutput(12);

const led = setOutput(24);

const door = setInput(23);
const doorSignal = setOutput(25);

const coins = setInput(22);
const bills = setInput(4);

setInterval(() => {
  led.pulse(1000);
}, 2000);

door.watch(Edge.High, () => console.log("Door close"));
door.watch(Edge.Low, () => {
  console.log("Door open");
  doorSignal.pulse(1000);
});

let isCounting = false;
let moneyCount = 0;

function countMoney(moneyType: string) {
  moneyCount++;

  if (isCounting) return;
  isCounting = true;

  setTimeout(() => {
    console.log(`${moneyType} INSERTED:`, moneyCount);
    isCounting = false;
    moneyCount = 0;
  }, 5000);
}

coins.watch(Edge.High, () => countMoney("COINS"));
bills.watch(Edge.High, () => countMoney("BILLS"));

btn1.watch(Edge.Both, (state) => {
  //dis1.pulse(1000);
  dis1.write(state);
});

btn2.watch(Edge.Both, (state) => {
  //dis2.pulse(1000);
  dis2.write(state);
});

btn3.watch(Edge.Both, (state) => {
  //dis3.pulse(1000);
  dis3.write(state);
});

btn4.watch(Edge.Both, (state) => {
  //dis4.pulse(1000);
  dis4.write(state);
});

btn5.watch(Edge.Both, (state) => {
  //dis5.pulse(1000);
  dis5.write(state);
});
