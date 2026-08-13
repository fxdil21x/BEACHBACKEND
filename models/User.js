import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['USER', 'ADMIN', 'MASTER_ADMIN'],
      default: 'USER',
    },
    residentPassId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResidentPass', default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    username: this.username,
    role: this.role,
    residentPassId: this.residentPassId,
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
