import ResidentPass from '../models/ResidentPass.js';
import ResidentRecord from '../models/ResidentRecord.js';
import ResidentEntryLog from '../models/ResidentEntryLog.js';
import BeachReport from '../models/BeachReport.js';
import VisitorEntry from '../models/VisitorEntry.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/index.js';
import { parseQrScan } from '../services/qrService.js';
import { buildNameSearchRegex, escapeRegex, isValidObjectId } from '../utils/validators.js';
import { logAudit } from '../services/auditService.js';
import { notifyReportStatusUpdated, addAdminReportClient, writeSseHeaders } from '../services/reportEvents.js';

function getPhoneLast4(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? digits.slice(-4) : null;
}

function formatAdminPass(pass) {
  const record = pass.residentRecordId;
  return {
    id: pass._id,
    phoneLast4: getPhoneLast4(pass.phone),
    photoUrl: pass.photoUrl,
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

function formatScannedResident(pass) {
  const record = pass.residentRecordId;
  return {
    photoUrl: pass.photoUrl,
    phoneLast4: getPhoneLast4(pass.phone),
    name: record?.name,
    age: record?.age,
    houseName: record?.houseName,
    guardianName: record?.guardianName,
    ward: record?.ward,
    gender: record?.gender,
  };
}

async function scanVisitorEntry(qrToken, adminUser) {
  const entry = await VisitorEntry.findOne({ qrToken });

  if (!entry) {
    return {
      valid: false,
      status: 'DENIED',
      reason: 'Invalid visitor QR',
    };
  }

  if (entry.status === 'PENDING') {
    return {
      valid: false,
      status: 'DENIED',
      reason: 'Visitor entry is still pending approval',
    };
  }

  if (entry.status === 'REJECTED') {
    return {
      valid: false,
      status: 'DENIED',
      reason: 'Visitor entry was rejected',
    };
  }

  if (entry.scannedAt) {
    return {
      valid: false,
      status: 'DENIED',
      reason: `Visitor QR already used at ${entry.scannedAt.toLocaleString()}`,
      visitorEntry: {
        id: entry._id,
        visitorCount: entry.visitorCount,
        totalAmount: entry.visitorCount * entry.entryFeePerPerson,
        scannedAt: entry.scannedAt,
      },
    };
  }

  const scannedAt = new Date();
  const scannedEntry = await VisitorEntry.findOneAndUpdate(
    { _id: entry._id, scannedAt: { $exists: false } },
    { $set: { scannedBy: adminUser._id, scannedAt } },
    { new: true }
  );

  if (!scannedEntry) {
    const latestEntry = await VisitorEntry.findById(entry._id).lean();
    return {
      valid: false,
      status: 'DENIED',
      reason: `Visitor QR already used at ${new Date(latestEntry.scannedAt).toLocaleString()}`,
      visitorEntry: {
        id: latestEntry._id,
        visitorCount: latestEntry.visitorCount,
        totalAmount: latestEntry.visitorCount * latestEntry.entryFeePerPerson,
        scannedAt: latestEntry.scannedAt,
      },
    };
  }

  await logAudit({
    performedBy: adminUser._id,
    role: adminUser.role,
    action: 'VISITOR_QR_SCAN',
    targetType: 'VisitorEntry',
    targetId: entry._id,
  });

  return {
    valid: true,
    status: 'GRANTED',
    type: 'VISITOR',
    message: 'VISITOR ENTRY VERIFIED - PERMISSION GRANTED',
    visitorEntry: {
      id: scannedEntry._id,
      visitorCount: scannedEntry.visitorCount,
      entryFeePerPerson: scannedEntry.entryFeePerPerson,
      totalAmount: scannedEntry.visitorCount * scannedEntry.entryFeePerPerson,
      createdAt: scannedEntry.createdAt,
      scannedAt: scannedEntry.scannedAt,
    },
  };
}

export const scanResident = asyncHandler(async (req, res) => {
  const { qrToken: rawToken } = req.body;
  const qrToken = parseQrScan(rawToken);

  if (!qrToken) {
    return sendError(res, 'QR token is required', 400);
  }

  if (qrToken.startsWith('VISITOR:')) {
    const result = await scanVisitorEntry(qrToken, req.user);
    return sendSuccess(res, result);
  }

  const pass = await ResidentPass.findOne({ qrToken }).populate(
    'residentRecordId',
    'name guardianName houseName ward age gender'
  );

  if (!pass) {
    return sendSuccess(res, {
      valid: false,
      status: 'DENIED',
      reason: 'Invalid pass',
    });
  }

  if (!pass.isActive) {
    return sendSuccess(res, {
      valid: false,
      status: 'DENIED',
      reason: 'Pass is disabled',
      resident: formatScannedResident(pass),
    });
  }

  if (!pass.residentRecordId) {
    return sendSuccess(res, {
      valid: false,
      status: 'DENIED',
      reason: 'Resident record not found',
    });
  }

  const entryLog = await ResidentEntryLog.create({
    residentPassId: pass._id,
    residentRecordId: pass.residentRecordId._id,
    entryType: 'FREE',
    checkedBy: req.user._id,
    checkedAt: new Date(),
  });

  await logAudit({
    performedBy: req.user._id,
    role: req.user.role,
    action: 'RESIDENT_QR_SCAN',
    targetType: 'ResidentPass',
    targetId: pass._id,
    metadata: { entryLogId: entryLog._id },
  });

  return sendSuccess(res, {
    valid: true,
    status: 'GRANTED',
    message: 'VERIFIED RESIDENT - PERMISSION GRANTED - FREE ENTRY',
    resident: formatScannedResident(pass),
    entryLog: {
      id: entryLog._id,
      checkedAt: entryLog.checkedAt,
    },
  });
});

export const getAdminResidents = asyncHandler(async (req, res) => {
  const { name, phone, houseName, page = 1, limit = 20 } = req.query;
  const pageNumber = Math.max(1, Number(page));
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  if (phone) {
    const filter = { phone: new RegExp(String(phone).replace(/\s/g, ''), 'i') };

    let passes = await ResidentPass.find(filter)
      .populate('residentRecordId', 'name guardianName houseName ward age gender')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    if (name) {
      const nameRegex = buildNameSearchRegex(name);
      passes = passes.filter((p) => p.residentRecordId && nameRegex.test(p.residentRecordId.name));
    }
    if (houseName) {
      const houseRegex = new RegExp(escapeRegex(String(houseName)), 'i');
      passes = passes.filter((p) => p.residentRecordId && houseRegex.test(p.residentRecordId.houseName));
    }

    const total = await ResidentPass.countDocuments(filter);

    return sendSuccess(res, {
      residents: passes.map((p) => ({
        id: p._id,
        residentRecordId: p.residentRecordId?._id,
        phoneLast4: getPhoneLast4(p.phone),
        photoUrl: p.photoUrl,
        isActive: p.isActive,
        isRegistered: true,
        name: p.residentRecordId?.name,
        guardianName: p.residentRecordId?.guardianName,
        houseName: p.residentRecordId?.houseName,
        ward: p.residentRecordId?.ward,
        age: p.residentRecordId?.age,
        gender: p.residentRecordId?.gender,
      })),
      pagination: { page: pageNumber, limit: limitNumber, total, pages: Math.ceil(total / limitNumber) },
    });
  }

  const filter = {};
  if (name) filter.name = buildNameSearchRegex(name);
  if (houseName) filter.houseName = new RegExp(escapeRegex(String(houseName)), 'i');

  const [records, total] = await Promise.all([
    ResidentRecord.find(filter).sort({ name: 1 }).skip(skip).limit(limitNumber).lean(),
    ResidentRecord.countDocuments(filter),
  ]);

  const recordIds = records.map((record) => record._id);
  const passes = await ResidentPass.find({ residentRecordId: { $in: recordIds } }).lean();
  const passByRecordId = new Map(passes.map((pass) => [String(pass.residentRecordId), pass]));

  return sendSuccess(res, {
    residents: records.map((record) => {
      const pass = passByRecordId.get(String(record._id));
      return {
        id: pass?._id || record._id,
        residentRecordId: record._id,
        phoneLast4: pass ? getPhoneLast4(pass.phone) : null,
        photoUrl: pass?.photoUrl || null,
        isActive: pass?.isActive ?? null,
        isRegistered: Boolean(pass),
        name: record.name,
        guardianName: record.guardianName,
        houseName: record.houseName,
        ward: record.ward,
        age: record.age,
        gender: record.gender,
      };
    }),
    pagination: { page: pageNumber, limit: limitNumber, total, pages: Math.ceil(total / limitNumber) },
  });
});

export const getAdminResidentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return sendError(res, 'Invalid ID', 400);
  }

  const pass = await ResidentPass.findById(id).populate(
    'residentRecordId',
    'name guardianName houseName ward age gender'
  );

  if (!pass) {
    return sendError(res, 'Registered resident not found', 404);
  }

  return sendSuccess(res, { resident: formatAdminPass(pass) });
});

