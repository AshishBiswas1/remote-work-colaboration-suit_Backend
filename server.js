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
const WebRTCSignalingServer = require('./controller/webrtcSignaling');

// Environment variables
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server with Express app
const server = createServer(app);

// Initialize WebRTC signaling server for collaborative features
const webrtcServer = new WebRTCSignalingServer();

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
  console.log(`📡 Main API: http://localhost:${PORT}`);
  console.log(`🔗 WebRTC Signaling: ws://localhost:${PORT}/yjs-ws`);
  console.log(`💬 Chat Server: Socket.IO on port 8080 (when session created)`);
  console.log(`📝 Collaborative Editing: Y.js + WebRTC ready`);
  console.log(`📊 Stats API: http://localhost:${PORT}/api/collab/webrtc/stats`);
  
  // Initialize WebRTC signaling server
  webrtcServer.initialize(server, '/yjs-ws');
  
  // Make webrtcServer available to Express app for API endpoints
  app.set('webrtcServer', webrtcServer);
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
module.exports = { server, webrtcServer };
