const { Server } = require('socket.io');
const readline = require('readline');

// Get session info from environment variables
const SESSION_ID = process.env.SESSION_ID;
const SESSION_NAME = process.env.SESSION_NAME || 'Chat Session';
const CREATOR_ID = process.env.CREATOR_ID;
const MAX_PARTICIPANTS = process.env.MAX_PARTICIPANTS;

// Create Socket.io server
const io = new Server(8080, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Track connected clients and session history
let connectedClients = new Map();
let allClients = new Map(); // Track all clients who have ever connected
let clientCount = 0;

console.log('🖥️  Chat Server started on port 8080');
console.log(`📊 Session: ${SESSION_NAME} (ID: ${SESSION_ID})`);
console.log(`👤 Creator: ${CREATOR_ID}`);
console.log(`👥 Max Participants: ${MAX_PARTICIPANTS === 'unlimited' ? 'Unlimited' : MAX_PARTICIPANTS}`);
console.log('Waiting for clients to connect...\n');

// Handle client connections
io.on('connection', (socket) => {
  let clientData = {
    id: socket.id,
    connected_at: new Date().toISOString(),
    isRejoining: false,
    userId: null
  };

  // Listen for rejoin request
  socket.on('rejoin', (data) => {
    const { userId } = data;
    
    if (userId && allClients.has(userId)) {
      // Client is rejoining with previous identity
      clientData.isRejoining = true;
      clientData.userId = userId;
      
      // Update the client record
      const previousData = allClients.get(userId);
      allClients.set(userId, {
        ...previousData,
        currentSocketId: socket.id,
        reconnected_at: new Date().toISOString(),
        connection_count: (previousData.connection_count || 1) + 1
      });
      
      console.log(`🔄 Client rejoined: ${userId} (Socket: ${socket.id})`);
      
      // Send rejoin confirmation
      socket.emit('rejoin-success', {
        message: `Welcome back to ${SESSION_NAME}! You are reconnected as ${userId}`,
        userId: userId,
        session_name: SESSION_NAME
      });
      
      // Notify other clients about rejoin
      socket.broadcast.emit('user-rejoined', {
        message: `${userId} rejoined the chat`,
        userId: userId,
        total_clients: clientCount + 1
      });
      
    } else {
      // Invalid rejoin attempt
      socket.emit('rejoin-error', {
        message: 'Invalid user ID or user never existed in this session'
      });
      return;
    }
  });

  // Check participant limit (only if not unlimited and not rejoining)
  if (!clientData.isRejoining && MAX_PARTICIPANTS !== 'unlimited' && clientCount >= parseInt(MAX_PARTICIPANTS)) {
    console.log(`❌ Connection rejected: Maximum participants (${MAX_PARTICIPANTS}) reached`);
    socket.emit('error', { message: 'Session is full. Maximum participants reached.' });
    socket.disconnect();
    return;
  }

  // If not rejoining, this is a new client
  if (!clientData.isRejoining) {
    clientData.userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    
    // Add to all clients history
    allClients.set(clientData.userId, {
      userId: clientData.userId,
      currentSocketId: socket.id,
      first_connected_at: clientData.connected_at,
      connection_count: 1
    });
  }

  clientCount++;
  connectedClients.set(socket.id, clientData);

  console.log(`✅ Client ${clientData.isRejoining ? 'rejoined' : 'connected'}: ${clientData.userId} (Socket: ${socket.id})`);
  console.log(`👥 Total clients: ${clientCount}/${MAX_PARTICIPANTS === 'unlimited' ? '∞' : MAX_PARTICIPANTS}`);
  
  if (!clientData.isRejoining) {
    // Notify all clients about new user (only for new connections)
    socket.broadcast.emit('user-joined', {
      message: `${clientData.userId} joined the chat`,
      userId: clientData.userId,
      total_clients: clientCount
    });

    // Send welcome message to new client
    socket.emit('message', {
      message: `Welcome to ${SESSION_NAME}! You are connected as ${clientData.userId}`,
      userId: clientData.userId,
      session_name: SESSION_NAME
    });
  }
 
  // Handle incoming messages from client
  socket.on('message', (data) => {
    const client = connectedClients.get(socket.id);
    const userId = client ? client.userId : socket.id.slice(-4);
    
    console.log(`📱 ${userId}: ${data.message}`);
    
    // Broadcast message to all other clients
    socket.broadcast.emit('message', {
      message: data.message,
      from: userId,
      timestamp: new Date().toISOString()
    });
  });

  // Handle get user ID request
  socket.on('get-user-id', () => {
    const client = connectedClients.get(socket.id);
    if (client) {
      socket.emit('user-id-response', {
        userId: client.userId,
        session_name: SESSION_NAME
      });
    }
  });
 
  // Handle client disconnect
  socket.on('disconnect', () => {
    const client = connectedClients.get(socket.id);
    const userId = client ? client.userId : 'Unknown';
    
    clientCount--;
    connectedClients.delete(socket.id);
    
    // Keep the client in allClients for potential rejoin, just update status
    if (client && client.userId && allClients.has(client.userId)) {
      const clientHistory = allClients.get(client.userId);
      allClients.set(client.userId, {
        ...clientHistory,
        last_disconnected_at: new Date().toISOString(),
        currentSocketId: null // Mark as disconnected
      });
    }
    
    console.log(`❌ Client disconnected: ${userId} (Socket: ${socket.id})`);
    console.log(`👥 Total clients: ${clientCount}/${MAX_PARTICIPANTS === 'unlimited' ? '∞' : MAX_PARTICIPANTS}`);
    
    // Notify remaining clients
    socket.broadcast.emit('user-left', {
      message: `${userId} left the chat`,
      userId: userId,
      total_clients: clientCount
    });
  });
 
  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Function to send message to all clients
function broadcastMessage(message) {
  if (connectedClients.size > 0) {
    io.emit('message', { 
      message: message,
      from: 'Server',
      timestamp: new Date().toISOString()
    });
    console.log(`🖥️  Server: ${message}`);
  } else {
    console.log('❌ No clients connected');
  }
}

// Handle user input (server console)
rl.on('line', (input) => {
  if (input.trim() === '') return;
 
  if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
    console.log('👋 Server shutting down...');
    io.emit('message', { message: 'Server is shutting down. Goodbye!' });
    setTimeout(() => {
      io.close();
      process.exit(0);
    }, 1000);
    return;
  }

  if (input.toLowerCase() === 'status') {
    console.log(`📊 Chat Session Status:`);
    console.log(`   Session: ${SESSION_NAME}`);
    console.log(`   Connected Clients: ${clientCount}`);
    console.log(`   Max Participants: ${MAX_PARTICIPANTS === 'unlimited' ? 'Unlimited' : MAX_PARTICIPANTS}`);
    console.log(`   Total Clients (Ever): ${allClients.size}`);
    
    if (allClients.size > 0) {
      console.log(`   Client History:`);
      allClients.forEach((client, userId) => {
        const status = client.currentSocketId ? '🟢 Connected' : '🔴 Disconnected';
        console.log(`     - ${userId}: ${status} (Connections: ${client.connection_count})`);
      });
    }
    return;
  }
 
  broadcastMessage(input);
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Server shutting down...');
  io.emit('message', { message: 'Server is shutting down. Goodbye!' });
  setTimeout(() => {
    io.close();
    process.exit(0);
  }, 1000);
});

console.log('Commands:');
console.log('- Type any message and press Enter to broadcast to all clients');
console.log('- Type "status" to check current session status');
console.log('- Type "quit" or "exit" to close the server');
console.log('- Press Ctrl+C to force quit\n');

module.exports = { io, broadcastMessage };