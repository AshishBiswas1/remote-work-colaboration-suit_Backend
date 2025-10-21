const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Store active rooms and users
const activeRooms = new Map();
const userSessions = new Map();
const typingUsers = new Map(); // roomId -> Set of user IDs who are typing

class ChatController {
  /**
   * Initialize Socket.IO chat handlers
   */
  static initializeSocketIO(io) {
    io.on('connection', (socket) => {

      // Handle connection errors
      socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error);
      });

      // Handle user joining a room
      socket.on('join-room', async ({ roomId, user }) => {
        try {
          
          // Leave any previous rooms
          const previousSession = userSessions.get(socket.id);
          if (previousSession) {
            await ChatController.handleUserLeave(socket, previousSession.roomId, io);
          }
          
          // Join the new room
          socket.join(roomId);
          
          // Store user info
          userSessions.set(socket.id, { roomId, user });
          
          // Update room data
          if (!activeRooms.has(roomId)) {
            activeRooms.set(roomId, {
              users: new Map(),
              messages: []
            });
          }
          
          const roomData = activeRooms.get(roomId);
          roomData.users.set(socket.id, {
            id: user.id,
            name: user.name,
            email: user.email,
            socketId: socket.id,
            joinedAt: new Date().toISOString()
          });
          
          // Load message history from database
          const messageHistory = await ChatController.getMessageHistory(roomId);
          
          // Send current room state to the joining user
          socket.emit('room-state', {
            messages: messageHistory,
            onlineUsers: Array.from(roomData.users.values())
          });
          
          // Notify room about new user
          socket.to(roomId).emit('user-joined', {
            user: roomData.users.get(socket.id),
            onlineUsers: Array.from(roomData.users.values())
          });
          
        } catch (error) {
          console.error('❌ Error joining room:', error);
          socket.emit('error', { message: 'Failed to join room', error: error.message });
        }
      });

