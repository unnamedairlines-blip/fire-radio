const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static('public'));

const unitRegistry = {};
const channelTransmitters = {};
const callsignOwners = {};

function releaseCallsign(socketId) {
    const unit = unitRegistry[socketId];
    if (!unit || !unit.callsign) return;

    if (callsignOwners[unit.callsign] === socketId) {
        delete callsignOwners[unit.callsign];
    }
}

function releaseTransmitter(socketId) {
    const unit = unitRegistry[socketId];
    if (!unit || !unit.activeChannel) return;

    if (channelTransmitters[unit.activeChannel] === socketId) {
        delete channelTransmitters[unit.activeChannel];
    }
    unit.transmitting = false;
}

io.on('connection', (socket) => {
    socket.on('update-status', (status, ack) => {
        const existing = unitRegistry[socket.id] || {};
        const callsign = String(status.callsign || '').trim().toUpperCase();
        const activeChannel = status.activeChannel ? String(status.activeChannel) : null;

        if (!callsign) {
            releaseCallsign(socket.id);
            releaseTransmitter(socket.id);
            if (existing.activeChannel) socket.leave(existing.activeChannel);
            delete unitRegistry[socket.id];
            io.emit('unit-list-update', unitRegistry);
            if (ack) ack({ ok: false, reason: 'callsign-required' });
            return;
        }

        const callOwner = callsignOwners[callsign];
        if (callOwner && callOwner !== socket.id) {
            if (ack) ack({ ok: false, reason: 'callsign-taken', callsign });
            socket.emit('callsign-rejected', { callsign, reason: 'taken' });
            return;
        }

        if (existing.activeChannel && existing.activeChannel !== activeChannel) {
            releaseTransmitter(socket.id);
            socket.leave(existing.activeChannel);
        }

        if (existing.callsign && existing.callsign !== callsign) {
            releaseCallsign(socket.id);
        }

        if (activeChannel) {
            socket.join(activeChannel);
        }

        callsignOwners[callsign] = socket.id;
        unitRegistry[socket.id] = {
            callsign,
            activeChannel,
            transmitting: existing.activeChannel === activeChannel ? existing.transmitting || false : false
        };
        io.emit('unit-list-update', unitRegistry);
        if (ack) ack({ ok: true, callsign });
    });

    socket.on('tx-status', (status, ack) => {
        const unit = unitRegistry[socket.id];
        if (!unit || !unit.activeChannel) {
            if (ack) ack({ ok: false, reason: 'not-connected' });
            return;
        }

        if (status.transmitting) {
            const currentTransmitter = channelTransmitters[unit.activeChannel];
            if (currentTransmitter && currentTransmitter !== socket.id) {
                const currentUnit = unitRegistry[currentTransmitter];
                if (ack) ack({ ok: false, reason: 'channel-busy', callsign: currentUnit ? currentUnit.callsign : 'UNKNOWN' });
                return;
            }

            channelTransmitters[unit.activeChannel] = socket.id;
            unit.transmitting = true;
        } else if (channelTransmitters[unit.activeChannel] === socket.id) {
            releaseTransmitter(socket.id);
        }

        socket.to(unit.activeChannel).emit('tx-status', {
            callsign: unit.callsign,
            activeChannel: unit.activeChannel,
            transmitting: unit.transmitting
        });
        io.emit('unit-list-update', unitRegistry);
        if (ack) ack({ ok: true });
    });

    socket.on('audio-packet', (packet) => {
        const unit = unitRegistry[socket.id];
        if (!unit || !unit.activeChannel) return;
        if (channelTransmitters[unit.activeChannel] !== socket.id) return;

        socket.to(unit.activeChannel).emit('audio-out', {
            ...packet,
            channel: unit.activeChannel
        });
    });

    socket.on('disconnect', () => {
        releaseCallsign(socket.id);
        releaseTransmitter(socket.id);
        delete unitRegistry[socket.id];
        io.emit('unit-list-update', unitRegistry);
    });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => console.log(`Radio Relay Active on ${PORT}`));
