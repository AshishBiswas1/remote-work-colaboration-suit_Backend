/**
 * TaskBoard Controller
 * Handles real-time collaboration for task boards using Socket.IO
 */

// Store task boards per room
const taskBoards = new Map(); // roomId -> board state
const roomUsers = new Map();  // roomId -> Set of {userId, userName, socketId}

/**
 * Initialize TaskBoard Socket.IO handlers
 */
function initializeSocketIO(io) {
  console.log('🔧 Initializing TaskBoard Socket.IO handlers...');

  io.on('connection', (socket) => {
    let currentRoom = null;
    let currentUserId = null;
    let currentUserName = null;

    // Handle joining a taskboard room
    socket.on('join-taskboard', ({ roomId, userId, userName, currentBoard }) => {
      console.log(`📋 User ${userName} (${userId}) joining taskboard room: ${roomId}`);
      
      currentRoom = roomId;
      currentUserId = userId;
      currentUserName = userName;

      // Join Socket.IO room
      socket.join(roomId);

      // Initialize room if it doesn't exist
      if (!taskBoards.has(roomId)) {
        taskBoards.set(roomId, currentBoard || getDefaultBoard());
        roomUsers.set(roomId, new Set());
      }

      // Add user to room
      const users = roomUsers.get(roomId);
      users.add({ userId, userName, socketId: socket.id });

      // Notify others that user joined
      socket.to(roomId).emit('user-joined', { userId, userName });

      // Send current board state to the joining user
      socket.emit('board-updated', taskBoards.get(roomId));

      // Send list of online users
      const onlineUsers = Array.from(users).map(u => ({ userId: u.userId, userName: u.userName }));
      io.to(roomId).emit('online-users', onlineUsers);

      console.log(`✅ User ${userName} joined taskboard ${roomId}. Total users: ${users.size}`);
    });

    // Handle adding a task
    socket.on('add-task', ({ columnId, task }) => {
      if (!currentRoom) return;

      console.log(`➕ Adding task to column ${columnId} in room ${currentRoom}`);

      const board = taskBoards.get(currentRoom);
      if (board) {
        const column = board.find(col => col.id === columnId);
        if (column) {
          column.items.unshift(task); // Add to beginning
          
          // Broadcast to all users in the room
          io.to(currentRoom).emit('task-added', { columnId, task });
          
          console.log(`✅ Task added: ${task.text} by ${task.createdBy}`);
        }
      }
    });

    // Handle moving a task
    socket.on('move-task', ({ taskId, fromColumnId, toColumnId, newIndex }) => {
      if (!currentRoom) return;

      console.log(`🔄 Moving task ${taskId} from ${fromColumnId} to ${toColumnId} in room ${currentRoom}`);

      const board = taskBoards.get(currentRoom);
      if (board) {
        const fromColumn = board.find(col => col.id === fromColumnId);
        const toColumn = board.find(col => col.id === toColumnId);

        if (fromColumn && toColumn) {
          const taskIndex = fromColumn.items.findIndex(item => item.id === taskId);
          if (taskIndex !== -1) {
            const [task] = fromColumn.items.splice(taskIndex, 1);
            toColumn.items.splice(newIndex, 0, task);

            // Broadcast to all users in the room
            io.to(currentRoom).emit('task-moved', { taskId, fromColumnId, toColumnId, newIndex });
            
            console.log(`✅ Task moved: ${task.text} to ${toColumnId}`);
          }
        }
      }
    });

    // Handle removing a task
    socket.on('remove-task', ({ columnId, taskId }) => {
      if (!currentRoom) {
        console.log(`❌ Cannot remove task: No room joined`);
        return;
      }

      console.log(`🗑️ Removing task ${taskId} from column ${columnId} in room ${currentRoom}`);

      const board = taskBoards.get(currentRoom);
      if (!board) {
        console.log(`❌ Board not found for room: ${currentRoom}`);
        return;
      }

      const column = board.find(col => col.id === columnId);
      if (!column) {
        console.log(`❌ Column ${columnId} not found in board`);
        return;
      }

      const taskIndex = column.items.findIndex(item => item.id === taskId);
      if (taskIndex === -1) {
        console.log(`❌ Task ${taskId} not found in column ${columnId}`);
        console.log(`📋 Current tasks in ${columnId}:`, column.items.map(t => t.id));
        return;
      }

      // Remove the task
      const [task] = column.items.splice(taskIndex, 1);
      
      // Broadcast to all users in the room
      io.to(currentRoom).emit('task-removed', { columnId, taskId });
      
      console.log(`✅ Task removed: "${task.text}" - Broadcasting to room ${currentRoom}`);
      console.log(`📊 Remaining tasks in ${columnId}: ${column.items.length}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      if (currentRoom && currentUserId) {
        console.log(`👋 User ${currentUserName} (${currentUserId}) disconnecting from taskboard ${currentRoom}`);

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
          socket.to(currentRoom).emit('user-left', { userId: currentUserId, userName: currentUserName });

          // Send updated online users list
          const onlineUsers = Array.from(users).map(u => ({ userId: u.userId, userName: u.userName }));
          io.to(currentRoom).emit('online-users', onlineUsers);

          // Clean up empty rooms
          if (users.size === 0) {
            taskBoards.delete(currentRoom);
            roomUsers.delete(currentRoom);
            console.log(`🧹 Cleaned up empty taskboard room: ${currentRoom}`);
          } else {
            console.log(`👥 Remaining users in ${currentRoom}: ${users.size}`);
          }
        }
      }
    });
  });

  console.log('✅ TaskBoard Socket.IO handlers initialized');
}

/**
 * Get default board structure
 */
function getDefaultBoard() {
  return [
    { id: "todo", name: "To do", items: [] },
    { id: "doing", name: "In progress", items: [] },
    { id: "done", name: "Done", items: [] },
  ];
}

/**
 * Get statistics about active taskboards
 */
function getStats() {
  const stats = {
    totalRooms: taskBoards.size,
    totalUsers: 0,
    rooms: []
  };

  roomUsers.forEach((users, roomId) => {
    stats.totalUsers += users.size;
    stats.rooms.push({
      roomId,
      userCount: users.size,
      taskCount: getTotalTaskCount(roomId)
    });
  });

  return stats;
}

/**
 * Get total task count for a room
 */
function getTotalTaskCount(roomId) {
  const board = taskBoards.get(roomId);
  if (!board) return 0;
  return board.reduce((sum, column) => sum + column.items.length, 0);
}

module.exports = {
  initializeSocketIO,
  getStats,
  taskBoards,
  roomUsers
};
