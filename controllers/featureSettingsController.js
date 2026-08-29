import FeatureSettings from '../models/FeatureSettings.js';
import { asyncHandler, sendSuccess } from '../utils/index.js';

export function formatAppearance(appearance) {
  const appObj = appearance && typeof appearance.toObject === 'function'
    ? appearance.toObject()
    : { ...(appearance || {}) };

  const components = Array.isArray(appObj.components) && appObj.components.length > 0
    ? appObj.components
    : [
        {
          id: 'nav',
          name: 'Bottom Menu Bar',
          type: 'navigation',
          style: appObj.dockStyle || 'floating',
          options: ['floating', 'flush'],
          active: true,
        },
        {
          id: 'header',
          name: 'Top Header Bar',
          type: 'header',
          style: appObj.headerStyle || 'glass',
          options: ['glass', 'minimal', 'solid'],
          active: true,
        },
        {
          id: 'cards',
          name: 'Card & Surface Containers',
          type: 'surface',
          style: appObj.cardRadius || 'rounded-2xl',
          options: ['rounded-xl', 'rounded-2xl', 'rounded-3xl'],
          active: true,
        },
      ];

  const navComp = components.find((c) => c.id === 'nav');
  const cardsComp = components.find((c) => c.id === 'cards');
  const headerComp = components.find((c) => c.id === 'header');

  return {
    themeMode: appObj.themeMode || 'light',
    presetId: appObj.presetId || 'ocean-blue',
    accentColor: appObj.accentColor || '#0284C7',
    accentSecondary: appObj.accentSecondary || '#38BDF8',
    bgColor: appObj.bgColor || '#F8FAFC',
    cardBgColor: appObj.cardBgColor || '#FFFFFF',
    glowColor: appObj.glowColor || 'rgba(2, 132, 199, 0.35)',
    glowMode: appObj.glowMode || 'vibrant',
    components,
    dockStyle: appObj.dockStyle || navComp?.style || 'floating',
    userDockStyle: appObj.userDockStyle || appObj.dockStyle || navComp?.style || 'floating',
    adminDockStyle: appObj.adminDockStyle || 'flush',
    cardRadius: appObj.cardRadius || cardsComp?.style || 'rounded-2xl',
    headerStyle: appObj.headerStyle || headerComp?.style || 'glass',
    banners: appObj.banners || {},
  };
}

