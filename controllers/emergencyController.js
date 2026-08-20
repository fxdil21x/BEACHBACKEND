import { triggerEmergencyEvent, claimEmergencyEvent } from '../services/socketService.js';

export const createEmergency = async (req, res, next) => {
  try {
    const { location, message } = req.body;
    const user = req.user;

    const emergencyData = {
      userId: user?.id || user?._id || 'ANONYMOUS',
      userName: user?.name || user?.phone || 'Beach Visitor',
      userPhone: user?.phone || '',
      location: location || 'Muzhappilangad Drive-In Beach',
      message: message || 'Emergency Alert! User requests immediate assistance.',
    };

    const created = triggerEmergencyEvent(emergencyData);

    res.status(201).json({
      success: true,
      message: 'Emergency alert sent. Waiting for an admin.',
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

export const claimEmergency = async (req, res, next) => {
  try {
    const { emergencyId } = req.params;
    const admin = req.user;

    claimEmergencyEvent(emergencyId, {
      id: admin?.id || admin?._id,
      name: admin?.name || 'Gate Officer',
    });

    res.json({
      success: true,
      message: 'Emergency claimed successfully.',
      data: { emergencyId },
    });
  } catch (err) {
    next(err);
  }
};
