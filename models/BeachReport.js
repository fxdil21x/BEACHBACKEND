import mongoose from 'mongoose';

const beachReportSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['Garbage', 'Overflowing Bin', 'Unsafe Driving', 'Damaged Facility', 'Noise Problem', 'Safety Issue', 'Other'],
      required: true,
    },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    photoUrl: { type: String, default: null },
    photoPublicId: { type: String, default: null },
    status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED'], default: 'OPEN' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isAnonymous: { type: Boolean, default: false },
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      capturedAt: { type: Date, default: null },
    },
    deviceInfo: {
      userAgent: { type: String, default: null },
      platform: { type: String, default: null },
      language: { type: String, default: null },
      vendor: { type: String, default: null },
      screenWidth: { type: Number, default: null },
      screenHeight: { type: Number, default: null },
      timezone: { type: String, default: null },
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

beachReportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('BeachReport', beachReportSchema);
