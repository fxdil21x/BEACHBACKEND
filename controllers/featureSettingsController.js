import FeatureSettings from '../models/FeatureSettings.js';
import { asyncHandler, sendSuccess } from '../utils/index.js';
import { getIO } from '../services/socketService.js';

export const getFeatureSettings = asyncHandler(async (_req, res) => {
  const settings = await FeatureSettings.getSettings();
  return sendSuccess(res, {
    settings: {
      emergencySosEnabled: settings.emergencySosEnabled,
      publicReportEnabled: settings.publicReportEnabled,
      userReportEnabled: settings.userReportEnabled,
      trackUserEnabled: Boolean(settings.trackUserEnabled),
      orderFoodEnabled: Boolean(settings.orderFoodEnabled ?? true),
      resortBookingEnabled: Boolean(settings.resortBookingEnabled ?? true),
    },
  });
});

export const updateFeatureSettings = asyncHandler(async (req, res) => {
  const {
    emergencySosEnabled,
    publicReportEnabled,
    userReportEnabled,
    trackUserEnabled,
    orderFoodEnabled,
    resortBookingEnabled,
  } = req.body;
  const settings = await FeatureSettings.getSettings();

  if (typeof emergencySosEnabled === 'boolean') {
    settings.emergencySosEnabled = emergencySosEnabled;
  }
  if (typeof publicReportEnabled === 'boolean') {
    settings.publicReportEnabled = publicReportEnabled;
  }
  if (typeof userReportEnabled === 'boolean') {
    settings.userReportEnabled = userReportEnabled;
  }
  if (typeof trackUserEnabled === 'boolean') {
    settings.trackUserEnabled = trackUserEnabled;
  }
  if (typeof orderFoodEnabled === 'boolean') {
    settings.orderFoodEnabled = orderFoodEnabled;
  }
  if (typeof resortBookingEnabled === 'boolean') {
    settings.resortBookingEnabled = resortBookingEnabled;
  }

  await settings.save();

  const settingsPayload = {
    emergencySosEnabled: settings.emergencySosEnabled,
    publicReportEnabled: settings.publicReportEnabled,
    userReportEnabled: settings.userReportEnabled,
    trackUserEnabled: Boolean(settings.trackUserEnabled),
    orderFoodEnabled: Boolean(settings.orderFoodEnabled),
    resortBookingEnabled: Boolean(settings.resortBookingEnabled),
  };

  try {
    const io = getIO();
    io.emit('features:updated', { settings: settingsPayload });
  } catch {
    // Socket might not be initialized during testing/migrations
  }

  return sendSuccess(res, {
    settings: settingsPayload,
  });
});
