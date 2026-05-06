const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static('public'));

const unitRegistry = {};

io.on('connection', (socket) => {
    socket.on('update-status', (status) => {
        unitRegistry[socket.id] = {
            callsign: status.callsign.toUpperCase(),
            activeChannel: status.activeChannel
        };
        io.emit('unit-list-update', unitRegistry);
    });

    socket.on('audio-packet', (packet) => {
        socket.broadcast.emit('audio-out', packet);
    });

    socket.on('disconnect', () => {
        delete unitRegistry[socket.id];
        io.emit('unit-list-update', unitRegistry);
    });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => console.log(`Radio Relay Active on ${PORT}`));