      // Handle sending messages
      socket.on('send-message', async ({ roomId, message, user }) => {
        try {
          
          const messageData = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            text: message,
            user: {
              id: user.id,
              name: user.name,
              email: user.email
            },
            timestamp: new Date().toISOString(),
            roomId: roomId
          };
          
          // Store message in database
          await ChatController.saveMessage(messageData);
          
          // Store message in room (keep last 100 messages in memory)
          if (activeRooms.has(roomId)) {
            const roomData = activeRooms.get(roomId);
            roomData.messages.push(messageData);
            
            if (roomData.messages.length > 100) {
              roomData.messages = roomData.messages.slice(-100);
            }
          }
          
          // Broadcast message to all users in the room (including sender)
          io.to(roomId).emit('new-message', messageData);
          
          // Clear typing indicator for this user
          ChatController.clearTypingIndicator(socket, roomId, user, io);
          
        } catch (error) {
          console.error('❌ Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message', error: error.message });
        }
      });

      // Handle typing indicator
      socket.on('typing-start', ({ roomId, user }) => {
        try {
          if (!typingUsers.has(roomId)) {
            typingUsers.set(roomId, new Set());
          }
          typingUsers.get(roomId).add(user.id);
          
          // Broadcast to others in the room
          socket.to(roomId).emit('user-typing', {
            userId: user.id,
            userName: user.name,
            isTyping: true
          });
        } catch (error) {
          console.error('❌ Error handling typing start:', error);
        }
      });

      socket.on('typing-stop', ({ roomId, user }) => {
        ChatController.clearTypingIndicator(socket, roomId, user, io);
      });

      // Handle message read receipts
      socket.on('message-read', async ({ roomId, messageId, userId }) => {
        try {
          // Update read status in database
          await ChatController.markMessageAsRead(messageId, userId);
          
          // Broadcast read receipt to room
          socket.to(roomId).emit('message-read-receipt', {
            messageId,
            userId,
            readAt: new Date().toISOString()
          });
        } catch (error) {
          console.error('❌ Error marking message as read:', error);
        }
      });

      // Handle user leaving room
      socket.on('leave-room', async ({ roomId }) => {
        await ChatController.handleUserLeave(socket, roomId, io);
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        
        const sessionData = userSessions.get(socket.id);
        if (sessionData) {
          await ChatController.handleUserLeave(socket, sessionData.roomId, io);
        }
      });

      // Heartbeat/ping handling
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });

    // Make data available globally
    global.activeRooms = activeRooms;
    global.userSessions = userSessions;

    return { activeRooms, userSessions };
  }

  /**
   * Handle user leaving a room
   */
  static async handleUserLeave(socket, roomId, io) {
    if (!roomId || !activeRooms.has(roomId)) return;
    
    try {
      const roomData = activeRooms.get(roomId);
      const user = roomData.users.get(socket.id);
      
      if (user) {
        roomData.users.delete(socket.id);
        userSessions.delete(socket.id);
        
        // Clear typing indicator
        if (typingUsers.has(roomId)) {
          typingUsers.get(roomId).delete(user.id);
        }
        
        // Notify other users
        socket.to(roomId).emit('user-left', {
          user,
          onlineUsers: Array.from(roomData.users.values())
        });
        
        // Clean up empty rooms
        if (roomData.users.size === 0) {
          activeRooms.delete(roomId);
          typingUsers.delete(roomId);
        }
        
      }
      
      socket.leave(roomId);
    } catch (error) {
      console.error('❌ Error handling user leave:', error);
    }
  }

  /**
   * Clear typing indicator for a user
   */
  static clearTypingIndicator(socket, roomId, user, io) {
    try {
      if (typingUsers.has(roomId)) {
        typingUsers.get(roomId).delete(user.id);
      }
      
      socket.to(roomId).emit('user-typing', {
        userId: user.id,
        userName: user.name,
        isTyping: false
      });
    } catch (error) {
      console.error('❌ Error clearing typing indicator:', error);
    }
  }

  /**
   * Save message to database
   */
  static async saveMessage(messageData) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([{
          id: messageData.id,
          room_id: messageData.roomId,
          user_id: messageData.user.id,
          user_name: messageData.user.name,
          user_email: messageData.user.email,
          message_text: messageData.text,
          created_at: messageData.timestamp
        }]);

      if (error) {
        console.error('❌ Error saving message to database:', error);
        // Don't throw error - message still works in memory
      } else {
      }
    } catch (error) {
      console.error('❌ Database error:', error);
    }
  }

  /**
   * Get message history from database
   */
  static async getMessageHistory(roomId, limit = 100) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching message history:', error);
        return [];
      }

      // Convert database format to message format
      const messages = data.reverse().map(msg => ({
        id: msg.id,
        text: msg.message_text,
        user: {
          id: msg.user_id,
          name: msg.user_name,
          email: msg.user_email
        },
        timestamp: msg.created_at,
        roomId: msg.room_id
      }));

      return messages;
    } catch (error) {
      console.error('❌ Database error:', error);
      return [];
    }
  }

  /**
   * Mark message as read
   */
  static async markMessageAsRead(messageId, userId) {
    try {
      // Check if read receipt already exists
      const { data: existing } = await supabase
        .from('message_read_receipts')
        .select('*')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .single();

      if (!existing) {
        const { error } = await supabase
          .from('message_read_receipts')
          .insert([{
            message_id: messageId,
            user_id: userId,
            read_at: new Date().toISOString()
          }]);

        if (error) {
          console.error('❌ Error saving read receipt:', error);
        }
      }
    } catch (error) {
      console.error('❌ Database error:', error);
    }
  }

  /**
   * Get active rooms statistics
   */
  static getRoomStats() {
    const stats = [];
    activeRooms.forEach((roomData, roomId) => {
      stats.push({
        roomId,
        userCount: roomData.users.size,
        users: Array.from(roomData.users.values()),
        messageCount: roomData.messages.length,
        typingUsers: typingUsers.has(roomId) ? Array.from(typingUsers.get(roomId)) : []
      });
    });
    return stats;
  }
}

module.exports = ChatController;
