const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config({ path: './Config.env' });

// Import app and Supabase clients
const { app, supabase, supabaseAdmin } = require('./app');

// Environment variables
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server
const server = createServer(app);

// Initialize Socket.IO for real-time features
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Test Supabase connection
const testDatabaseConnection = async () => {
    try {
        const { data, error } = await supabase.from('_health').select('*').limit(1);
        if (error && error.code !== 'PGRST116') { // PGRST116 means table doesn't exist, which is fine
            console.log('⚠️  Supabase connection test had an issue:', error.message);
        } else {
            console.log('✅ Supabase database connection established successfully');
        }
    } catch (err) {
        console.log('✅ Supabase client initialized (connection will be tested on first use)');
    }
};

// Socket.IO connection handling for real-time features
io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // Handle user joining a workspace/room
    socket.on('join-workspace', (workspaceId) => {
        socket.join(workspaceId);
        console.log(`👥 User ${socket.id} joined workspace: ${workspaceId}`);
        socket.to(workspaceId).emit('user-joined', {
            userId: socket.id,
            message: 'A user joined the workspace'
        });
    });

    // Handle user leaving a workspace/room
    socket.on('leave-workspace', (workspaceId) => {
        socket.leave(workspaceId);
        console.log(`👋 User ${socket.id} left workspace: ${workspaceId}`);
        socket.to(workspaceId).emit('user-left', {
            userId: socket.id,
            message: 'A user left the workspace'
        });
    });

    // Handle real-time collaboration events
    socket.on('document-edit', (data) => {
        socket.to(data.workspaceId).emit('document-update', {
            userId: socket.id,
            ...data
        });
    });

    // Handle chat messages
    socket.on('chat-message', (data) => {
        socket.to(data.workspaceId).emit('new-message', {
            userId: socket.id,
            ...data,
            timestamp: new Date().toISOString()
        });
    });

    // Handle video call events
    socket.on('video-call-offer', (data) => {
        socket.to(data.targetUserId).emit('video-call-offer', {
            from: socket.id,
            ...data
        });
    });

    socket.on('video-call-answer', (data) => {
        socket.to(data.targetUserId).emit('video-call-answer', {
            from: socket.id,
            ...data
        });
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.targetUserId).emit('ice-candidate', {
            from: socket.id,
            ...data
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`🔌 User disconnected: ${socket.id}`);
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('💤 Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('💤 Process terminated');
        process.exit(0);
    });
});

// Start server and test database connection
server.listen(PORT, async () => {
    console.log('🚀 ======================================');
    console.log(`🌟 Remote Work Collaboration Suite Backend`);
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📡 API endpoint: http://localhost:${PORT}/api`);
    console.log('🚀 ======================================');
    
    // Test database connection
    await testDatabaseConnection();
});

// Export for testing
module.exports = { server, io };
