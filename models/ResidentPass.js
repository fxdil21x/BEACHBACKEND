import mongoose from 'mongoose';

const residentPassSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    residentRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResidentRecord', required: true },
    residentSecId: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    photoUrl: { type: String, default: null },
    photoPublicId: { type: String, default: null },
    qrToken: { type: String, required: true, unique: true, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

residentPassSchema.index({ residentRecordId: 1, isActive: 1 });
residentPassSchema.index({ phone: 1 });

export default mongoose.model('ResidentPass', residentPassSchema);
