const http = require('http');
const { Server } = require('socket.io');

module.exports = function installObservers(mightygpio) {
    const server = http.createServer();
    const io = new Server(server, { cors: { origin: "*" }});

    server.listen(4000, () => {
        console.log('Server listening on http://localhost:4000');
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


