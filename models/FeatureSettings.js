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
  },
  { timestamps: true }
);

// Ensure single settings document
featureSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      emergencySosEnabled: true,
      publicReportEnabled: true,
      userReportEnabled: true,
      trackUserEnabled: false,
      orderFoodEnabled: true,
      resortBookingEnabled: true,
    });
  } else {
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
    if (updated) {
      await settings.save();
    }
  }
  return settings;
};

export default mongoose.model('FeatureSettings', featureSettingsSchema);
