import 'dotenv/config';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { connectDB } from '../config/db.js';

async function seed() {
  await connectDB();

  const envUsername = (process.env.MASTER_ADMIN_USERNAME || 'masteradmin').toLowerCase();
  const envName = process.env.MASTER_ADMIN_NAME || 'Master Admin';
  const password = process.env.MASTER_ADMIN_PASSWORD || 'MasterAdmin@123';
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await User.findOne({ username: envUsername });
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = 'MASTER_ADMIN';
    existing.isActive = true;
    await existing.save();
    console.log('Master admin account synced successfully:', envUsername);
  } else {
    await User.create({
      name: envName,
      username: envUsername,
      passwordHash,
      role: 'MASTER_ADMIN',
      isActive: true,
    });
    console.log('Master admin account created:', envUsername);
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
