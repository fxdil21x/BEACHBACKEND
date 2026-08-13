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
