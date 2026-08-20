import 'dotenv/config';
import http from 'http';
import app, { allowedOrigins } from './app.js';
import { connectDB } from './config/db.js';
import { initSocket } from './services/socketService.js';

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  const server = http.createServer(app);
  initSocket(server, allowedOrigins);
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
