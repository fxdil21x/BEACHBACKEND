import ResidentPass from '../models/ResidentPass.js';
import ResidentRecord from '../models/ResidentRecord.js';
import ResidentEntryLog from '../models/ResidentEntryLog.js';
import User from '../models/User.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/index.js';
import { generateQrToken } from '../utils/generateQrToken.js';
import { isValidObjectId, validatePhone, normalizePhone } from '../utils/validators.js';
import { processAndUploadPhoto, deleteFromCloudinary } from '../services/imageService.js';
import { logAudit } from '../services/auditService.js';

export const createResidentPass = asyncHandler(async (req, res) => {
  const { residentRecordId, phone } = req.body;

  if (!isValidObjectId(residentRecordId)) {
    return sendError(res, 'Invalid resident record ID', 400);
  }

  if (!validatePhone(phone)) {
    return sendError(res, 'Valid 10-digit phone number required', 400);
  }

  const existingPass = await ResidentPass.findOne({ userId: req.user._id });
  if (existingPass) {
    return sendError(res, 'You already have a resident pass', 409);
  }

  const record = await ResidentRecord.findById(residentRecordId);
  if (!record) {
    return sendError(res, 'Resident record not found', 404);
  }

  const activeDuplicate = await ResidentPass.findOne({ residentRecordId, isActive: true });
  if (activeDuplicate) {
    return sendError(res, 'This resident record is already linked to another pass', 409);
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

  const pass = await ResidentPass.create({
    userId: req.user._id,
    residentRecordId: record._id,
    residentSecId: record.newSecIdNo,
    phone: normalizePhone(phone),
    photoUrl,
    photoPublicId,
    qrToken: generateQrToken(),
  });

  await User.findByIdAndUpdate(req.user._id, { residentPassId: pass._id });

  await logAudit({
    performedBy: req.user._id,
    role: req.user.role,
    action: 'RESIDENT_PASS_CREATED',
    targetType: 'ResidentPass',
    targetId: pass._id,
  });

  const populated = await ResidentPass.findById(pass._id).populate('residentRecordId', 'name guardianName houseName ward age gender');

  return sendSuccess(res, { pass: formatPass(populated) }, 201);
});

export const getMyPass = asyncHandler(async (req, res) => {
  const pass = await ResidentPass.findOne({ userId: req.user._id }).populate(
    'residentRecordId',
    'name guardianName houseName ward age gender'
  );

  if (!pass) {
    return sendSuccess(res, { pass: null });
  }

  return sendSuccess(res, { pass: formatPass(pass) });
});

export const getMyQr = asyncHandler(async (req, res) => {
  const pass = await ResidentPass.findOne({ userId: req.user._id });

  if (!pass) {
    return sendError(res, 'No resident pass found', 404);
  }

  if (!pass.isActive) {
    return sendError(res, 'Pass is disabled', 403);
  }

  return sendSuccess(res, { qrToken: pass.qrToken });
});

export const updateMyPhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 'Photo is required', 400);
  }

  const pass = await ResidentPass.findOne({ userId: req.user._id });
  if (!pass) {
    return sendError(res, 'No resident pass found', 404);
  }

  let uploaded;
  try {
    uploaded = await processAndUploadPhoto(req.file.buffer);
  } catch (err) {
    return sendError(res, err.message || 'Photo upload failed', 500);
  }

  if (pass.photoPublicId) {
    await deleteFromCloudinary(pass.photoPublicId);
  }

  pass.photoUrl = uploaded.photoUrl;
  pass.photoPublicId = uploaded.photoPublicId;
  await pass.save();

  await logAudit({
    performedBy: req.user._id,
    role: req.user.role,
    action: 'RESIDENT_PHOTO_UPDATED',
    targetType: 'ResidentPass',
    targetId: pass._id,
  });

  const populated = await ResidentPass.findById(pass._id).populate(
    'residentRecordId',
    'name guardianName houseName ward age gender'
  );

  return sendSuccess(res, { pass: formatPass(populated) });
});

