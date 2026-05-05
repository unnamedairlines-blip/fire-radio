const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static('public'));

const unitRegistry = {};

io.on('connection', (socket) => {
    unitRegistry[socket.id] = { callsign: 'Unknown', activeChannel: null };

    socket.on('update-status', (status) => {
        unitRegistry[socket.id] = {
            callsign: status.callsign,
            activeChannel: status.activeChannel // Only one active channel for speaking
        };
        io.emit('unit-list-update', unitRegistry);
    });

    socket.on('audio-data', (packet) => {
        socket.broadcast.emit('audio-stream', packet);
    });

    socket.on('disconnect', () => {
        delete unitRegistry[socket.id];
        io.emit('unit-list-update', unitRegistry);
    });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => console.log(`Radio Relay Active`));