import { connectDB } from '../config/db.js';
import { sendError } from '../utils/index.js';

export async function requireDBConnection(_req, res, next) {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    return sendError(res, 'Database connection unavailable', 503);
  }
}
