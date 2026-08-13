import 'dotenv/config';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { connectDB } from '../config/db.js';

async function seed() {
  await connectDB();

  const username = process.env.MASTER_ADMIN_USERNAME || 'masteradmin';
  const password = process.env.MASTER_ADMIN_PASSWORD || 'MasterAdmin@123';
  const name = process.env.MASTER_ADMIN_NAME || 'Master Admin';

  const existing = await User.findOne({ username: username.toLowerCase() });
  if (existing) {
    console.log('Master admin already exists:', username);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({
    name,
    username: username.toLowerCase(),
    passwordHash,
    role: 'MASTER_ADMIN',
    isActive: true,
  });

  console.log('Master admin created:', username);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
