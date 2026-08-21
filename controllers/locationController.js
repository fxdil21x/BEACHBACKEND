import FeatureSettings from '../models/FeatureSettings.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/index.js';
import { getIO } from '../services/socketService.js';

export const updateLocation = asyncHandler(async (req, res) => {
  const settings = await FeatureSettings.getSettings();
  if (!settings.trackUserEnabled) {
    return sendError(res, 'User tracking is currently disabled by Master Admin', 403);
  }

  const { latitude, longitude, speed, heading, accuracy } = req.body;
  if (latitude == null || longitude == null) {
    return sendError(res, 'Latitude and longitude are required', 400);
  }

  const userId = req.user?.id || req.user?._id;
  const userPayload = {
    userId: String(userId),
    userName: req.user?.name || req.user?.fullName || 'Registered User',
    username: req.user?.username || '',
    userPhone: req.user?.phone || '',
    latitude: Number(latitude),
    longitude: Number(longitude),
    speed: speed != null ? Number(speed) : null,
    heading: heading != null ? Number(heading) : null,
    accuracy: accuracy != null ? Number(accuracy) : null,
    timestamp: new Date().toISOString(),
    status: 'LIVE',
  };

  try {
    const io = getIO();
    io.to('admins').emit('location:user-update', userPayload);
  } catch {
    // Ignore socket unavailable error
  }

  return sendSuccess(res, { tracking: userPayload });
});
