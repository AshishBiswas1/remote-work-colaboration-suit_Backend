const WebSocket = require('ws');

/**
 * Simple WebSocket server for Y.js collaboration
 * 
 * This server provides basic WebSocket functionality for Y.js WebrtcProvider
 * The actual Y.js document synchronization is handled on the client side
 */

class WebRTCSignalingServer {
  constructor() {
    this.wss = null;
    this.activeConnections = new Map();
    this.documentRooms = new Map(); // roomName -> Set of WebSocket connections
  }

  /**
   * Initialize the WebRTC signaling server
   * @param {http.Server} server - HTTP server instance
   * @param {string} path - WebSocket endpoint path
   */
  initialize(server, path = '/yjs-ws') {
    this.wss = new WebSocket.Server({ 
      server,
      path: path,
      // WebSocket CORS configuration
      verifyClient: (info) => {
        const allowedOrigins = [
          'http://localhost:5173',
          'http://localhost:3000',
          'http://localhost:8000'
        ];
        
        const origin = info.origin;
        return !origin || allowedOrigins.some(allowed => origin.startsWith(allowed));
      }
    });


    this.setupEventHandlers();
    return this.wss;
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.wss.on('connection', (ws, req) => {
      const connectionId = this.generateConnectionId();
      const url = new URL(req.url, `http://${req.headers.host}`);
      const roomName = url.searchParams.get('room') || 'default';
      
      
      // Add to room
      if (!this.documentRooms.has(roomName)) {
        this.documentRooms.set(roomName, new Set());
      }
      this.documentRooms.get(roomName).add(ws);
      
      // Set room reference on WebSocket
      ws.roomName = roomName;
      ws.connectionId = connectionId;
      
      // Track connection
      this.activeConnections.set(connectionId, {
        ws,
        roomName,
        connectedAt: new Date().toISOString()
      });

      // Handle messages - simple relay to other clients in the same room
      ws.on('message', (message) => {
        try {
          // Broadcast message to all other clients in the same room
          this.documentRooms.get(roomName).forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
        } catch (error) {
          console.error(`Error relaying message in room ${roomName}:`, error.message);
        }
      });

      // Handle connection close
      ws.on('close', () => {
        this.handleDisconnection(connectionId, roomName, ws);
      });

      // Handle WebSocket errors
      ws.on('error', (error) => {
        console.error(`❌ WebSocket Error for ${connectionId}:`, error.message);
        this.handleDisconnection(connectionId, roomName, ws);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        roomName: roomName,
        connectionId: connectionId,
        timestamp: new Date().toISOString()
      }));
    });

    // Handle WebSocket server errors
    this.wss.on('error', (error) => {
      console.error('❌ WebSocket Server Error:', error);
    });
  }

  /**
   * Handle client disconnection
   * @param {string} connectionId - Connection identifier
   * @param {string} roomName - Room name
   * @param {WebSocket} ws - WebSocket connection
   */
  handleDisconnection(connectionId, roomName, ws) {
    // Remove from active connections
    this.activeConnections.delete(connectionId);

    // Remove from room
    if (this.documentRooms.has(roomName)) {
      this.documentRooms.get(roomName).delete(ws);
      
      // Clean up empty rooms
      if (this.documentRooms.get(roomName).size === 0) {
        this.documentRooms.delete(roomName);
      }
    }
  }

  /**
   * Generate unique connection ID
   * @returns {string} Unique connection identifier
   */
  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Get server statistics
   * @returns {object} Server statistics
   */
  getStats() {
    return {
      activeConnections: this.activeConnections.size,
      activeRooms: this.documentRooms.size,
      roomDetails: Array.from(this.documentRooms.entries()).map(([room, connections]) => ({
        roomName: room,
        participants: connections.size
      }))
    };
  }

  /**
   * Broadcast message to all connections in a room
   * @param {string} roomName - Room name
   * @param {object} message - Message to broadcast
   */
  broadcastToRoom(roomName, message) {
    if (!this.documentRooms.has(roomName)) {
      return false;
    }

    const roomConnections = this.documentRooms.get(roomName);
    let sentCount = 0;

    roomConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`Failed to send message to connection:`, error);
        }
      }
    });

    return sentCount;
  }

  /**
   * Close all connections and shutdown server
   */
  shutdown() {
    
    if (this.wss) {
      this.wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Server shutting down');
        }
      });
      
      this.wss.close(() => {
      });
    }

    this.activeConnections.clear();
    this.documentRooms.clear();
  }
}

module.exports = WebRTCSignalingServer;
