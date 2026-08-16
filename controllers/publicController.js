import bcrypt from 'bcrypt';
import ResidentRecord from '../models/ResidentRecord.js';
import ResidentPass from '../models/ResidentPass.js';
import User from '../models/User.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/index.js';
import {
  buildNameSearchRegex,
  buildUsernameFromRecord,
  isValidObjectId,
  normalizePhone,
  sanitizeUserSearch,
  validatePhone,
} from '../utils/validators.js';
import { generateJwt } from '../utils/generateJwt.js';
import { generateQrToken } from '../utils/generateQrToken.js';
import { processAndUploadPhoto } from '../services/imageService.js';
import { logAudit } from '../services/auditService.js';
import { formatPass } from './residentPassController.js';

function toPublicRecord(record, registeredSet) {
  return {
    id: record._id,
    name: record.name,
    guardianName: record.guardianName,
    houseName: record.houseName,
    gender: record.gender,
    isRegistered: registeredSet.has(String(record._id)),
  };
}

async function ensureUniqueUsername(baseUsername) {
  let username = baseUsername;
  let attempt = 0;
  while (await User.findOne({ username })) {
    attempt += 1;
    username = `${baseUsername}${attempt}`;
  }
  return username;
}

export const publicSearchResidents = asyncHandler(async (req, res) => {
  const name = sanitizeUserSearch(req.query.name);

  if (!name || name.length < 2) {
    return sendError(res, 'Search query must be at least 2 characters', 400);
  }

  const regex = buildNameSearchRegex(name);
  const records = await ResidentRecord.find({ name: regex })
    .select('name guardianName houseName gender newSecIdNo')
    .sort({ name: 1 })
    .limit(20)
    .lean();

  const recordIds = records.map((record) => record._id);
  const activePasses = await ResidentPass.find({
    residentRecordId: { $in: recordIds },
    isActive: true,
  })
    .select('residentRecordId')
    .lean();

  const registeredSet = new Set(activePasses.map((pass) => String(pass.residentRecordId)));

  return sendSuccess(res, {
    records: records.map((record) => toPublicRecord(record, registeredSet)),
  });
});

export const publicRegisterResident = asyncHandler(async (req, res) => {
  const { residentRecordId, phone } = req.body;

  if (!isValidObjectId(residentRecordId)) {
    return sendError(res, 'Invalid resident record ID', 400);
  }

  if (!validatePhone(phone)) {
    return sendError(res, 'Valid 10-digit phone number required', 400);
  }

  const normalizedPhone = normalizePhone(phone);

  const record = await ResidentRecord.findById(residentRecordId);
  if (!record) {
    return sendError(res, 'Resident record not found', 404, 'NOT_IN_DATA');
  }

  const activeDuplicate = await ResidentPass.findOne({ residentRecordId, isActive: true });
  if (activeDuplicate) {
    return sendError(res, 'This resident is already registered', 409, 'ALREADY_REGISTERED');
  }

  const phoneInUse = await ResidentPass.findOne({ phone: normalizedPhone, isActive: true });
  if (phoneInUse) {
    return sendError(res, 'This phone number is already registered', 409, 'PHONE_IN_USE');
  }

  let photoUrl = null;
  let photoPublicId = null;

  if (req.file) {
    try {
      const uploaded = await processAndUploadPhoto(req.file.buffer);
      photoUrl = uploaded.photoUrl;
      photoPublicId = uploaded.photoPublicId;
    } catch (err) {
      return sendError(res, err.message || 'Photo upload failed', 500);
    }
  }

  const baseUsername = buildUsernameFromRecord(record);
  const username = await ensureUniqueUsername(baseUsername);
  const passwordHash = await bcrypt.hash(normalizedPhone, 12);

  const user = await User.create({
    name: record.name,
    username,
    passwordHash,
    role: 'USER',
  });

  const pass = await ResidentPass.create({
    userId: user._id,
    residentRecordId: record._id,
    residentSecId: record.newSecIdNo,
    phone: normalizedPhone,
    photoUrl,
    photoPublicId,
    qrToken: generateQrToken(),
  });

  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    { residentPassId: pass._id },
    { new: true }
  );

  await logAudit({
    performedBy: user._id,
    role: user.role,
    action: 'RESIDENT_PASS_CREATED',
    targetType: 'ResidentPass',
    targetId: pass._id,
  });

  const populated = await ResidentPass.findById(pass._id).populate(
    'residentRecordId',
    'name guardianName houseName ward age gender'
  );

  const token = generateJwt(user._id, user.role);

  return sendSuccess(
    res,
    {
      token,
      user: (updatedUser || user).toSafeJSON(),
      pass: formatPass(populated),
      qrToken: pass.qrToken,
      credentials: {
        displayName: record.name,
        phone: normalizedPhone,
      },
    },
    201
  );
});

export const publicLoginResident = asyncHandler(async (req, res) => {
  const { residentRecordId, phone } = req.body;

  if (!isValidObjectId(residentRecordId)) {
    return sendError(res, 'Invalid resident record ID', 400);
  }

  if (!validatePhone(phone)) {
    return sendError(res, 'Valid 10-digit phone number required', 400);
  }

  const normalizedPhone = normalizePhone(phone);

  const record = await ResidentRecord.findById(residentRecordId);
  if (!record) {
    return sendError(res, 'Resident record not found', 404, 'NOT_IN_DATA');
  }

  const pass = await ResidentPass.findOne({ residentRecordId, isActive: true }).populate(
    'residentRecordId',
    'name guardianName houseName ward age gender'
  );

  if (!pass) {
    return sendError(
      res,
      'Not registered yet. Use Register to add your phone number.',
      404,
      'NOT_REGISTERED'
    );
  }

  if (pass.phone !== normalizedPhone) {
    return sendError(res, 'Phone number does not match', 401, 'PHONE_MISMATCH');
  }

  const user = await User.findById(pass.userId).select('+passwordHash');
  if (!user || !user.isActive) {
    return sendError(res, 'Account is disabled', 403);
  }

  const valid = await bcrypt.compare(normalizedPhone, user.passwordHash);
  if (!valid) {
    return sendError(res, 'Phone number does not match', 401, 'PHONE_MISMATCH');
  }

  user.lastLoginAt = new Date();
  await user.save();

  await logAudit({
    performedBy: user._id,
    role: user.role,
    action: 'LOGIN',
    targetType: 'User',
    targetId: user._id,
  });

  const token = generateJwt(user._id, user.role);

  return sendSuccess(res, {
    token,
    user: user.toSafeJSON(),
    pass: formatPass(pass),
    qrToken: pass.qrToken,
  });
});
