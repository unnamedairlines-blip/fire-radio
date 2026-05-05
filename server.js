const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('User connected to Fire-Radio');

    // Receive audio chunk from one user and broadcast to everyone else
    socket.on('audio-stream', (data) => {
        socket.broadcast.emit('audio-broadcast', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Port handling for Render
const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Radio server active on port ${PORT}`);
});