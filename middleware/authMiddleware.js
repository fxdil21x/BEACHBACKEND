import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendError } from '../utils/index.js';

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required', 401);
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('+passwordHash');
    if (!user || !user.isActive) {
      return sendError(res, 'Account inactive or not found', 401);
    }

    req.user = user;
    next();
  } catch {
    return sendError(res, 'Invalid or expired token', 401);
  }
}

export async function eventAuthMiddleware(req, res, next) {
  try {
    const token = req.query.token;
    if (!token) {
      return sendError(res, 'Authentication required', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('+passwordHash');
    if (!user || !user.isActive) {
      return sendError(res, 'Account inactive or not found', 401);
    }

    req.user = user;
    next();
  } catch {
    return sendError(res, 'Invalid or expired token', 401);
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }
  return authMiddleware(req, res, next);
}
