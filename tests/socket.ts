import {Edge, HandlerCallback, MightyGpio, Mode, setInput, setOutput} from "../src/main";
import {EventEmitter} from "events";
import express from "express";
import { Server } from "socket.io";
import http from "http";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

server.listen(4000, () => {
  console.log('Listening on *:4000');
});

const demo = new EventEmitter();

demo.on("pin:send", (id: string, pin: number, state: boolean) => {
  if (MightyGpio.mode === Mode.Emulated) {
    setTimeout(() => {
      demo.emit(`pin:send:confirm[${id}]`, state);
    }, 2000);
  }
});

function togglePin(pin: number, state: boolean) {
  demo.emit("pin:toggle", pin, state);
}

// @ts-ignore
global.togglePin = togglePin;

MightyGpio.setMode(Mode.Real);
//MightyGpio.setInverted();

io.on("connection", (socket) => {
  console.log(`Socket ${socket.id} connected`);

  MightyGpio.setObservers({
    send: (pin: number, state: boolean) => {
      return new Promise((resolve: (state: boolean) => void, reject) => {
        //debug
        //console.log(`[DEV-EMU] Ask ${state} on pin ${pin}`);
        socket.emit("pin:send", pin, state, (state: boolean) => {
          if (MightyGpio.mode === Mode.Emulated) {
            resolve(state);
          }
        });
      });
    },
    receive: async (handler: HandlerCallback) => {
      type SocketResponder = (response: any) => void;

      socket.on("pin:toggle", async (pin: number, state: boolean, callback: SocketResponder) => {
        console.log(`[EMU-DEV] Ask ${state} on pin ${pin}`);

        const result = await handler(pin, state);
        callback(result);
      });
    },
  });

  // upon disconnection
  socket.on("disconnect", (reason) => {
    console.log(`Socket ${socket.id} disconnected`);
    socket.removeAllListeners("pin:toggle");
  });
});

const btn1 = setInput(31);
const dis1 = setOutput(33);
const btn2 = setInput(40);
const dis2 = setOutput(35);
const btn3 = setInput(29);
const dis3 = setOutput(37);
const btn4 = setInput(36);
const dis4 = setOutput(13);
const btn5 = setInput(38);
const dis5 = setOutput(32);

const led = setOutput(18);

/*const in10 = MightyGpio.setInput(10);
const out30 = MightyGpio.setOutput(30);

in10.watch(Edge.Both, (state) => {
  console.log(`Pin 10 - Was set to ${state}`);
  console.log(`Pin 30 - Setting to ${state}`);
  out30.write(state);
});*/

/*const btn5 = MightyGpio.setInput(38);
const dis5 = MightyGpio.setOutput(32);

btn5.watch(Edge.Both, (state) => {
  console.log('DISPENSER =', state);
  dis5.write(state);
}, 1000);*/

setInterval(() => {
  // FIXME: Event not being rejected
  led.pulse(1000);
}, 2000);

btn1.watch(Edge.High, (state) => {
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


// TODO: When taking control from other side, there is some desync happening