import {
  MightyGpio,
  setInput,
  setOutput,
  Edge,
  ObserverHandler,
} from "../src/main";
import { EventEmitter } from "events";
import express from "express";
import { Server } from "socket.io";
import http from "http";

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

const demo = new EventEmitter();

demo.on("pin:send", (id: string, pin: number, state: boolean) => {
  setTimeout(() => {
    demo.emit(`pin:send:confirm[${id}]`, state);
  }, 2000);
});

function togglePin(pin: number, state: boolean) {
  demo.emit("pin:toggle", pin, state);
}

// @ts-ignore
global.togglePin = togglePin;

// MightyGpio.forceEmulation();
MightyGpio.useBroadcomScheme();
MightyGpio.setInverted();

io.on("connection", (socket) => {
  console.log(`Socket ${socket.id} connected`);

  MightyGpio.setObservers({
    send: (pin: number, state: boolean) => {
      return new Promise((resolve: (state: boolean) => void, reject) => {
        socket.emit("pin:send", pin, state, resolve);
      });
    },
    receive: async (handler: ObserverHandler) => {
      type SocketResponder = (response: any) => void;

      socket.on(
        "pin:toggle",
        async (pin: number, state: boolean, callback: SocketResponder) => {
          console.log(`[EMU-DEV] Ask ${state} on pin ${pin}`);

          const result = await handler(pin, state);
          callback(result);
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

setInterval(() => {
  led.pulse(1000);
}, 2000);

btn1.watch(Edge.High, (state) => {
  console.log("BTN1 CLICKED");
  dis1.pulse(1000);
});

btn2.watch(Edge.High, (state) => {
  dis2.pulse(1000);
});

btn3.watch(Edge.High, (state) => {
  dis3.pulse(1000);
});

btn4.watch(Edge.High, (state) => {
  dis4.pulse(1000);
});

btn5.watch(Edge.High, (state) => {
  dis5.pulse(1000);
});
