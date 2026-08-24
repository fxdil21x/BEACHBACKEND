import bcrypt from 'bcrypt';
import User from '../models/User.js';
import ResidentPass from '../models/ResidentPass.js';
import ResidentEntryLog from '../models/ResidentEntryLog.js';
import AuditLog from '../models/AuditLog.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/index.js';
import { isValidObjectId } from '../utils/validators.js';
import { getDashboardMetrics, getAnalytics } from '../services/analyticsService.js';
import { logAudit } from '../services/auditService.js';

export const getDashboard = asyncHandler(async (_req, res) => {
  const metrics = await getDashboardMetrics();
  return sendSuccess(res, { metrics });
});

export const getAnalyticsData = asyncHandler(async (_req, res) => {
  const analytics = await getAnalytics();
  return sendSuccess(res, { analytics });
});

export const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, role, search } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { username: new RegExp(search, 'i') },
    ];
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    User.countDocuments(filter),
  ]);

  const enriched = users.map((u) => ({
    id: u._id,
    name: u.name,
    username: u.username,
    role: u.role,
    hasResidentPass: Boolean(u.residentPassId),
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  }));

  return sendSuccess(res, {
    users: enriched,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, username, password, role = 'USER' } = req.body;

  if (!name?.trim() || !username?.trim() || !password) {
    return sendError(res, 'Name, username, and password are required', 400);
  }

  const allowedRoles = ['USER', 'ADMIN'];
  if (req.user.role === 'MASTER_ADMIN') allowedRoles.push('MASTER_ADMIN');

  if (!allowedRoles.includes(role)) {
    return sendError(res, 'Invalid role', 400);
  }

  if (role === 'MASTER_ADMIN' && req.user.role !== 'MASTER_ADMIN') {
    return sendError(res, 'Cannot create MASTER_ADMIN', 403);
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
    role,
  });

  await logAudit({
    performedBy: req.user._id,
    role: req.user.role,
    action: role === 'ADMIN' ? 'ADMIN_CREATED' : 'USER_CREATED',
    targetType: 'User',
    targetId: user._id,
  });

  return sendSuccess(res, { user: user.toSafeJSON() }, 201);
});

export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive, role, name, username, password } = req.body;

  if (!isValidObjectId(id)) {
    return sendError(res, 'Invalid user ID', 400);
  }

  const user = await User.findById(id);
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  if (role && role !== user.role) {
    const allowedRoles = ['USER', 'ADMIN'];
    if (req.user.role === 'MASTER_ADMIN') allowedRoles.push('MASTER_ADMIN');
    if (!allowedRoles.includes(role)) {
      return sendError(res, 'Invalid role', 400);
    }
    if (role === 'MASTER_ADMIN' && req.user.role !== 'MASTER_ADMIN') {
      return sendError(res, 'Cannot assign MASTER_ADMIN role', 403);
    }
    user.role = role;
  }

  if (name && name.trim()) {
    user.name = name.trim();
  }

  if (username && username.trim().toLowerCase() !== user.username) {
    const existing = await User.findOne({
      username: username.trim().toLowerCase(),
      _id: { $ne: id },
    });
    if (existing) {
      return sendError(res, 'Username already taken', 409);
    }
    user.username = username.trim().toLowerCase();
  }

  if (password && password.trim()) {
    user.passwordHash = await bcrypt.hash(password.trim(), 12);
  }

  if (typeof isActive === 'boolean' && isActive !== user.isActive) {
    user.isActive = isActive;
    await logAudit({
      performedBy: req.user._id,
      role: req.user.role,
      action: isActive ? 'USER_ENABLED' : 'USER_DISABLED',
      targetType: 'User',
      targetId: user._id,
    });
  }

  await user.save();

  await logAudit({
    performedBy: req.user._id,
    role: req.user.role,
    action: 'USER_UPDATED',
    targetType: 'User',
    targetId: user._id,
  });

  return sendSuccess(res, { user: user.toSafeJSON() });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return sendError(res, 'Invalid user ID', 400);
  }

  const user = await User.findById(id);
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  if (String(user._id) === String(req.user._id)) {
    return sendError(res, 'Cannot delete your active logged-in account', 400);
  }

  await User.findByIdAndDelete(id);

  await logAudit({
    performedBy: req.user._id,
    role: req.user.role,
    action: 'USER_DELETED',
    targetType: 'User',
    targetId: id,
  });

  return sendSuccess(res, { message: 'User account deleted successfully' });
});

export const getAdmins = asyncHandler(async (req, res) => {
  const admins = await User.find({ role: { $in: ['ADMIN', 'MASTER_ADMIN'] } }).sort({ createdAt: -1 }).lean();

  const enriched = await Promise.all(
    admins.map(async (admin) => {
      const scanCount = await ResidentEntryLog.countDocuments({ checkedBy: admin._id });
      return {
        id: admin._id,
        name: admin.name,
        username: admin.username,
        role: admin.role,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
        lastLoginAt: admin.lastLoginAt,
        scanCount,
      };
    })
  );

  return sendSuccess(res, { admins: enriched });
});

export const getAuditLogs = asyncHandler(async (req, res) => {
  const { action, role, search, page = 1, limit = 30 } = req.query;
  const filter = {
    role: { $in: ['USER', 'ADMIN'] },
  };

  if (action && action !== 'ALL') {
    filter.action = action;
  }
  if (role && role !== 'ALL' && ['USER', 'ADMIN'].includes(role)) {
    filter.role = role;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    const matchedUsers = await User.find({
      $or: [{ name: searchRegex }, { username: searchRegex }, { phone: searchRegex }],
    }).select('_id');
    const userIds = matchedUsers.map((u) => u._id);

    filter.$and = [
      { role: { $in: ['USER', 'ADMIN'] } },
      {
        $or: [
          { performedBy: { $in: userIds } },
          { action: searchRegex },
          { 'metadata.name': searchRegex },
          { 'metadata.username': searchRegex },
          { 'metadata.ip': searchRegex },
          { 'metadata.device': searchRegex },
          { 'metadata.os': searchRegex },
          { 'metadata.browser': searchRegex },
        ],
      },
    ];
    delete filter.$or;
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('performedBy', 'name username role phone')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    logs,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});
