const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

// If someone visits the URL in a browser, they hear the radio
app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('audio-data', (data) => {
        socket.broadcast.emit('audio-stream', data);
    });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => console.log('Relay Server Active'));