export const getFeatureSettings = asyncHandler(async (_req, res) => {
  const settings = await FeatureSettings.getSettings();
  const formattedAppearance = formatAppearance(settings.appearance);

  return sendSuccess(res, {
    settings: {
      emergencySosEnabled: settings.emergencySosEnabled,
      publicReportEnabled: settings.publicReportEnabled,
      userReportEnabled: settings.userReportEnabled,
      trackUserEnabled: Boolean(settings.trackUserEnabled),
      orderFoodEnabled: Boolean(settings.orderFoodEnabled ?? true),
      resortBookingEnabled: Boolean(settings.resortBookingEnabled ?? true),
      tabMaintenance: settings.tabMaintenance || [],
      appearance: formattedAppearance,
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
    const prev = settings.appearance ? settings.appearance.toObject?.() || settings.appearance : {};
    let components = Array.isArray(appearance.components) ? [...appearance.components] : [...(prev.components || [])];
    
    // Sync from flat fields to components array if flat fields provided
    if (appearance.dockStyle) {
      const idx = components.findIndex((c) => c.id === 'nav');
      if (idx !== -1) components[idx] = { ...components[idx], style: appearance.dockStyle };
    }
    if (appearance.cardRadius) {
      const idx = components.findIndex((c) => c.id === 'cards');
      if (idx !== -1) components[idx] = { ...components[idx], style: appearance.cardRadius };
    }
    if (appearance.headerStyle) {
      const idx = components.findIndex((c) => c.id === 'header');
      if (idx !== -1) components[idx] = { ...components[idx], style: appearance.headerStyle };
    }

    // Sync from components array to flat fields
    const navComp = components.find((c) => c.id === 'nav');
    const cardsComp = components.find((c) => c.id === 'cards');
    const headerComp = components.find((c) => c.id === 'header');

    settings.appearance = {
      ...prev,
      ...appearance,
      dockStyle: appearance.dockStyle || navComp?.style || prev.dockStyle || 'floating',
      cardRadius: appearance.cardRadius || cardsComp?.style || prev.cardRadius || 'rounded-2xl',
      headerStyle: appearance.headerStyle || headerComp?.style || prev.headerStyle || 'glass',
      components,
    };
    settings.markModified('appearance');
  }

  await settings.save();

  const formattedAppearance = formatAppearance(settings.appearance);

  const settingsPayload = {
    emergencySosEnabled: settings.emergencySosEnabled,
    publicReportEnabled: settings.publicReportEnabled,
    userReportEnabled: settings.userReportEnabled,
    trackUserEnabled: Boolean(settings.trackUserEnabled),
    orderFoodEnabled: Boolean(settings.orderFoodEnabled),
    resortBookingEnabled: Boolean(settings.resortBookingEnabled),
    tabMaintenance: settings.tabMaintenance || [],
    appearance: formattedAppearance,
  };

  return sendSuccess(res, {
    settings: settingsPayload,
  });
});

export const getAppearance = asyncHandler(async (_req, res) => {
  const settings = await FeatureSettings.getSettings();
  const formattedAppearance = formatAppearance(settings.appearance);

  return sendSuccess(res, {
    appearance: formattedAppearance,
  });
});

export const updateAppearance = asyncHandler(async (req, res) => {
  const appearanceData = req.body;
  const settings = await FeatureSettings.getSettings();

  if (appearanceData && typeof appearanceData === 'object') {
    const prev = settings.appearance ? settings.appearance.toObject?.() || settings.appearance : {};
    let components = Array.isArray(appearanceData.components) ? [...appearanceData.components] : [...(prev.components || [])];

    // Sync from flat fields to components array if flat fields provided
    if (appearanceData.dockStyle) {
      const idx = components.findIndex((c) => c.id === 'nav');
      if (idx !== -1) {
        components[idx] = { ...components[idx], style: appearanceData.dockStyle };
      } else {
        components.push({
          id: 'nav',
          name: 'Bottom Menu Bar',
          type: 'navigation',
          style: appearanceData.dockStyle,
          options: ['floating', 'flush'],
          active: true,
        });
      }
    }
    if (appearanceData.cardRadius) {
      const idx = components.findIndex((c) => c.id === 'cards');
      if (idx !== -1) {
        components[idx] = { ...components[idx], style: appearanceData.cardRadius };
      } else {
        components.push({
          id: 'cards',
          name: 'Card & Surface Containers',
          type: 'surface',
          style: appearanceData.cardRadius,
          options: ['rounded-xl', 'rounded-2xl', 'rounded-3xl'],
          active: true,
        });
      }
    }
    if (appearanceData.headerStyle) {
      const idx = components.findIndex((c) => c.id === 'header');
      if (idx !== -1) {
        components[idx] = { ...components[idx], style: appearanceData.headerStyle };
      } else {
        components.push({
          id: 'header',
          name: 'Top Header Bar',
          type: 'header',
          style: appearanceData.headerStyle,
          options: ['glass', 'minimal', 'solid'],
          active: true,
        });
      }
    }

    // Sync from components array to flat fields
    const navComp = components.find((c) => c.id === 'nav');
    const cardsComp = components.find((c) => c.id === 'cards');
    const headerComp = components.find((c) => c.id === 'header');

    settings.appearance = {
      ...prev,
      ...appearanceData,
      dockStyle: appearanceData.dockStyle || navComp?.style || prev.dockStyle || 'floating',
      userDockStyle: appearanceData.userDockStyle || prev.userDockStyle || appearanceData.dockStyle || navComp?.style || prev.dockStyle || 'floating',
      adminDockStyle: appearanceData.adminDockStyle || prev.adminDockStyle || 'flush',
      cardRadius: appearanceData.cardRadius || cardsComp?.style || prev.cardRadius || 'rounded-2xl',
      headerStyle: appearanceData.headerStyle || headerComp?.style || prev.headerStyle || 'glass',
      components,
    };
    settings.markModified('appearance');
  }

  await settings.save();

  const formattedAppearance = formatAppearance(settings.appearance);

  return sendSuccess(res, {
    appearance: formattedAppearance,
  });
});
