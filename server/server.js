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

// Bind to 0.0.0.0 so all LAN devices can connect
const wss = new WebSocket.Server({ port: 8080, host: '0.0.0.0' });

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
    let room = null;
    try {
      const parsed = JSON.parse(message.toString());
      msgType = parsed.type || 'data';
      clientId = parsed.clientId || 'anonymous';
      targetClientId = parsed.targetClientId || null;
      room = parsed.room || null;
      if (clientId) ws.clientId = clientId;
      if (room) ws.room = room;
    } catch {}

    let recipientCount = 0;
    // Broadcast handshake message to connected peers
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        // If message is for a specific target peer, only send to them
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

console.log('🚀 Epimera Signaling Server running on port 8080 (0.0.0.0)');
const localIps = getLocalIps();
if (localIps.length > 0) {
  console.log('📡 Local Wi-Fi IP(s) for other Laptops to connect:');
  localIps.forEach((item) => {
    console.log(`   ➜ ${item.name}: http://${item.ip}:5173  (Signaling: ws://${item.ip}:8080)`);
  });
}