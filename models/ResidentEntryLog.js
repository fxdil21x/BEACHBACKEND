import mongoose from 'mongoose';

const residentEntryLogSchema = new mongoose.Schema(
  {
    residentPassId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResidentPass', required: true },
    residentRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResidentRecord', required: true },
    entryType: { type: String, enum: ['FREE'], default: 'FREE' },
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    checkedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

residentEntryLogSchema.index({ checkedAt: -1 });
residentEntryLogSchema.index({ residentPassId: 1, checkedAt: -1 });

export default mongoose.model('ResidentEntryLog', residentEntryLogSchema);
