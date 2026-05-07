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
        const activeChannel = status.activeChannel ? String(status.activeChannel) : null;

        if (existing.activeChannel && existing.activeChannel !== activeChannel) {
            socket.leave(existing.activeChannel);
        }

        if (activeChannel) {
            socket.join(activeChannel);
        }

        unitRegistry[socket.id] = {
            callsign,
            activeChannel,
            transmitting: existing.activeChannel === activeChannel ? existing.transmitting || false : false
        };
        io.emit('unit-list-update', unitRegistry);
    });

    socket.on('tx-status', (status) => {
        if (!unitRegistry[socket.id]) return;

        unitRegistry[socket.id].transmitting = Boolean(status.transmitting);
        socket.to(unitRegistry[socket.id].activeChannel).emit('tx-status', {
            callsign: unitRegistry[socket.id].callsign,
            activeChannel: unitRegistry[socket.id].activeChannel,
            transmitting: unitRegistry[socket.id].transmitting
        });
        io.emit('unit-list-update', unitRegistry);
    });

    socket.on('audio-packet', (packet) => {
        const unit = unitRegistry[socket.id];
        if (!unit || !unit.activeChannel) return;

        socket.to(unit.activeChannel).emit('audio-out', {
            ...packet,
            channel: unit.activeChannel
        });
    });

    socket.on('disconnect', () => {
        delete unitRegistry[socket.id];
        io.emit('unit-list-update', unitRegistry);
    });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => console.log(`Radio Relay Active on ${PORT}`));
