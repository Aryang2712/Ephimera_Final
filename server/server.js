const http = require('http');
const WebSocket = require('ws');
const os = require('os');

function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, ip: iface.address });
      }
    }
  }
  return ips;
}

const PORT = process.env.PORT || 8080;

// HTTP server for Render health checks + WebSocket Upgrade
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('EPHIMERA Signaling Server is Online 🚀\n');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const remoteIp = req.socket.remoteAddress;
  console.log(`🟢 Peer connected from ${remoteIp}. Total active peers: ${wss.clients.size}`);

  // Send LAN Wi-Fi connection info to the client
  const ips = getLocalIps();
  const primaryIface = ips.find(i => i.name.toLowerCase().includes('wi-fi') || i.name.toLowerCase().includes('wlan')) || ips[0];
  const lanUrl = primaryIface ? `http://${primaryIface.ip}:5173` : null;
  const lanIp = primaryIface ? primaryIface.ip : null;

  try {
    ws.send(JSON.stringify({
      type: 'server-info',
      lanUrl,
      lanIp,
      lanIps: ips
    }));
  } catch {}

  ws.on('message', (message) => {
    let msgType = 'unknown';
    let clientId = 'unknown';
    let targetClientId = null;
    let room = 'ephimera-global-room';
    try {
      const parsed = JSON.parse(message.toString());
      msgType = parsed.type || 'data';
      clientId = parsed.clientId || 'anonymous';
      targetClientId = parsed.targetClientId || null;
      room = parsed.room || 'ephimera-global-room';
      if (clientId && clientId !== 'anonymous') ws.clientId = clientId;
      if (room) ws.room = room;

      // When a new client joins, immediately send them the list of all peers already in the room!
      if (msgType === 'join') {
        const existingPeers = [];
        wss.clients.forEach((c) => {
          if (c !== ws && c.readyState === WebSocket.OPEN && c.clientId && c.room === room) {
            existingPeers.push(c.clientId);
          }
        });
        try {
          ws.send(JSON.stringify({
            type: 'room-peers',
            room,
            peers: existingPeers
          }));
        } catch (e) {}
      }
    } catch {}

    let recipientCount = 0;
    // Broadcast handshake message to peers in the same room
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        // Room isolation
        if (ws.room && client.room && ws.room !== client.room) {
          return;
        }
        // If message is targeted to a specific peer
        if (targetClientId && client.clientId !== targetClientId) {
          return;
        }
        client.send(message.toString());
        recipientCount++;
      }
    });

    console.log(`📨 [${msgType}] from ${clientId.substring(0, 8)} -> relayed to ${recipientCount} peer(s)`);
  });

  ws.on('close', () => {
    console.log(`🔴 Peer disconnected (${ws.clientId ? ws.clientId.substring(0, 8) : 'anon'}). Total active peers: ${wss.clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('⚠️ WebSocket error:', err.message);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Epimera Signaling Server running on port ${PORT} (0.0.0.0)`);
});

const localIps = getLocalIps();
if (localIps.length > 0) {
  console.log('📡 Local Wi-Fi IP(s) for other Laptops to connect:');
  localIps.forEach((item) => {
    console.log(`   ➜ ${item.name}: http://${item.ip}:5173  (Signaling: ws://${item.ip}:${PORT})`);
  });
}