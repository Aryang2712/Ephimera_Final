const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
  const remoteIp = req.socket.remoteAddress;
  console.log(`🟢 Peer connected from ${remoteIp}. Total active peers: ${wss.clients.size}`);

  ws.on('message', (message) => {
    let msgType = 'unknown';
    let clientId = 'unknown';
    try {
      const parsed = JSON.parse(message.toString());
      msgType = parsed.type || 'data';
      clientId = parsed.clientId || 'anonymous';
    } catch {}

    let recipientCount = 0;
    // Broadcast every handshake message to all other connected peers
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
        recipientCount++;
      }
    });

    console.log(`📨 [${msgType}] from ${clientId.substring(0, 8)} -> relayed to ${recipientCount} peer(s)`);
  });

  ws.on('close', () => {
    console.log(`🔴 Peer disconnected. Total active peers: ${wss.clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('⚠️ WebSocket error:', err.message);
  });
});

console.log('🚀 Epimera Signaling Server running on port 8080');