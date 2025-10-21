/**
 * Whiteboard Controller
 * Handles real-time collaboration for whiteboards using Socket.IO
 */

// Store whiteboard data per room
const whiteboards = new Map(); // roomId -> canvas JSON state
const roomUsers = new Map();   // roomId -> Set of {userId, userName, socketId}

/**
 * Initialize Whiteboard Socket.IO handlers
 */
function initializeSocketIO(io) {

  io.on('connection', (socket) => {
    let currentRoom = null;
    let currentUserId = null;
    let currentUserName = null;

    // Handle joining a whiteboard room
    socket.on('join-whiteboard', ({ roomId, userId, userName }) => {
      
      currentRoom = roomId;
      currentUserId = userId;
      currentUserName = userName;

      // Join Socket.IO room
      socket.join(roomId);

      // Initialize room if it doesn't exist
      if (!whiteboards.has(roomId)) {
        whiteboards.set(roomId, { objects: [] });
      }
      
      // Initialize or get user list for room
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Set());
      }

      // Add user to room
      const users = roomUsers.get(roomId);
      users.add({ userId, userName, socketId: socket.id });

      // Notify others that user joined
      socket.to(roomId).emit('user-joined-whiteboard', { userId, userName });

      // Send current whiteboard state to the joining user
      socket.emit('whiteboard-state', whiteboards.get(roomId));

      // Send list of online users
      const onlineUsers = Array.from(users).map(u => ({ userId: u.userId, userName: u.userName }));
      io.to(roomId).emit('whiteboard-online-users', onlineUsers);

    });

    // Handle canvas object added
    socket.on('canvas-object-added', ({ canvasJSON }) => {
      if (!currentRoom) return;


      // Update server-side state
      whiteboards.set(currentRoom, canvasJSON);

      // Broadcast to all other users in the room (not the sender)
      socket.to(currentRoom).emit('canvas-object-added', { canvasJSON, userId: currentUserId });
    });

    // Handle canvas object modified
    socket.on('canvas-object-modified', ({ canvasJSON }) => {
      if (!currentRoom) return;


      // Update server-side state
      whiteboards.set(currentRoom, canvasJSON);

      // Broadcast to all other users in the room
      socket.to(currentRoom).emit('canvas-object-modified', { canvasJSON, userId: currentUserId });
    });

    // Handle canvas object removed
    socket.on('canvas-object-removed', ({ canvasJSON }) => {
      if (!currentRoom) return;


      // Update server-side state
      whiteboards.set(currentRoom, canvasJSON);

      // Broadcast to all other users in the room
      socket.to(currentRoom).emit('canvas-object-removed', { canvasJSON, userId: currentUserId });
    });

    // Handle path created (freehand drawing)
    socket.on('canvas-path-created', ({ canvasJSON }) => {
      if (!currentRoom) return;


      // Update server-side state
      whiteboards.set(currentRoom, canvasJSON);

      // Broadcast to all other users in the room
      socket.to(currentRoom).emit('canvas-path-created', { canvasJSON, userId: currentUserId });
    });

    // Handle canvas cleared
    socket.on('canvas-cleared', () => {
      if (!currentRoom) return;


      // Clear server-side state
      whiteboards.set(currentRoom, { objects: [] });

      // Broadcast to all users in the room
      io.to(currentRoom).emit('canvas-cleared', { userId: currentUserId });
    });

    // Handle full canvas sync (for large updates)
    socket.on('canvas-sync', ({ canvasJSON }) => {
      if (!currentRoom) return;


      // Update server-side state
      whiteboards.set(currentRoom, canvasJSON);

      // Broadcast to all other users in the room
      socket.to(currentRoom).emit('canvas-sync', { canvasJSON, userId: currentUserId });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      if (currentRoom && currentUserId) {

        const users = roomUsers.get(currentRoom);
        if (users) {
          // Remove user from room
          for (const user of users) {
            if (user.socketId === socket.id) {
              users.delete(user);
              break;
            }
          }

          // Notify others that user left
          socket.to(currentRoom).emit('user-left-whiteboard', { userId: currentUserId, userName: currentUserName });

          // Send updated online users list
          const onlineUsers = Array.from(users).map(u => ({ userId: u.userId, userName: u.userName }));
          io.to(currentRoom).emit('whiteboard-online-users', onlineUsers);

          // Don't clean up whiteboard data - persist it for when users rejoin
          if (users.size === 0) {
            roomUsers.delete(currentRoom);
          } else {
          }
        }
      }
    });
  });

}

/**
 * Get statistics about active whiteboards
 */
function getStats() {
  const stats = {
    totalRooms: whiteboards.size,
    totalActiveRooms: roomUsers.size,
    totalUsers: 0,
    rooms: []
  };

  roomUsers.forEach((users, roomId) => {
    stats.totalUsers += users.size;
    const whiteboard = whiteboards.get(roomId);
    stats.rooms.push({
      roomId,
      userCount: users.size,
      objectCount: whiteboard ? whiteboard.objects.length : 0
    });
  });

  return stats;
}

module.exports = {
  initializeSocketIO,
  getStats,
  whiteboards,
  roomUsers
};
