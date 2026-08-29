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
      tabMaintenance: settings.tabMaintenance || [],
      appearance: settings.appearance,
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
    tabMaintenance,
    appearance,
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
  if (Array.isArray(tabMaintenance)) {
    settings.tabMaintenance = tabMaintenance;
  }
  if (appearance && typeof appearance === 'object') {
    settings.appearance = {
      ...(settings.appearance ? settings.appearance.toObject?.() || settings.appearance : {}),
      ...appearance,
    };
    settings.markModified('appearance');
  }

  await settings.save();

  const settingsPayload = {
    emergencySosEnabled: settings.emergencySosEnabled,
    publicReportEnabled: settings.publicReportEnabled,
    userReportEnabled: settings.userReportEnabled,
    trackUserEnabled: Boolean(settings.trackUserEnabled),
    orderFoodEnabled: Boolean(settings.orderFoodEnabled),
    resortBookingEnabled: Boolean(settings.resortBookingEnabled),
    tabMaintenance: settings.tabMaintenance || [],
    appearance: settings.appearance,
  };

  try {
    const io = getIO();
    io.emit('features:updated', { settings: settingsPayload });
    io.emit('appearance:updated', { appearance: settings.appearance });
  } catch {
    // Socket might not be initialized during testing/migrations
  }

  return sendSuccess(res, {
    settings: settingsPayload,
  });
});

export const getAppearance = asyncHandler(async (_req, res) => {
  const settings = await FeatureSettings.getSettings();
  return sendSuccess(res, {
    appearance: settings.appearance,
  });
});

export const updateAppearance = asyncHandler(async (req, res) => {
  const appearanceData = req.body;
  const settings = await FeatureSettings.getSettings();

  if (appearanceData && typeof appearanceData === 'object') {
    settings.appearance = {
      ...(settings.appearance ? settings.appearance.toObject?.() || settings.appearance : {}),
      ...appearanceData,
    };
    settings.markModified('appearance');
  }

  await settings.save();

  try {
    const io = getIO();
    io.emit('appearance:updated', { appearance: settings.appearance });
    io.emit('features:updated', { settings });
  } catch {
    // Socket error safety
  }

  return sendSuccess(res, {
    appearance: settings.appearance,
  });
});
