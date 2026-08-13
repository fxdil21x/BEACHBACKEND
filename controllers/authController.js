import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { generateJwt } from '../utils/generateJwt.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/index.js';
import { logAudit } from '../services/auditService.js';

export const register = asyncHandler(async (req, res) => {
  const { name, username, password } = req.body;

  if (!name?.trim() || !username?.trim() || !password) {
    return sendError(res, 'Name, username, and password are required', 400);
  }

  if (password.length < 6) {
    return sendError(res, 'Password must be at least 6 characters', 400);
  }

  const existing = await User.findOne({ username: username.trim().toLowerCase() });
  if (existing) {
    return sendError(res, 'Username already taken', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: name.trim(),
    username: username.trim().toLowerCase(),
    passwordHash,
    role: 'USER',
  });

  const token = generateJwt(user._id, user.role);

  await logAudit({
    performedBy: user._id,
    role: user.role,
    action: 'USER_REGISTERED',
    targetType: 'User',
    targetId: user._id,
  });

  return sendSuccess(res, { token, user: user.toSafeJSON() }, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username?.trim() || !password) {
    return sendError(res, 'Username and password are required', 400);
  }

  const user = await User.findOne({ username: username.trim().toLowerCase() }).select('+passwordHash');
  if (!user) {
    return sendError(res, 'Invalid credentials', 401);
  }

  if (!user.isActive) {
    return sendError(res, 'Account is disabled', 403);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return sendError(res, 'Invalid credentials', 401);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = generateJwt(user._id, user.role);

  await logAudit({
    performedBy: user._id,
    role: user.role,
    action: 'LOGIN',
    targetType: 'User',
    targetId: user._id,
  });

  return sendSuccess(res, { token, user: user.toSafeJSON() });
});

export const me = asyncHandler(async (req, res) => {
  return sendSuccess(res, { user: req.user.toSafeJSON() });
});
