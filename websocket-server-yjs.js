const http = require('http');
const WebSocket = require('ws');
const Y = require('yjs');

const PORT = process.env.WS_PORT || 1234;

// Store Y.Doc instances per room
const docs = new Map();
const connections = new Map(); // Store connections per room

// Get or create Y.Doc for a room
function getYDoc(roomName) {
  if (!docs.has(roomName)) {
    const doc = new Y.Doc();
    docs.set(roomName, doc);
    connections.set(roomName, new Set());
    console.log(`📄 Created new Y.Doc for room: ${roomName}`);
  }
  return docs.get(roomName);
}

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
  const roomName = url.slice(1) || 'default'; // Remove leading '/'
  
  console.log(`📡 New client connected to room "${roomName}" from: ${clientIp}`);
  
  const doc = getYDoc(roomName);
  const roomConnections = connections.get(roomName);
  
  // Add this connection to the room
  roomConnections.add(ws);
  ws.roomName = roomName;
  
  // Send full document state to new client
  ws.send(Y.encodeStateAsUpdate(doc));
  
  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const uint8Array = new Uint8Array(message);
      
      // Apply update to document
      Y.applyUpdate(doc, uint8Array);
      
      // Broadcast update to other clients in the same room
      roomConnections.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(uint8Array);
        }
      });
    } catch (error) {
      console.error(`❌ Error processing message in room "${roomName}":`, error.message);
    }
  });
  
  ws.on('close', () => {
    roomConnections.delete(ws);
    console.log(`📴 Client disconnected from room "${roomName}": ${clientIp}`);
    
    // Clean up empty rooms
    if (roomConnections.size === 0) {
      docs.delete(roomName);
      connections.delete(roomName);
      console.log(`🗑️  Cleaned up empty room: ${roomName}`);
    }
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error in room "${roomName}":`, error.message);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ Y.js WebSocket Server running on:`);
  console.log(`   Local:   ws://localhost:${PORT}`);
  console.log(`   Network: ws://[YOUR_IP]:${PORT}`);
  console.log('');
  console.log('📝 Rooms are created automatically when clients connect');
  console.log('📝 Use ws://localhost:${PORT}/room-name format from client');
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
