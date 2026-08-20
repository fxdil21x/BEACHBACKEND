import { Server } from 'socket.io';

let io = null;
const activeEmergencies = new Map();

export function initSocket(server, allowedOrigins) {
  io = new Server(server, {
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
    });

    socket.on('join:user', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });

    // Trigger emergency from socket
    socket.on('emergency:trigger', (data) => {
      const emergencyId = data.emergencyId || `emg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const emergencyData = {
        emergencyId,
        userId: data.userId || 'ANONYMOUS',
        userName: data.userName || 'Visitor / Resident',
        userPhone: data.userPhone || '',
        location: data.location || 'Muzhappilangad Beach Area',
        timestamp: new Date().toISOString(),
        status: 'PENDING',
        message: data.message || 'Emergency assistance requested!',
      };

      activeEmergencies.set(emergencyId, emergencyData);
      console.log(`[Socket] Emergency triggered: ${emergencyId}`);

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

      // Notify user if needed
      if (emergency?.userId) {
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
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

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
