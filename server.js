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
const monitorChannels = {};
const TONE_BOARD_CODE = process.env.TONE_BOARD_CODE || '2468';
const robloxUserCache = new Map();

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

async function resolveRobloxUsername(username) {
    const requestedUsername = String(username || '').trim();
    if (!requestedUsername) return '';

    const cacheKey = requestedUsername.toLowerCase();
    if (robloxUserCache.has(cacheKey)) return robloxUserCache.get(cacheKey);

    try {
        const response = await fetch('https://users.roblox.com/v1/usernames/users', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                usernames: [requestedUsername],
                excludeBannedUsers: false
            })
        });
        const result = await response.json();
        const user = result && result.data && result.data[0];
        const resolvedUsername = user && user.name ? user.name : requestedUsername;
        robloxUserCache.set(cacheKey, resolvedUsername);
        return resolvedUsername;
    } catch (err) {
        console.warn('Unable to resolve Roblox username', err);
        return requestedUsername;
    }
}

function releaseMonitor(socket) {
    const monitoredChannel = monitorChannels[socket.id];
    if (!monitoredChannel) return;

    const unit = unitRegistry[socket.id];
    if (!unit || unit.activeChannel !== monitoredChannel) {
        socket.leave(monitoredChannel);
    }
    delete monitorChannels[socket.id];
}

io.on('connection', (socket) => {
    socket.on('update-status', async (status, ack) => {
        const existing = unitRegistry[socket.id] || {};
        const callsign = String(status.callsign || '').trim().toUpperCase();
        const activeChannel = status.activeChannel ? String(status.activeChannel) : null;
        const robloxUsername = await resolveRobloxUsername(status.robloxUsername);

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
            if (monitorChannels[socket.id] !== existing.activeChannel) {
                socket.leave(existing.activeChannel);
            }
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
            robloxUsername,
            activeChannel,
            transmitting: existing.activeChannel === activeChannel ? existing.transmitting || false : false
        };
        io.emit('unit-list-update', unitRegistry);
        if (ack) ack({ ok: true, callsign, robloxUsername });
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

    socket.on('monitor-channel', (channelId, ack) => {
        const nextChannel = channelId ? String(channelId) : null;
        const previousChannel = monitorChannels[socket.id];
        const unit = unitRegistry[socket.id];

        if (previousChannel && previousChannel !== nextChannel && (!unit || unit.activeChannel !== previousChannel)) {
            socket.leave(previousChannel);
        }

        if (nextChannel) {
            socket.join(nextChannel);
            monitorChannels[socket.id] = nextChannel;
        } else {
            delete monitorChannels[socket.id];
        }

        if (ack) ack({ ok: true, channel: nextChannel });
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

    socket.on('tone-packet', (packet, ack) => {
        const channel = packet && packet.channel ? String(packet.channel) : null;
        const code = packet && packet.code ? String(packet.code) : '';

        if (code !== TONE_BOARD_CODE) {
            if (ack) ack({ ok: false, reason: 'bad-code' });
            return;
        }

        if (!channel || !packet.data || !packet.sampleRate) {
            if (ack) ack({ ok: false, reason: 'bad-packet' });
            return;
        }

        socket.to(channel).emit('audio-out', {
            call: 'TONE BOARD',
            channel,
            data: packet.data,
            sampleRate: packet.sampleRate,
            seq: packet.seq || 0,
            tone: true
        });

        if (ack) ack({ ok: true });
    });

    socket.on('disconnect', () => {
        releaseMonitor(socket);
        releaseCallsign(socket.id);
        releaseTransmitter(socket.id);
        delete unitRegistry[socket.id];
        io.emit('unit-list-update', unitRegistry);
    });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => console.log(`Radio Relay Active on ${PORT}`));
