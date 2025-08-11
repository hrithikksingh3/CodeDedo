// server.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// serve static files from /public
app.use(express.static(path.join(__dirname, 'Public')));

// in-memory storage for last snapshot per room
const rooms = {}; // rooms[roomId] = { code: '...' }

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join', ({ room, role }) => {
    if (!room) return;
    socket.join(room);
    socket.data.room = room;
    socket.data.role = role || 'guest';
    console.log(`${socket.id} joined ${room} as ${socket.data.role}`);

    // ack back to the joining socket
    socket.emit('joined', { room, role: socket.data.role });

    // send last known code snapshot (if any) to the newcomer
    if (rooms[room] && typeof rooms[room].code === 'string') {
      socket.emit('code-update', rooms[room].code);
    }

    // tell other members someone joined
    socket.to(room).emit('peer-joined', { id: socket.id, role: socket.data.role });
  });

  socket.on('code-change', ({ room, code }) => {
    if (!room) return;
    rooms[room] = rooms[room] || {};
    rooms[room].code = code;
    // broadcast to everyone else in the room
    socket.to(room).emit('code-update', code);
  });

  socket.on('send-snapshot', ({ room, code }) => {
    if (!room) return;
    rooms[room] = rooms[room] || {};
    rooms[room].code = code;
    socket.to(room).emit('code-update', code);
  });

  socket.on('leave', ({ room }) => {
    if (room) {
      socket.leave(room);
      socket.to(room).emit('peer-left', { id: socket.id });
    }
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
    const room = socket.data.room;
    if (room) socket.to(room).emit('peer-left', { id: socket.id });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
