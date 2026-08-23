import ResidentRecord from '../models/ResidentRecord.js';
import ResidentPass from '../models/ResidentPass.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/index.js';
import { buildNameSearchRegex, escapeRegex, isValidObjectId, sanitizeUserSearch } from '../utils/validators.js';

function toUserSafeRecord(record) {
  return {
    id: record._id,
    name: record.name,
    guardianName: record.guardianName,
    houseName: record.houseName,
    ward: record.ward,
    age: record.age,
    gender: record.gender,
  };
}

export const searchResidents = asyncHandler(async (req, res) => {
  const name = sanitizeUserSearch(req.query.name);

  if (!name || name.length < 2) {
    return sendError(res, 'Search query must be at least 2 characters', 400);
  }

  const regex = buildNameSearchRegex(name);
  const records = await ResidentRecord.find({ name: regex })
    .select('name guardianName houseName ward age gender')
    .limit(20)
    .lean();

  return sendSuccess(res, { records: records.map(toUserSafeRecord) });
});

export const getResidentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return sendError(res, 'Invalid resident ID', 400);
  }

  const record = await ResidentRecord.findById(id)
    .select('name guardianName houseName ward age gender')
    .lean();

  if (!record) {
    return sendError(res, 'Resident not found', 404);
  }

  return sendSuccess(res, { record: toUserSafeRecord(record) });
});

