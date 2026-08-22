import Emergency from '../models/Emergency.js';
import { triggerEmergencyEvent, claimEmergencyEvent, cancelEmergencyEvent } from '../services/socketService.js';

export const createEmergency = async (req, res, next) => {
  try {
    const { location, message, emergencyId: bodyEmergencyId, userName, userPhone, userId: bodyUserId } = req.body;
    const user = req.user;
    const userId = user?.id || user?._id || bodyUserId || 'ANONYMOUS';
    const emergencyId = bodyEmergencyId || `emg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Cancel any previous pending emergencies from this user so only 1 remains active
    if (userId !== 'ANONYMOUS') {
      await Emergency.updateMany(
        { userId, status: 'PENDING', emergencyId: { $ne: emergencyId } },
        { status: 'CANCELLED' }
      );
    }

    const emergencyData = {
      emergencyId,
      userId,
      userName: userName || user?.name || user?.phone || 'Beach Visitor',
      userPhone: userPhone || user?.phone || '',
      location: location || 'Muzhappilangad Drive-In Beach',
      message: message || 'Emergency Alert! User requests immediate assistance.',
      status: 'PENDING',
      timestamp: new Date(),
    };

    // Upsert in MongoDB by emergencyId so duplicate calls don't create multiple records
    const createdDoc = await Emergency.findOneAndUpdate(
      { emergencyId },
      emergencyData,
      { upsert: true, new: true }
    );

    // Broadcast to socket only if not already active
    triggerEmergencyEvent(emergencyData);

    res.status(201).json({
      success: true,
      message: 'Emergency alert sent. Waiting for an admin.',
      data: createdDoc,
    });
  } catch (err) {
    next(err);
  }
};

export const getActiveEmergencies = async (req, res, next) => {
  try {
    // Return all pending emergencies created in the last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const activeList = await Emergency.find({
      status: 'PENDING',
      createdAt: { $gte: twoHoursAgo },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Deduplicate so only the most recent pending emergency per user is shown
    const seenUsers = new Set();
    const deduplicated = [];
    for (const emg of activeList) {
      const key = emg.userId && emg.userId !== 'ANONYMOUS' ? `user_${emg.userId}` : `emg_${emg.emergencyId}`;
      if (!seenUsers.has(key)) {
        seenUsers.add(key);
        deduplicated.push(emg);
      }
    }

    res.json({
      success: true,
      data: { emergencies: deduplicated },
    });
  } catch (err) {
    next(err);
  }
};

export const claimEmergency = async (req, res, next) => {
  try {
    const { emergencyId } = req.params;
    const admin = req.user;

    const adminInfo = {
      id: admin?.id || admin?._id,
      name: admin?.name || 'Gate Officer',
    };

    // Update MongoDB
    await Emergency.findOneAndUpdate(
      { emergencyId },
      {
        status: 'CLAIMED',
        claimedBy: adminInfo,
      }
    );

    // Trigger socket broadcast
    claimEmergencyEvent(emergencyId, adminInfo);

    res.json({
      success: true,
      message: 'Emergency claimed successfully.',
      data: { emergencyId },
    });
  } catch (err) {
    next(err);
  }
};

export const cancelEmergency = async (req, res, next) => {
  try {
    const { emergencyId } = req.params;

    // Update MongoDB status to CANCELLED
    await Emergency.findOneAndUpdate(
      { emergencyId },
      { status: 'CANCELLED' }
    );

    // Trigger socket broadcast to stop alarm for all admins
    cancelEmergencyEvent(emergencyId);

    res.json({
      success: true,
      message: 'Emergency cancelled successfully by user.',
      data: { emergencyId },
    });
  } catch (err) {
    next(err);
  }
};
