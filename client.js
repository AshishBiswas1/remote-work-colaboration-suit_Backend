const { io } = require('socket.io-client');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let socket = null;
let isConnected = false;
let userId = null;
let sessionName = null;

console.log('📱 Client starting...');
console.log('Attempting to connect to server on localhost:8080...\n');

// Connect to server
function connectToServer() {
    socket = io('http://localhost:8080', {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 20000
    });

    // Handle connection success
    socket.on('connect', () => {
        isConnected = true;
        console.log('✅ Connected to server!');
        
        // Request user ID from server
        socket.emit('get-user-id');
        
        console.log('You can now start chatting. Type your message and press Enter.\n');
    });

    // Handle user ID response
    socket.on('user-id-response', (data) => {
        userId = data.userId;
        sessionName = data.session_name;
        console.log(`👤 Your user ID: ${userId}`);
        console.log(`💬 Session: ${sessionName}\n`);
    });

    // Handle rejoin success
    socket.on('rejoin-success', (data) => {
        userId = data.userId;
        sessionName = data.session_name;
        console.log(`🔄 ${data.message}`);
        console.log(`👤 Your user ID: ${userId}\n`);
    });

    // Handle rejoin error
    socket.on('rejoin-error', (data) => {
        console.log(`❌ Rejoin failed: ${data.message}`);
    });

    // Handle user joined notifications
    socket.on('user-joined', (data) => {
        console.log(`👋 ${data.message} (Total: ${data.total_clients})`);
    });

    // Handle user rejoined notifications
    socket.on('user-rejoined', (data) => {
        console.log(`🔄 ${data.message} (Total: ${data.total_clients})`);
    });

    // Handle user left notifications
    socket.on('user-left', (data) => {
        console.log(`👋 ${data.message} (Total: ${data.total_clients})`);
    });

    // Handle incoming messages from server and other clients
    socket.on('message', (data) => {
        if (data.from === 'Server') {
            console.log(`🖥️  Server: ${data.message}`);
        } else if (data.from === userId) {
            // Don't show our own messages (they're already displayed when sent)
            return;
        } else {
            console.log(`💬 ${data.from}: ${data.message}`);
        }
    });

    // Handle connection disconnect
    socket.on('disconnect', (reason) => {
        isConnected = false;
        console.log(`❌ Disconnected from server: ${reason}`);
    });

    // Handle reconnection attempts
    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
    });

    // Handle successful reconnection
    socket.on('reconnect', (attemptNumber) => {
        isConnected = true;
        console.log(`✅ Reconnected to server after ${attemptNumber} attempts!`);
    });

    // Handle reconnection failure
    socket.on('reconnect_failed', () => {
        console.log('❌ Failed to reconnect to server');
    });

    // Handle connection errors
    socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error.message);
        console.log('Make sure the server is running on port 8080');
    });
}

// Function to send message to server
function sendMessage(message) {
    if (socket && isConnected) {
        socket.emit('message', { message: message });
        console.log(`📱 You: ${message}`);
    } else {
        console.log('❌ Not connected to server');
    }
}

// Handle user input
rl.on('line', (input) => {
    if (input.trim() === '') return;

    if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
        console.log('👋 Client disconnecting...');
        if (socket) {
            socket.disconnect();
        }
        process.exit(0);
    }

    if (input.toLowerCase() === 'reconnect') {
        console.log('🔄 Manually reconnecting...');
        if (socket) {
            socket.disconnect();
        }
        connectToServer();
        return;
    }

    if (input.toLowerCase() === 'status') {
        console.log(`📊 Connection status: ${isConnected ? 'Connected' : 'Disconnected'}`);
        console.log(`👤 User ID: ${userId || 'Not assigned'}`);
        console.log(`💬 Session: ${sessionName || 'Not joined'}`);
        return;
    }

    if (input.toLowerCase().startsWith('rejoin ')) {
        const userIdToRejoin = input.substring(7).trim();
        if (userIdToRejoin) {
            console.log(`🔄 Attempting to rejoin as: ${userIdToRejoin}`);
            socket.emit('rejoin', { userId: userIdToRejoin });
        } else {
            console.log('❌ Please provide a user ID to rejoin with. Usage: rejoin <userId>');
        }
        return;
    }

    sendMessage(input);
});

// Handle client shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Client shutting down...');
    if (socket) {
        socket.disconnect();
    }
    process.exit(0);
});

// Start connection
connectToServer();

console.log('Commands:');
console.log('- Type any message and press Enter to send');
console.log('- Type "status" to check connection status');
console.log('- Type "reconnect" to manually reconnect');
console.log('- Type "rejoin <userId>" to rejoin with a previous identity');
console.log('- Type "quit" or "exit" to close the client');
console.log('- Press Ctrl+C to force quit\n');