export const getEntryLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    ResidentEntryLog.find()
      .sort({ checkedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('residentRecordId', 'name houseName ward')
      .populate('checkedBy', 'name username')
      .populate('residentPassId', 'phone photoUrl')
      .lean(),
    ResidentEntryLog.countDocuments(),
  ]);

  return sendSuccess(res, {
    logs,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

export const getAdminEntryLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const filter = req.user.role === 'ADMIN' ? { checkedBy: req.user._id } : {};

  const [logs, total] = await Promise.all([
    ResidentEntryLog.find(filter)
      .sort({ checkedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('residentRecordId', 'name houseName ward')
      .populate('checkedBy', 'name username')
      .lean(),
    ResidentEntryLog.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    logs,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

export const getBeachReports = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [reports, total] = await Promise.all([
    BeachReport.find(filter)
      .populate('submittedBy', 'name username role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    BeachReport.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    reports,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

export const updateBeachReportStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!isValidObjectId(id)) {
    return sendError(res, 'Invalid report ID', 400);
  }

  const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
  if (!validStatuses.includes(status)) {
    return sendError(res, 'Invalid status', 400);
  }

  const report = await BeachReport.findByIdAndUpdate(id, { status }, { new: true })
    .populate('submittedBy', 'name username role');
  if (!report) {
    return sendError(res, 'Report not found', 404);
  }

  await logAudit({
    performedBy: req.user._id,
    role: req.user.role,
    action: 'REPORT_STATUS_CHANGED',
    targetType: 'BeachReport',
    targetId: report._id,
    metadata: { status },
  });

  notifyReportStatusUpdated(report);

  return sendSuccess(res, { report });
});

export const streamAdminReportEvents = asyncHandler(async (req, res) => {
  writeSseHeaders(res);
  const cleanup = addAdminReportClient(res);
  req.on('close', cleanup);
});

