require('dotenv').config({ path: './Config.env' });

// Check if DATABASE is loaded correctly
if(!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_KEY) {
    process.exit(1);
}

// Handling uncaught exceptions
process.on('uncaughtException', err => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error('Error:', err.name, err.message);
  console.error('Stack:', err.stack);
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
  // Error handling
});

io.engine.on('connection_error', (err) => {
  // Error handling
});

// Initialize chat controller with Socket.IO
const { activeRooms, userSessions } = ChatController.initializeSocketIO(io);

// Initialize WebRTC signaling server for collaborative features
const webrtcServer = new WebRTCSignalingServer();

// Initialize socket-based video call signaling (join/offer/answer/ice)
const videoSignaling = VideoCallSignaling.initialize(io);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);
  console.log(`📡 API Base: http://localhost:${PORT}`);
  
  // Initialize WebRTC signaling server first
  try {
    webrtcServer.initialize(server, '/yjs-ws');
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
  
});

// Handle unhandled promise rejections
process.on('unhandledRejection', err => {
  console.error('💥 UNHANDLED REJECTION! Shutting down...');
  console.error('Error:', err?.name, err?.message);
  console.error('Stack:', err?.stack);
  
  // Gracefully shutdown WebRTC server
  webrtcServer.shutdown();
  
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM and SIGINT for graceful shutdown
const gracefulShutdown = (signal) => {
  
  // Close WebRTC signaling server
  webrtcServer.shutdown();
  
  // Close HTTP server
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export for testing and API integration
module.exports = { server, webrtcServer, io };
