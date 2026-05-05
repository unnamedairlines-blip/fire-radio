const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static('public'));

// Key: socket.id, Value: { callsign: string, channels: [] }
const unitRegistry = {};

io.on('connection', (socket) => {
    unitRegistry[socket.id] = { callsign: 'Unknown', channels: [] };

    // When a user updates their callsign or monitors a channel
    socket.on('update-status', (status) => {
        unitRegistry[socket.id] = {
            callsign: status.callsign,
            channels: status.channels
        };
        // Send the updated list to everyone
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
http.listen(PORT, () => console.log(`Registry Server Active on ${PORT}`));