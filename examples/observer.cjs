const http = require('http');
const { Server } = require('socket.io');
const os = require("os");

const hostname = os.hostname();

module.exports = function installObservers(mightygpio) {
    const server = http.createServer((req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*',
            'X-Mighty-Device': hostname,
        });
        res.end('HTTP Server is running\n');
    });

    const io = new Server(server, { cors: { origin: "*" }});

    server.listen(46991, () => {
        console.log('Server listening on http://localhost:46991');
    });

    io.on('connection', (socket) => {
        mightygpio.setObservers({
            send: function (pin, state, mode, resistor) {
                return new Promise((resolve) => {
                    const args = [pin, state, mode, resistor];
                    socket.emit("pin:send", ...args, (state) => resolve(state));
                });
            },
            receive: function (handler) {
                socket.on("pin:toggle", async (pin, state, mode, resistor, callback) => {
                    const result = await handler(pin, state, mode, resistor);
                    callback?.(result);
                });
            },
        });

        socket.on("disconnect", (reason) => {
            socket.removeAllListeners("pin:toggle");
        });
    });
}


