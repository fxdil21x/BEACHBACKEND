import mongoose from 'mongoose';

const visitorEntrySchema = new mongoose.Schema(
  {
    visitorCount: { type: Number, required: true, min: 1 },
    source: { type: String, default: 'PUBLIC_QR' },
    entryFeePerPerson: { type: Number, default: 20 },
    paymentMethod: { type: String, default: 'OFFLINE' },
    idempotencyKey: { type: String, index: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    qrToken: { type: String, index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scannedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

visitorEntrySchema.index({ createdAt: -1 });
visitorEntrySchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('VisitorEntry', visitorEntrySchema);
