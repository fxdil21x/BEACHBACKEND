import mongoose from 'mongoose';

const emergencySchema = new mongoose.Schema(
  {
    emergencyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      default: 'ANONYMOUS',
    },
    userName: {
      type: String,
      default: 'Beach Visitor',
    },
    userPhone: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: 'Muzhappilangad Drive-In Beach',
    },
    message: {
      type: String,
      default: 'Emergency Alert!',
    },
    status: {
      type: String,
      enum: ['PENDING', 'CLAIMED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    claimedBy: {
      id: String,
      name: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Emergency', emergencySchema);
