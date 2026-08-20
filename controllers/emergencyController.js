import Emergency from '../models/Emergency.js';
import { triggerEmergencyEvent, claimEmergencyEvent, cancelEmergencyEvent } from '../services/socketService.js';

export const createEmergency = async (req, res, next) => {
  try {
    const { location, message } = req.body;
    const user = req.user;

    const emergencyId = `emg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const emergencyData = {
      emergencyId,
      userId: user?.id || user?._id || 'ANONYMOUS',
      userName: user?.name || user?.phone || 'Beach Visitor',
      userPhone: user?.phone || '',
      location: location || 'Muzhappilangad Drive-In Beach',
      message: message || 'Emergency Alert! User requests immediate assistance.',
      status: 'PENDING',
      timestamp: new Date(),
    };

    // Save to MongoDB so serverless environments & REST polling work 100%
    const createdDoc = await Emergency.create(emergencyData);

    // Also trigger socket broadcast if socket server is running
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

    res.json({
      success: true,
      data: { emergencies: activeList },
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
