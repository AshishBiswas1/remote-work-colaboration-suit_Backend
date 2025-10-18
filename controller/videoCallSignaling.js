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
    const userMetadata = new Map(); // socketId -> user data

    io.on('connection', (socket) => {

      socket.on('join-call', ({ roomId, user }) => {
        try {
          if (!roomId) return;

          // Store user metadata for this socket
          if (user) {
            userMetadata.set(socket.id, user);
          }

          // Join socket.io room for convenience
          socket.join(roomId);

          // Track in rooms map
          if (!rooms.has(roomId)) rooms.set(roomId, new Set());
          const members = rooms.get(roomId);

          // Build list of existing peers with their user metadata
          const existingPeers = Array.from(members).map((peerId) => ({
            peerId,
            user: userMetadata.get(peerId) || undefined,
          }));

          // Send existing peers to the joining socket
          socket.emit('existing-peers', existingPeers);

          // Inform existing members about the new peer so they can create offers
          socket.to(roomId).emit('new-peer', { peerId: socket.id, user });

          members.add(socket.id);
        } catch (error) {
          // Error handling
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
        // Remove user metadata
        userMetadata.delete(socket.id);
        
        // Remove from any rooms
        for (const [roomId, members] of rooms.entries()) {
          if (members.has(socket.id)) {
            members.delete(socket.id);
            socket.to(roomId).emit('peer-left', { peerId: socket.id });
            if (members.size === 0) rooms.delete(roomId);
          }
        }
      });
    });

    return { rooms };
  }
};
