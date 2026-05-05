const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Operator terminal active:', socket.id);

    // Relays specific channel audio packets out to other operators
    socket.on('audio-data', (packet) => {
        // Broadcasts packet containing: { channel, callsign, data }
        socket.broadcast.emit('audio-stream', packet);
    });

    socket.on('disconnect', () => {
        console.log('Operator terminal offline');
    });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => {
    console.log(`Relay Server Active on Port ${PORT}`);
});