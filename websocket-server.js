const http = require('http');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');

const PORT = process.env.WS_PORT || 1234;

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Y.js WebSocket Server is running\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

console.log('🚀 Y.js WebSocket Server Starting...');

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  const url = req.url || '/';
  console.log(`📡 New client connected to room "${url}" from: ${clientIp}`);
  
  setupWSConnection(ws, req);
  
  ws.on('close', () => {
    console.log(`📴 Client disconnected from room "${url}": ${clientIp}`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ Y.js WebSocket Server running on:`);
  console.log(`   Local:   ws://localhost:${PORT}`);
  console.log(`   Network: ws://[YOUR_IP]:${PORT}`);
  console.log('');
  console.log('📝 Rooms are created automatically when clients connect');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  wss.close(() => {
    server.close(() => {
      console.log('✅ Server closed gracefully');
      process.exit(0);
    });
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  wss.close(() => {
    server.close(() => {
      console.log('✅ Server closed gracefully');
      process.exit(0);
    });
  });
});
