/**
 * WebRTC Collaborative Editing Test Client
 * 
 * This test client demonstrates how to connect to the WebRTC signaling server
 * and establish collaborative document editing using Y.js.
 * 
 * Usage: node webrtcTestClient.js [room_name]
 */

const WebSocket = require('ws');
const { Doc } = require('yjs');

class CollaborativeEditingClient {
  constructor(serverUrl, roomName = 'test-room') {
    this.serverUrl = serverUrl;
    this.roomName = roomName;
    this.ws = null;
    this.ydoc = new Doc();
    this.isConnected = false;
    
    // Create a shared text type for collaborative editing
    this.sharedText = this.ydoc.getText('content');
    
    console.log(`🔗 Collaborative Editing Client`);
    console.log(`📁 Room: ${roomName}`);
    console.log(`🌐 Server: ${serverUrl}`);
  }

  /**
   * Connect to the WebRTC signaling server
   */
  connect() {
    const wsUrl = `${this.serverUrl}/yjs-ws?room=${encodeURIComponent(this.roomName)}`;
    
    console.log(`🔌 Connecting to: ${wsUrl}`);
    
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      this.isConnected = true;
      console.log('✅ Connected to WebRTC signaling server');
      console.log('📝 Ready for collaborative editing');
      
      // Setup Y.js document synchronization
      this.setupDocumentSync();
      
      // Start interactive mode
      this.startInteractiveMode();
    });

    this.ws.on('message', (data) => {
      try {
        // Handle Y.js protocol messages
        console.log('📨 Received sync message');
        // In a real implementation, you'd handle Y.js update messages here
      } catch (error) {
        console.error('❌ Error processing message:', error);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.isConnected = false;
      console.log(`❌ Connection closed: ${code} - ${reason}`);
    });

    this.ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
  }

  /**
   * Setup Y.js document synchronization
   */
  setupDocumentSync() {
    // Listen for changes to the shared document
    this.sharedText.observe((event) => {
      console.log('📝 Document changed:', event);
      console.log('📄 Current content:', this.sharedText.toString());
    });

    // In a real implementation, you'd setup Y.js WebSocket provider here
    console.log('🔄 Document synchronization ready');
  }

  /**
   * Start interactive mode for testing
   */
  startInteractiveMode() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n📝 Interactive Collaborative Editing Mode:');
    console.log('Commands:');
    console.log('- Type text to add to the document');
    console.log('- "status" to check connection status');
    console.log('- "content" to view current document content');
    console.log('- "clear" to clear the document');
    console.log('- "quit" to exit\n');

    rl.on('line', (input) => {
      const command = input.trim().toLowerCase();

      if (command === 'quit' || command === 'exit') {
        console.log('👋 Disconnecting...');
        this.disconnect();
        rl.close();
        process.exit(0);
        return;
      }

      if (command === 'status') {
        console.log(`📊 Status: ${this.isConnected ? '🟢 Connected' : '🔴 Disconnected'}`);
        console.log(`📁 Room: ${this.roomName}`);
        console.log(`📄 Document length: ${this.sharedText.length} characters`);
        return;
      }

      if (command === 'content') {
        console.log(`📄 Current document content:`);
        console.log(`"${this.sharedText.toString()}"`);
        return;
      }

      if (command === 'clear') {
        this.sharedText.delete(0, this.sharedText.length);
        console.log('🗑️  Document cleared');
        return;
      }

      // Add text to the document
      if (input.trim()) {
        const currentLength = this.sharedText.length;
        this.sharedText.insert(currentLength, input + '\n');
        console.log(`✅ Added: "${input}"`);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.ws && this.isConnected) {
      this.ws.close();
    }
  }
}

// Main execution
const serverUrl = process.argv[2] || 'ws://localhost:8000';
const roomName = process.argv[3] || 'test-room';

const client = new CollaborativeEditingClient(serverUrl, roomName);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down client...');
  client.disconnect();
  process.exit(0);
});

// Start the client
client.connect();

module.exports = CollaborativeEditingClient;