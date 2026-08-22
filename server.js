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

  // Auto-seed Master Admin accounts (only juu and admin)
  try {
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
      if (!existing) {
        await User.create({
          name: acc.name,
          username: acc.username,
          passwordHash,
          role: acc.role,
          isActive: true,
        });
        console.log('✓ Account seeded automatically:', acc.username);
      } else {
        existing.passwordHash = passwordHash;
        existing.role = acc.role;
        existing.isActive = true;
        await existing.save();
        console.log('✓ Account password synced automatically:', acc.username);
      }
    }

    const allowedUsernames = defaultAccounts.map((a) => a.username);
    await User.deleteMany({
      role: { $in: ['ADMIN', 'MASTER_ADMIN'] },
      username: { $nin: allowedUsernames },
    });
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
