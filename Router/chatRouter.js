const express = require('express');
const router = express.Router();
const ChatController = require('../controller/chatController');

// Health check endpoint for Socket.IO chat
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Socket.IO Chat',
    activeRooms: global.activeRooms?.size || 0,
    connectedUsers: global.userSessions?.size || 0,
    timestamp: new Date().toISOString(),
    endpoint: `http://localhost:${process.env.PORT || 8000}`
  });
});

// Get room info endpoint
router.get('/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const roomData = global.activeRooms?.get(roomId);
  
  if (roomData) {
    res.json({
      status: 'success',
      data: {
        roomId,
        userCount: roomData.users.size,
        messageCount: roomData.messages.length,
        users: Array.from(roomData.users.values()),
        recentMessages: roomData.messages.slice(-10) // Last 10 messages
      }
    });
  } else {
    res.json({
      status: 'success',
      data: {
        roomId,
        userCount: 0,
        messageCount: 0,
        users: [],
        recentMessages: []
      }
    });
  }
});

// Get all active rooms
router.get('/rooms', (req, res) => {
  const rooms = [];
  
  if (global.activeRooms) {
    global.activeRooms.forEach((roomData, roomId) => {
      rooms.push({
        roomId,
        userCount: roomData.users.size,
        messageCount: roomData.messages.length,
        lastActivity: roomData.messages.length > 0 
          ? roomData.messages[roomData.messages.length - 1].timestamp 
          : null
      });
    });
  }
  
  res.json({
    status: 'success',
    data: {
      totalRooms: rooms.length,
      rooms: rooms
    }
  });
});

// Get chat statistics with detailed room info
router.get('/stats', (req, res) => {
  const roomStats = ChatController.getRoomStats();
  
  res.json({
    status: 'success',
    data: {
      totalRooms: roomStats.length,
      totalUsers: roomStats.reduce((sum, room) => sum + room.userCount, 0),
      totalMessages: roomStats.reduce((sum, room) => sum + room.messageCount, 0),
      rooms: roomStats,
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;