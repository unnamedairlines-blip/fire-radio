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
        const existing = unitRegistry[socket.id] || {};
        const callsign = String(status.callsign || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN';

        unitRegistry[socket.id] = {
            callsign,
            activeChannel: status.activeChannel,
            transmitting: existing.transmitting || false
        };
        io.emit('unit-list-update', unitRegistry);
    });

    socket.on('tx-status', (status) => {
        if (!unitRegistry[socket.id]) return;

        unitRegistry[socket.id].transmitting = Boolean(status.transmitting);
        socket.broadcast.emit('tx-status', {
            callsign: unitRegistry[socket.id].callsign,
            transmitting: unitRegistry[socket.id].transmitting
        });
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
