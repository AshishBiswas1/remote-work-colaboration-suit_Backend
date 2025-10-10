/**
 * Simple Socket.IO-based video call signaling
 *
 * Events:
 * - join-call { roomId, user }
 *   -> replies: existing-peers [{ peerId, user }]
 *   -> broadcasts to room: new-peer { peerId, user }
 * - offer { to, sdp, user }
 * - answer { to, sdp }
 * - ice-candidate { to, candidate }
 * - leave-call { roomId }
 *
 * This module forwards signaling messages between peers in a room.
 */

module.exports = {
  initialize: function (io) {
    const rooms = new Map(); // roomId -> Set of socket ids

    io.on('connection', (socket) => {
      console.log(`📶 Socket connected: ${socket.id}`);

      socket.on('join-call', ({ roomId, user }) => {
        try {
          if (!roomId) return;

          // Join socket.io room for convenience
          socket.join(roomId);

          // Track in rooms map
          if (!rooms.has(roomId)) rooms.set(roomId, new Set());
          const members = rooms.get(roomId);

          // Build list of existing peers
          const existingPeers = Array.from(members).map((peerId) => ({
            peerId,
            // we don't have user metadata for existing peers here unless tracked separately
            user: undefined,
          }));

          // Send existing peers to the joining socket
          socket.emit('existing-peers', existingPeers);

          // Inform existing members about the new peer so they can create offers
          socket.to(roomId).emit('new-peer', { peerId: socket.id, user });

          members.add(socket.id);
          console.log(`➡️ ${socket.id} joined room ${roomId} (members=${members.size})`);
        } catch (error) {
          console.error('Error in join-call:', error);
        }
      });

      socket.on('offer', ({ to, sdp, user }) => {
        if (!to) return;
        io.to(to).emit('offer', { from: socket.id, sdp, user });
      });

      socket.on('answer', ({ to, sdp }) => {
        if (!to) return;
        io.to(to).emit('answer', { from: socket.id, sdp });
      });

      socket.on('ice-candidate', ({ to, candidate }) => {
        if (!to) return;
        io.to(to).emit('ice-candidate', { from: socket.id, candidate });
      });

      socket.on('leave-call', ({ roomId }) => {
        if (!roomId) return;
        socket.leave(roomId);
        if (rooms.has(roomId)) {
          rooms.get(roomId).delete(socket.id);
          socket.to(roomId).emit('peer-left', { peerId: socket.id });
          if (rooms.get(roomId).size === 0) rooms.delete(roomId);
        }
      });

      socket.on('disconnect', () => {
        // Remove from any rooms
        for (const [roomId, members] of rooms.entries()) {
          if (members.has(socket.id)) {
            members.delete(socket.id);
            socket.to(roomId).emit('peer-left', { peerId: socket.id });
            if (members.size === 0) rooms.delete(roomId);
            console.log(`⬅️ ${socket.id} left room ${roomId}`);
          }
        }
      });
    });

    console.log('✅ Video call signaling initialized');
    return { rooms };
  }
};