export const searchResidentsAdmin = asyncHandler(async (req, res) => {
  const { name, phone, houseName, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (name) filter.name = buildNameSearchRegex(name);
  if (houseName) filter.houseName = new RegExp(escapeRegex(String(houseName)), 'i');

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [records, total] = await Promise.all([
    ResidentRecord.find(filter).sort({ name: 1 }).skip(skip).limit(Number(limit)).lean(),
    ResidentRecord.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    records,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

export const getResidentRecordsMaster = asyncHandler(async (req, res) => {
  const { name, houseName, ward, newSecIdNo, page = 1, limit = 25, sort = 'name' } = req.query;
  const filter = {};

  if (name) filter.name = buildNameSearchRegex(name);
  if (houseName) filter.houseName = new RegExp(escapeRegex(String(houseName)), 'i');
  if (ward) filter.ward = new RegExp(escapeRegex(String(ward)), 'i');
  if (newSecIdNo) filter.newSecIdNo = new RegExp(escapeRegex(String(newSecIdNo)), 'i');

  const sortMap = {
    name: { name: 1 },
    'name-desc': { name: -1 },
    age: { age: 1 },
    'age-desc': { age: -1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
  };

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [records, total] = await Promise.all([
    ResidentRecord.find(filter)
      .sort(sortMap[sort] || { name: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    ResidentRecord.countDocuments(filter),
  ]);

  const recordIds = records.map((record) => record._id);
  const passes = await ResidentPass.find({
    residentRecordId: { $in: recordIds },
  })
    .select('residentRecordId phone isActive')
    .sort({ isActive: -1, createdAt: -1 })
    .lean();

  const phoneByRecordId = new Map();
  for (const pass of passes) {
    const key = String(pass.residentRecordId);
    if (!phoneByRecordId.has(key)) {
      phoneByRecordId.set(key, pass.phone || null);
    }
  }

  return sendSuccess(res, {
    records: records.map((record) => ({
      ...record,
      phone: phoneByRecordId.get(String(record._id)) || null,
    })),
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

export const importResidents = asyncHandler(async (req, res) => {
  let data;

  if (req.file) {
    try {
      data = JSON.parse(req.file.buffer.toString('utf-8'));
    } catch {
      return sendError(res, 'Invalid JSON file', 400);
    }
  } else if (Array.isArray(req.body)) {
    data = req.body;
  } else if (req.body?.voters || req.body?.records) {
    data = req.body;
  } else {
    return sendError(res, 'JSON file with voters array required', 400);
  }

  const { importResidentsFromJson } = await import('../services/residentImportService.js');

  let summary;
  try {
    summary = await importResidentsFromJson(data);
  } catch (err) {
    return sendError(res, err.message || 'Invalid import format', 400);
  }

  const { logAudit } = await import('../services/auditService.js');
  await logAudit({
    performedBy: req.user._id,
    role: req.user.role,
    action: 'BULK_RESIDENT_IMPORT',
    targetType: 'ResidentRecord',
    metadata: summary,
  });

  return sendSuccess(res, { summary });
});

export const createResidentRecord = asyncHandler(async (req, res) => {
  const {
    name,
    guardianName,
    houseName,
    ward,
    age,
    gender,
    newSecIdNo,
    district,
    localBody,
    pollingStation,
  } = req.body;

  if (!name || !name.trim()) {
    return sendError(res, 'Name is required', 400);
  }

  const recordData = {
    name: name.trim(),
    guardianName: guardianName ? String(guardianName).trim() : undefined,
    houseName: houseName ? String(houseName).trim() : undefined,
    ward: ward ? String(ward).trim() : undefined,
    age: age !== undefined && age !== '' && age !== null ? Number(age) : undefined,
    gender: gender ? String(gender).trim() : undefined,
    district: district ? String(district).trim() : undefined,
    localBody: localBody ? String(localBody).trim() : undefined,
    pollingStation: pollingStation ? String(pollingStation).trim() : undefined,
  };

  if (newSecIdNo && String(newSecIdNo).trim()) {
    recordData.newSecIdNo = String(newSecIdNo).trim();
  }

  const record = await ResidentRecord.create(recordData);

  return sendSuccess(res, { record }, 201);
});

export const updateResidentRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return sendError(res, 'Invalid resident ID', 400);
  }

  const record = await ResidentRecord.findById(id);
  if (!record) {
    return sendError(res, 'Resident record not found', 404);
  }

  const {
    name,
    guardianName,
    houseName,
    ward,
    age,
    gender,
    newSecIdNo,
    district,
    localBody,
    pollingStation,
  } = req.body;

  if (name !== undefined) {
    if (!name || !String(name).trim()) {
      return sendError(res, 'Name is required', 400);
    }
    record.name = String(name).trim();
  }

  if (guardianName !== undefined) record.guardianName = guardianName ? String(guardianName).trim() : undefined;
  if (houseName !== undefined) record.houseName = houseName ? String(houseName).trim() : undefined;
  if (ward !== undefined) record.ward = ward ? String(ward).trim() : undefined;
  if (age !== undefined) record.age = age !== '' && age !== null ? Number(age) : undefined;
  if (gender !== undefined) record.gender = gender ? String(gender).trim() : undefined;
  if (district !== undefined) record.district = district ? String(district).trim() : undefined;
  if (localBody !== undefined) record.localBody = localBody ? String(localBody).trim() : undefined;
  if (pollingStation !== undefined) record.pollingStation = pollingStation ? String(pollingStation).trim() : undefined;
  if (newSecIdNo !== undefined) record.newSecIdNo = newSecIdNo ? String(newSecIdNo).trim() : undefined;

  await record.save();

  return sendSuccess(res, { record });
});

export const deleteResidentRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return sendError(res, 'Invalid resident ID', 400);
  }

  const record = await ResidentRecord.findByIdAndDelete(id);
  if (!record) {
    return sendError(res, 'Resident record not found', 404);
  }

  await ResidentPass.deleteMany({ residentRecordId: id });

  const { logAudit } = await import('../services/auditService.js');
  await logAudit({
    performedBy: req.user?._id,
    role: req.user?.role,
    action: 'DELETE_RESIDENT_RECORD',
    targetType: 'ResidentRecord',
    targetId: id,
    metadata: { name: record.name, ward: record.ward },
  });

  return sendSuccess(res, { message: 'Resident record deleted successfully' });
});

export const bulkDeleteResidentRecords = asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return sendError(res, 'Please provide an array of resident IDs to delete', 400);
  }

  const validIds = ids.filter((id) => isValidObjectId(id));
  if (validIds.length === 0) {
    return sendError(res, 'No valid resident IDs provided', 400);
  }

  const deleteResult = await ResidentRecord.deleteMany({ _id: { $in: validIds } });
  await ResidentPass.deleteMany({ residentRecordId: { $in: validIds } });

  const { logAudit } = await import('../services/auditService.js');
  await logAudit({
    performedBy: req.user?._id,
    role: req.user?.role,
    action: 'BULK_DELETE_RESIDENT_RECORDS',
    targetType: 'ResidentRecord',
    metadata: { count: deleteResult.deletedCount, requestedCount: ids.length },
  });

  return sendSuccess(res, {
    message: `Successfully deleted ${deleteResult.deletedCount} resident record(s)`,
    deletedCount: deleteResult.deletedCount,
  });
});

export const purgeAllResidentData = asyncHandler(async (req, res) => {
  const [deletedRecords, deletedPasses, deletedLogs, deletedUsers] = await Promise.all([
    ResidentRecord.deleteMany({}),
    ResidentPass.deleteMany({}),
    (async () => {
      try {
        const ResidentEntryLog = (await import('../models/ResidentEntryLog.js')).default;
        return await ResidentEntryLog.deleteMany({});
      } catch {
        return { deletedCount: 0 };
      }
    })(),
    (async () => {
      try {
        const User = (await import('../models/User.js')).default;
        // Strictly delete ONLY role: 'USER', NEVER ADMIN or MASTER_ADMIN
        return await User.deleteMany({ role: 'USER' });
      } catch {
        return { deletedCount: 0 };
      }
    })(),
  ]);

  const summary = {
    residentRecords: deletedRecords.deletedCount,
    residentPasses: deletedPasses.deletedCount,
    residentEntryLogs: deletedLogs.deletedCount,
    residentUsers: deletedUsers.deletedCount,
  };

  const { logAudit } = await import('../services/auditService.js');
  await logAudit({
    performedBy: req.user?._id,
    role: req.user?.role,
    action: 'PURGE_ALL_RESIDENT_DATA',
    targetType: 'ResidentRecord',
    metadata: summary,
  });

  return sendSuccess(res, {
    message: 'All resident records and registered resident data have been successfully deleted',
    summary,
  });
});

