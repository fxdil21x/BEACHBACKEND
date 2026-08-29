import mongoose from 'mongoose';

const featureSettingsSchema = new mongoose.Schema(
  {
    emergencySosEnabled: {
      type: Boolean,
      default: true,
    },
    publicReportEnabled: {
      type: Boolean,
      default: true,
    },
    userReportEnabled: {
      type: Boolean,
      default: true,
    },
    trackUserEnabled: {
      type: Boolean,
      default: false,
    },
    orderFoodEnabled: {
      type: Boolean,
      default: true,
    },
    resortBookingEnabled: {
      type: Boolean,
      default: true,
    },
    tabMaintenance: {
      type: [
        {
          tabId: { type: String, required: true },
          title: { type: String, default: 'Feature Under Maintenance' },
          description: { type: String, default: 'This section is temporarily unavailable for scheduled updates.' },
          icon: { type: String, default: 'Wrench' },
          isBlocked: { type: Boolean, default: false },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [
        {
          tabId: 'report',
          title: 'Issue Reporting Under Maintenance',
          description: 'Reporting is temporarily paused for routine system maintenance.',
          icon: 'Wrench',
          isBlocked: false,
        },
        {
          tabId: 'services',
          title: 'Services Directory Under Update',
          description: 'The services and rides directory is undergoing scheduled updates.',
          icon: 'Car',
          isBlocked: false,
        },
        {
          tabId: 'my-pass',
          title: 'Gate Pass System Under Maintenance',
          description: 'Pass verification systems are being upgraded.',
          icon: 'Lock',
          isBlocked: false,
        },
        {
          tabId: 'my-visits',
          title: 'Visit Log Updating',
          description: 'Access log synchronization is in progress.',
          icon: 'Clock',
          isBlocked: false,
        },
        {
          tabId: 'beach-rules',
          title: 'Safety Guidelines Updating',
          description: 'Safety guidelines are being revised.',
          icon: 'ShieldAlert',
          isBlocked: false,
        },
      ],
    },
    appearance: {
      themeMode: { type: String, enum: ['light', 'dark'], default: 'light' },
      presetId: { type: String, default: 'ocean-blue' },
      accentColor: { type: String, default: '#0284C7' },
      accentSecondary: { type: String, default: '#38BDF8' },
      bgColor: { type: String, default: '#F8FAFC' },
      cardBgColor: { type: String, default: '#FFFFFF' },
      glowColor: { type: String, default: 'rgba(2, 132, 199, 0.35)' },
      cardRadius: { type: String, default: 'rounded-2xl' },
      dockStyle: { type: String, default: 'floating' },
      headerStyle: { type: String, default: 'glass' },
      glowMode: { type: String, default: 'vibrant' },
    },
  },
  { timestamps: true }
);

// Ensure single settings document
featureSettingsSchema.statics.getSettings = async function () {
  const allSettings = await this.find().sort({ updatedAt: -1 });
  let settings;
  if (!allSettings || allSettings.length === 0) {
    settings = await this.create({
      emergencySosEnabled: true,
      publicReportEnabled: true,
      userReportEnabled: true,
      trackUserEnabled: false,
      orderFoodEnabled: true,
      resortBookingEnabled: true,
      appearance: {
        themeMode: 'light',
        presetId: 'ocean-blue',
        accentColor: '#0284C7',
        accentSecondary: '#38BDF8',
        bgColor: '#F8FAFC',
        cardBgColor: '#FFFFFF',
        glowColor: 'rgba(2, 132, 199, 0.35)',
        cardRadius: 'rounded-2xl',
        dockStyle: 'floating',
        headerStyle: 'glass',
        glowMode: 'vibrant',
      },
    });
  } else {
    settings = allSettings[0];
    // Remove any duplicate documents if present
    if (allSettings.length > 1) {
      const extraIds = allSettings.slice(1).map((s) => s._id);
      await this.deleteMany({ _id: { $in: extraIds } });
    }

    let updated = false;
    if (settings.trackUserEnabled === undefined) {
      settings.trackUserEnabled = false;
      updated = true;
    }
    if (settings.orderFoodEnabled === undefined) {
      settings.orderFoodEnabled = true;
      updated = true;
    }
    if (settings.resortBookingEnabled === undefined) {
      settings.resortBookingEnabled = true;
      updated = true;
    }
    if (!settings.appearance) {
      settings.appearance = {
        themeMode: 'light',
        presetId: 'ocean-blue',
        accentColor: '#0284C7',
        accentSecondary: '#38BDF8',
        bgColor: '#F8FAFC',
        cardBgColor: '#FFFFFF',
        glowColor: 'rgba(2, 132, 199, 0.35)',
        cardRadius: 'rounded-2xl',
        dockStyle: 'floating',
        headerStyle: 'glass',
        glowMode: 'vibrant',
      };
      updated = true;
    }
    if (!settings.tabMaintenance || settings.tabMaintenance.length === 0) {
      settings.tabMaintenance = [
        {
          tabId: 'report',
          title: 'Issue Reporting Under Maintenance',
          description: 'Reporting is temporarily paused for routine system maintenance.',
          icon: 'Wrench',
          isBlocked: false,
        },
        {
          tabId: 'services',
          title: 'Services Directory Under Update',
          description: 'The services and rides directory is undergoing scheduled updates.',
          icon: 'Car',
          isBlocked: false,
        },
        {
          tabId: 'my-pass',
          title: 'Gate Pass System Under Maintenance',
          description: 'Pass verification systems are being upgraded.',
          icon: 'Lock',
          isBlocked: false,
        },
        {
          tabId: 'my-visits',
          title: 'Visit Log Updating',
          description: 'Access log synchronization is in progress.',
          icon: 'Clock',
          isBlocked: false,
        },
        {
          tabId: 'beach-rules',
          title: 'Safety Guidelines Updating',
          description: 'Safety guidelines are being revised.',
          icon: 'ShieldAlert',
          isBlocked: false,
        },
      ];
      updated = true;
    }
    if (updated) {
      await settings.save();
    }
  }
  return settings;
};

export default mongoose.model('FeatureSettings', featureSettingsSchema);
