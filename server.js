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

  // Ensure the default Master Admin account exists
  try {
    const envUsername = (process.env.MASTER_ADMIN_USERNAME || 'masteradmin').toLowerCase();
    const envName = process.env.MASTER_ADMIN_NAME || 'Master Admin';
    const password = process.env.MASTER_ADMIN_PASSWORD || 'MasterAdmin@123';

    const existingMaster = await User.findOne({ username: envUsername });
    if (!existingMaster) {
      const passwordHash = await bcrypt.hash(password, 12);
      await User.create({
        name: envName,
        username: envUsername,
        passwordHash,
        role: 'MASTER_ADMIN',
        isActive: true,
      });
      console.log('✓ Default master admin account created:', envUsername);
    }
  } catch (err) {
    console.warn('Master admin startup check skipped:', err.message);
  }

  const server = http.createServer(app);
  initSocket(server, allowedOrigins);
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
