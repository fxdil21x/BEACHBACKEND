import FeatureSettings from '../models/FeatureSettings.js';
import { asyncHandler, sendSuccess } from '../utils/index.js';

export const getFeatureSettings = asyncHandler(async (_req, res) => {
  const settings = await FeatureSettings.getSettings();
  return sendSuccess(res, {
    settings: {
      emergencySosEnabled: settings.emergencySosEnabled,
      publicReportEnabled: settings.publicReportEnabled,
      userReportEnabled: settings.userReportEnabled,
    },
  });
});

export const updateFeatureSettings = asyncHandler(async (req, res) => {
  const { emergencySosEnabled, publicReportEnabled, userReportEnabled } = req.body;
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

  await settings.save();

  return sendSuccess(res, {
    settings: {
      emergencySosEnabled: settings.emergencySosEnabled,
      publicReportEnabled: settings.publicReportEnabled,
      userReportEnabled: settings.userReportEnabled,
    },
  });
});
