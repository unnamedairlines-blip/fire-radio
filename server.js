const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve the web listener page
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Receive audio from Electron Broadcaster
    socket.on('audio-data', (data) => {
        // Send to all listeners (Browsers/Phones)
        socket.broadcast.emit('audio-stream', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});