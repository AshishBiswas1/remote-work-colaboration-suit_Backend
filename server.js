require('dotenv').config({ path: './Config.env' });

// Check if DATABASE is loaded correctly
if(!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('DATABASE_URL or DATABASE_KEYS are missing in the .env file!');
    process.exit(1);
}

// Handling uncaught exceptions
process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err);
  process.exit(1);
});

// Import app
const app = require('./app');
const { createServer } = require('http');
const socketIo = require('socket.io');
const WebRTCSignalingServer = require('./controller/webrtcSignaling');
const VideoCallSignaling = require('./controller/videoCallSignaling');
const ChatController = require('./controller/chatController');

// Environment variables
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server with Express app
const server = createServer(app);

// Configure Socket.IO with CORS
const io = socketIo(server, {
  path: '/socket.io/',
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Add Socket.IO error handling
io.on('error', (error) => {
  console.error('❌ Socket.IO server error:', error);
});

io.engine.on('connection_error', (err) => {
  console.error('❌ Socket.IO connection error:', err.req);
  console.error('❌ Error code:', err.code);
  console.error('❌ Error message:', err.message);
  console.error('❌ Error context:', err.context);
});

// Initialize chat controller with Socket.IO
const { activeRooms, userSessions } = ChatController.initializeSocketIO(io);

// Initialize WebRTC signaling server for collaborative features
const webrtcServer = new WebRTCSignalingServer();

// Initialize socket-based video call signaling (join/offer/answer/ice)
const videoSignaling = VideoCallSignaling.initialize(io);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
  console.log(`📡 Main API: http://localhost:${PORT}`);
  console.log(`🔗 WebRTC Signaling: ws://localhost:${PORT}/yjs-ws`);
  console.log(`💬 Socket.IO Chat: http://localhost:${PORT}/socket.io/`);
  console.log(`📝 Collaborative Editing: Y.js + WebRTC ready`);
  console.log(`📊 Stats API: http://localhost:${PORT}/api/collab/webrtc/stats`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/collab/chat`);
  
  // Initialize WebRTC signaling server first
  try {
    webrtcServer.initialize(server, '/yjs-ws');
    console.log('✅ WebRTC signaling server initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize WebRTC server:', error);
  }
  
  // Make webrtcServer and chat data available to Express app for API endpoints
  app.set('webrtcServer', webrtcServer);
  app.set('activeRooms', activeRooms);
  app.set('userSessions', userSessions);
  
  // Make chat data globally available for chat API
  global.activeRooms = activeRooms;
  global.userSessions = userSessions;
  
  console.log('✅ Socket.IO chat server ready for connections');
  console.log('🎯 Frontend should connect to: http://localhost:8000');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err);
  
  // Gracefully shutdown WebRTC server
  webrtcServer.shutdown();
  
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM and SIGINT for graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Close WebRTC signaling server
  webrtcServer.shutdown();
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ Server shut down successfully');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export for testing and API integration
module.exports = { server, webrtcServer, io };
