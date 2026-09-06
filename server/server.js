const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const rooms = new Map(); 

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (message) => {
    const { type, room, payload } = JSON.parse(message);

    switch (type) {
      case 'join':
        currentRoom = room;
        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room).add(ws);
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        // Relay SDP and ICE data to everyone else in the room
        if (currentRoom && rooms.has(currentRoom)) {
          rooms.get(currentRoom).forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type, payload }));
            }
          });
        }
        break;
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);
      if (rooms.get(currentRoom).size === 0) rooms.delete(currentRoom);
    }
  });
});

server.listen(8080, () => console.log(`🚀 EPHIMERA Signaling Server running on port 8080`));