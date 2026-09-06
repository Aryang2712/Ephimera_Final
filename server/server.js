const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('🟢 Peer connected to the matchmaker');

  ws.on('message', (message) => {
    // Broadcast every handshake message to all other connected peers
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });

  ws.on('close', () => console.log('🔴 Peer disconnected'));
});

console.log('🚀 Epimera Signaling Server running on port 8080');