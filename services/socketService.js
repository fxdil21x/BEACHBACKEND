import { Server } from 'socket.io';
import FeatureSettings from '../models/FeatureSettings.js';

let io = null;
const activeEmergencies = new Map();
const activeTrackedUsers = new Map(); // key: userId

export function initSocket(server, allowedOrigins) {
  activeTrackedUsers.clear();
  activeEmergencies.clear();

  io = new Server(server, {
    path: '/api/socket.io',
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        return callback(null, true); // Allow during dev
      },
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // Join room based on role
    socket.on('join:admin', () => {
      socket.join('admins');
      console.log(`[Socket] ${socket.id} joined 'admins' room`);

      // Send list of active pending emergencies to newly connected admin
      const pending = Array.from(activeEmergencies.values()).filter((e) => e.status === 'PENDING');
      socket.emit('emergency:active-list', pending);
      // Also send list of active tracked users
      socket.emit('location:initial-users', Array.from(activeTrackedUsers.values()));
    });

    socket.on('join:track-users', () => {
      socket.join('admins');
      socket.emit('location:initial-users', Array.from(activeTrackedUsers.values()));
    });

    socket.on('join:user', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });

    // Handle user live location update
    socket.on('user:location-update', async (data) => {
      try {
        const settings = await FeatureSettings.getSettings();
        if (!settings.trackUserEnabled) {
          socket.emit('tracking:disabled', { message: 'User tracking is disabled by Master Admin' });
          if (data?.userId) activeTrackedUsers.delete(data.userId);
          return;
        }

        const userId = data.userId || socket.id;
        const userPayload = {
          userId,
          socketId: socket.id,
          userName: data.userName || data.name || 'Registered User',
          username: data.username || '',
          userPhone: data.userPhone || data.phone || '',
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          speed: data.speed != null ? Number(data.speed) : null,
          heading: data.heading != null ? Number(data.heading) : null,
          accuracy: data.accuracy != null ? Number(data.accuracy) : null,
          timestamp: new Date().toISOString(),
          status: 'LIVE',
        };

        activeTrackedUsers.set(userId, userPayload);
        io.to('admins').emit('location:user-update', userPayload);
      } catch (err) {
        console.error('[Socket] Location update error:', err);
      }
    });

    // User stops tracking manually
    socket.on('user:stop-tracking', (data) => {
      const userId = data?.userId || socket.id;
      if (activeTrackedUsers.has(userId)) {
        activeTrackedUsers.delete(userId);
        io.to('admins').emit('location:user-stopped', { userId, socketId: socket.id });
      }
    });

    // Join emergency room
    socket.on('join:emergency', (emergencyId) => {
      if (emergencyId) {
        socket.join(`emergency:${emergencyId}`);
      }
    });

    // Trigger emergency from socket
    socket.on('emergency:trigger', (data) => {
      const emergencyId = data.emergencyId || `emg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      socket.join(`emergency:${emergencyId}`);

      const emergencyData = {
        emergencyId,
        socketId: socket.id,
        userId: data.userId || 'ANONYMOUS',
        userName: data.userName || 'Visitor / Resident',
        userPhone: data.userPhone || '',
        location: data.location || 'Muzhappilangad Beach Area',
        timestamp: new Date().toISOString(),
        status: 'PENDING',
        message: data.message || 'Emergency assistance requested!',
      };

      activeEmergencies.set(emergencyId, emergencyData);
      console.log(`[Socket] Emergency triggered: ${emergencyId} (socket: ${socket.id})`);

      // Broadcast emergency:new to ALL active admins
      io.to('admins').emit('emergency:new', emergencyData);

      // Acknowledge back to user socket
      socket.emit('emergency:ack', { success: true, emergency: emergencyData });
    });

    // Admin claims/accepts emergency
    socket.on('emergency:claim', (data) => {
      const { emergencyId, adminId, adminName } = data;
      console.log(`[Socket] Emergency claim attempt for ${emergencyId} by admin ${adminName || adminId}`);

      const emergency = activeEmergencies.get(emergencyId);
      if (emergency) {
        emergency.status = 'CLAIMED';
        emergency.claimedBy = { id: adminId, name: adminName };
        activeEmergencies.set(emergencyId, emergency);
      }

      // Broadcast emergency:claimed to ALL active admins so their audio & vibration stop immediately
      io.to('admins').emit('emergency:claimed', {
        emergencyId,
        claimedByAdminId: adminId,
        claimedByAdminName: adminName || 'Admin',
        timestamp: new Date().toISOString(),
      });

      // Notify user on all channels
      if (emergencyId) {
        io.to(`emergency:${emergencyId}`).emit('emergency:status-update', {
          emergencyId,
          status: 'CLAIMED',
          claimedBy: adminName,
        });
      }
      if (emergency?.userId && emergency.userId !== 'ANONYMOUS') {
        io.to(`user:${emergency.userId}`).emit('emergency:status-update', {
          emergencyId,
          status: 'CLAIMED',
          claimedBy: adminName,
        });
      }
    });

    // Cancel / Resolve emergency
    socket.on('emergency:cancel', (data) => {
      const { emergencyId } = data;
      if (emergencyId) {
        activeEmergencies.delete(emergencyId);
        io.to('admins').emit('emergency:claimed', {
          emergencyId,
          resolved: true,
          timestamp: new Date().toISOString(),
        });
        io.to(`emergency:${emergencyId}`).emit('emergency:cancelled', { emergencyId });
      }
    });

    // ─── WebRTC Signaling Relay ───────────────────────────────────────────────

    // Admin → User: send SDP offer to start call
    // payload: { emergencyId, userId, sdp, adminId, adminName }
    socket.on('call:offer', (data) => {
      const { userId, emergencyId, sdp, adminId, adminName } = data;
      console.log(`[Socket] call:offer from admin ${adminId} → emergency: ${emergencyId} (user: ${userId})`);
      const payload = {
        emergencyId,
        adminId,
        adminName: adminName || 'Gate Admin',
        sdp,
        adminSocketId: socket.id,
      };

      // Broadcast offer to the emergency room, user room, and the creator's direct socket
      if (emergencyId) {
        socket.to(`emergency:${emergencyId}`).emit('call:incoming', payload);
      }
      if (userId && userId !== 'ANONYMOUS') {
        socket.to(`user:${userId}`).emit('call:incoming', payload);
      }
      const emg = activeEmergencies.get(emergencyId);
      if (emg?.socketId && emg.socketId !== socket.id) {
        io.to(emg.socketId).emit('call:incoming', payload);
      }
    });

    // User → Admin: send SDP answer back
    // payload: { emergencyId, sdp, adminSocketId }
    socket.on('call:answer', (data) => {
      const { adminSocketId, emergencyId, sdp } = data;
      console.log(`[Socket] call:answer from user socket ${socket.id} → admin socket ${adminSocketId}`);
      if (adminSocketId) {
        io.to(adminSocketId).emit('call:answered', {
          emergencyId,
          sdp,
          userSocketId: socket.id,
        });
      }
    });

    // ICE candidate exchange — relay to specific target socket or emergency room
    // payload: { targetSocketId, emergencyId, candidate }
    socket.on('call:ice-candidate', (data) => {
      const { targetSocketId, emergencyId, candidate } = data;
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:ice-candidate', { candidate, fromSocketId: socket.id });
      } else if (emergencyId) {
        socket.to(`emergency:${emergencyId}`).emit('call:ice-candidate', { candidate, fromSocketId: socket.id });
      }
    });

    // Either party ends the call
    // payload: { targetSocketId, emergencyId }
    socket.on('call:end', (data) => {
      const { targetSocketId, emergencyId } = data;
      console.log(`[Socket] call:end for emergency ${emergencyId}`);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:ended', { emergencyId });
      }
      if (emergencyId) {
        socket.to(`emergency:${emergencyId}`).emit('call:ended', { emergencyId });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      // Find if this socket belonged to a tracked user
      for (const [userId, user] of activeTrackedUsers.entries()) {
        if (user.socketId === socket.id) {
          activeTrackedUsers.delete(userId);
          io.to('admins').emit('location:user-stopped', { userId, socketId: socket.id });
          break;
        }
      }
    });
  });

  // Background interval to clean up stale user location streams (older than 30 seconds)
  setInterval(() => {
    const now = Date.now();
    for (const [userId, user] of activeTrackedUsers.entries()) {
      const userTime = new Date(user.timestamp).getTime();
      if (isNaN(userTime) || now - userTime > 30000) {
        activeTrackedUsers.delete(userId);
        if (io) {
          io.to('admins').emit('location:user-stopped', { userId });
        }
      }
    }
  }, 10000);

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

export function triggerEmergencyEvent(emergencyData) {
  if (!io) return;
  const emergencyId = emergencyData.emergencyId || `emg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const payload = {
    ...emergencyData,
    emergencyId,
    status: 'PENDING',
    timestamp: new Date().toISOString(),
  };
  activeEmergencies.set(emergencyId, payload);
  io.to('admins').emit('emergency:new', payload);
  return payload;
}

export function claimEmergencyEvent(emergencyId, adminInfo) {
  if (!io) return;
  const emergency = activeEmergencies.get(emergencyId);
  if (emergency) {
    emergency.status = 'CLAIMED';
    emergency.claimedBy = adminInfo;
  }
  io.to('admins').emit('emergency:claimed', {
    emergencyId,
    claimedByAdminId: adminInfo?.id,
    claimedByAdminName: adminInfo?.name || 'Admin',
    timestamp: new Date().toISOString(),
  });
}

export function cancelEmergencyEvent(emergencyId) {
  if (!io) return;
  activeEmergencies.delete(emergencyId);
  io.to('admins').emit('emergency:claimed', {
    emergencyId,
    resolved: true,
    cancelled: true,
    timestamp: new Date().toISOString(),
  });
}

export function saveActiveTrackedUser(userPayload) {
  if (userPayload && userPayload.userId) {
    activeTrackedUsers.set(String(userPayload.userId), userPayload);
    if (io) {
      io.to('admins').emit('location:user-update', userPayload);
    }
  }
}

export function removeActiveTrackedUser(userId) {
  if (!userId) return;
  const idStr = String(userId);
  if (activeTrackedUsers.has(idStr)) {
    activeTrackedUsers.delete(idStr);
    if (io) {
      io.to('admins').emit('location:user-stopped', { userId: idStr });
    }
  }
}

export function getActiveTrackedUsers() {
  const now = Date.now();
  const validUsers = [];
  for (const [userId, user] of activeTrackedUsers.entries()) {
    const userTime = new Date(user.timestamp).getTime();
    if (!isNaN(userTime) && now - userTime <= 30000) {
      validUsers.push(user);
    } else {
      activeTrackedUsers.delete(userId);
      if (io) {
        io.to('admins').emit('location:user-stopped', { userId });
      }
    }
  }
  return validUsers;
}