export const getMyEntries = asyncHandler(async (req, res) => {
  const pass = await ResidentPass.findOne({ userId: req.user._id });
  if (!pass) {
    return sendSuccess(res, { entries: [], total: 0, lastVisit: null });
  }

  const entries = await ResidentEntryLog.find({ residentPassId: pass._id })
    .sort({ checkedAt: -1 })
    .limit(50)
    .populate('checkedBy', 'name')
    .lean();

  return sendSuccess(res, {
    entries,
    total: entries.length,
    lastVisit: entries[0]?.checkedAt || null,
  });
});

export const getRegisteredResidents = asyncHandler(async (req, res) => {
  const { name, phone, houseName, ward, hasPhoto, passStatus, page = 1, limit = 25, sort = 'newest' } = req.query;

  const filter = {};
  if (phone) filter.phone = new RegExp(String(phone).replace(/\s/g, ''), 'i');
  if (passStatus === 'active') filter.isActive = true;
  if (passStatus === 'disabled') filter.isActive = false;
  if (hasPhoto === 'true') filter.photoUrl = { $ne: null };
  if (hasPhoto === 'false') filter.$or = [{ photoUrl: null }, { photoUrl: '' }];

  const sortMap = {
    'name-asc': { 'residentRecordId.name': 1 },
    'name-desc': { 'residentRecordId.name': -1 },
    'age-asc': { 'residentRecordId.age': 1 },
    'age-desc': { 'residentRecordId.age': -1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
  };

  let query = ResidentPass.find(filter).populate('residentRecordId userId', 'name guardianName houseName ward age gender username');

  if (name) {
    query = query.where('residentRecordId').populate({
      path: 'residentRecordId',
      match: { name: new RegExp(name, 'i') },
    });
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  let passes = await ResidentPass.find(filter)
    .populate('residentRecordId', 'name guardianName houseName ward age gender')
    .populate('userId', 'name username')
    .sort(sortMap[sort] || { createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  if (name) {
    const nameRegex = new RegExp(name, 'i');
    passes = passes.filter((p) => p.residentRecordId && nameRegex.test(p.residentRecordId.name));
  }
  if (houseName) {
    const houseRegex = new RegExp(houseName, 'i');
    passes = passes.filter((p) => p.residentRecordId && houseRegex.test(p.residentRecordId.houseName));
  }
  if (ward) {
    passes = passes.filter((p) => p.residentRecordId?.ward === ward);
  }

  const total = await ResidentPass.countDocuments(filter);

  const enriched = await Promise.all(
    passes.map(async (pass) => {
      const entryCount = await ResidentEntryLog.countDocuments({ residentPassId: pass._id });
      const lastEntry = await ResidentEntryLog.findOne({ residentPassId: pass._id }).sort({ checkedAt: -1 }).lean();
      return { ...pass, entryCount, lastEntry: lastEntry?.checkedAt || null };
    })
  );

  return sendSuccess(res, {
    residents: enriched,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

export const togglePassStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (!isValidObjectId(id)) {
    return sendError(res, 'Invalid pass ID', 400);
  }

  const pass = await ResidentPass.findByIdAndUpdate(id, { isActive: Boolean(isActive) }, { new: true });
  if (!pass) {
    return sendError(res, 'Pass not found', 404);
  }

  await logAudit({
    performedBy: req.user._id,
    role: req.user.role,
    action: isActive ? 'PASS_RE_ENABLED' : 'PASS_DISABLED',
    targetType: 'ResidentPass',
    targetId: pass._id,
  });

  return sendSuccess(res, { pass });
});

function formatPass(pass) {
  const record = pass.residentRecordId;
  return {
    id: pass._id,
    phone: pass.phone,
    photoUrl: pass.photoUrl,
    qrToken: pass.qrToken,
    isActive: pass.isActive,
    createdAt: pass.createdAt,
    updatedAt: pass.updatedAt,
    resident: record
      ? {
          id: record._id,
          name: record.name,
          guardianName: record.guardianName,
          houseName: record.houseName,
          ward: record.ward,
          age: record.age,
          gender: record.gender,
        }
      : null,
  };
}

export { formatPass };
