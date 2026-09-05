import mongoose from 'mongoose';

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    trim: true,
    default: 'Main Course',
  },
  type: {
    type: String,
    enum: ['veg', 'non-veg', 'seafood', 'egg'],
    default: 'non-veg',
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  image: {
    type: String,
    default: '',
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  isSpecial: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

const roomTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  capacity: {
    type: String,
    default: '2 Adults',
  },
  amenities: {
    type: [String],
    default: [],
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
});

const serviceSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['restaurant', 'transport', 'stay', 'activity', 'rental'],
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    tagline: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    whatsapp: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    googleMapsUrl: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },

    // ── Restaurant Specific Details ──
    restaurantDetails: {
      cuisineTypes: {
        type: [String],
        default: ['Malabar', 'Seafood'],
      },
      openingHours: {
        type: String,
        default: '11:00 AM - 11:00 PM',
      },
      isPureVeg: {
        type: Boolean,
        default: false,
      },
      dietaryType: {
        type: String,
        enum: ['all', 'veg', 'non-veg', 'seafood', 'fried'],
        default: 'all',
      },
      foodTypes: {
        type: [String],
        default: ['all'],
      },
      categories: {
        type: [String],
        default: ['Main Course', 'Starters', 'Seafood Specials', 'Breads & Rice', 'Snacks & Quick Bites', 'Desserts', 'Beverages'],
      },
      menuItems: [menuItemSchema],
    },

    // ── Transport / Auto / Taxi Specific Details ──
    transportDetails: {
      driverName: {
        type: String,
        default: '',
      },
      vehicleNumber: {
        type: String,
        default: '',
      },
      vehicleType: {
        type: String,
        enum: ['auto', 'taxi_4seater', 'taxi_7seater', 'traveller'],
        default: 'auto',
      },
      standLocation: {
        type: String,
        default: 'North Gate Auto Stand',
      },
      baseFareNote: {
        type: String,
        default: 'Standard meter / fixed beach rates',
      },
      isAvailable: {
        type: Boolean,
        default: true,
      },
    },

    // ── Stay / Resort Specific Details ──
    stayDetails: {
      pricePerNight: {
        type: Number,
        default: 0,
      },
      amenities: {
        type: [String],
        default: ['Beach View', 'AC', 'Free Wi-Fi', 'Parking'],
      },
      checkInTime: {
        type: String,
        default: '12:00 PM',
      },
      checkOutTime: {
        type: String,
        default: '11:00 AM',
      },
      roomTypes: [roomTypeSchema],
    },
  },
  { timestamps: true }
);

// Index for search queries
serviceSchema.index({ name: 'text', location: 'text', tagline: 'text' });

const Service = mongoose.model('Service', serviceSchema);
export default Service;
