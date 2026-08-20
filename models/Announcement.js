import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    icon: {
      type: String,
      default: 'Sparkles',
      enum: ['Sparkles', 'Radio', 'MapPin', 'Compass', 'Zap', 'Bell', 'ShieldAlert', 'Car', 'Truck', 'Info', 'Gift', 'Star'],
    },
    targetRole: {
      type: String,
      enum: ['all', 'user', 'admin'],
      default: 'all',
    },
    badge: {
      type: String,
      enum: ['Coming Soon', 'New Feature', 'Update', 'Important'],
      default: 'Coming Soon',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Announcement', announcementSchema);
