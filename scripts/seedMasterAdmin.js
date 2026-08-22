import 'dotenv/config';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { connectDB } from '../config/db.js';

async function seed() {
  await connectDB();

  const envUsername = (process.env.MASTER_ADMIN_USERNAME || 'masteradmin').toLowerCase();
  const envName = process.env.MASTER_ADMIN_NAME || 'Master Admin';

  const defaultAccounts = [
    { username: envUsername, name: envName, role: 'MASTER_ADMIN' },
    { username: 'masteradmin', name: 'Master Admin', role: 'MASTER_ADMIN' },
    { username: 'juu', name: 'juu', role: 'MASTER_ADMIN' },
    { username: 'admin', name: 'Admin', role: 'MASTER_ADMIN' },
  ];
  const password = process.env.MASTER_ADMIN_PASSWORD || 'MasterAdmin@123';
  const passwordHash = await bcrypt.hash(password, 12);

  for (const acc of defaultAccounts) {
    const existing = await User.findOne({ username: acc.username });
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.role = acc.role;
      existing.isActive = true;
      await existing.save();
      console.log('Account password updated successfully:', acc.username);
    } else {
      await User.create({
        name: acc.name,
        username: acc.username,
        passwordHash,
        role: acc.role,
        isActive: true,
      });
      console.log('Account created:', acc.username);
    }
  }

  const allowedUsernames = defaultAccounts.map((a) => a.username);
  await User.deleteMany({
    role: { $in: ['ADMIN', 'MASTER_ADMIN'] },
    username: { $nin: allowedUsernames },
  });
  console.log('Cleaned up extra admin accounts.');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
