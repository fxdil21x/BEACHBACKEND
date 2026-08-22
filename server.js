import 'dotenv/config';
import http from 'http';
import bcrypt from 'bcrypt';
import app, { allowedOrigins } from './app.js';
import { connectDB } from './config/db.js';
import { initSocket } from './services/socketService.js';
import User from './models/User.js';

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  // Auto-seed Master Admin if missing in database
  try {
    const username = (process.env.MASTER_ADMIN_USERNAME || 'masteradmin').toLowerCase();
    const existing = await User.findOne({ username });
    const password = process.env.MASTER_ADMIN_PASSWORD || 'MasterAdmin@123';
    const passwordHash = await bcrypt.hash(password, 12);
    if (!existing) {
      await User.create({
        name: process.env.MASTER_ADMIN_NAME || 'Master Admin',
        username,
        passwordHash,
        role: 'MASTER_ADMIN',
        isActive: true,
      });
      console.log('✓ Master admin seeded automatically:', username);
    } else {
      existing.passwordHash = passwordHash;
      existing.role = 'MASTER_ADMIN';
      existing.isActive = true;
      await existing.save();
      console.log('✓ Master admin password synced automatically:', username);
    }
  } catch (err) {
    console.warn('Master admin auto-seed check skipped:', err.message);
  }

  const server = http.createServer(app);
  initSocket(server, allowedOrigins);
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
