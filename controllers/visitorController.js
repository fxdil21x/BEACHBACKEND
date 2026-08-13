import VisitorEntry from '../models/VisitorEntry.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/index.js';
import { generateQrToken } from '../utils/generateQrToken.js';
import {
  addAdminVisitorEntryClient,
  addVisitorEntryStatusClient,
  notifyVisitorEntryPending,
  notifyVisitorEntryReviewed,
  writeSseHeaders,
} from '../services/visitorEntryEvents.js';

const recentSubmissions = new Map();
const COOLDOWN_MS = 30000;

export const getBeachInstructions = asyncHandler(async (_req, res) => {
  return sendSuccess(res, {
    instructions: [
      { key: 'instruction.noLitter', category: 'cleanliness' },
      { key: 'instruction.useBins', category: 'cleanliness' },
      { key: 'instruction.keepClean', category: 'cleanliness' },
      { key: 'instruction.noNoise', category: 'safety' },
      { key: 'instruction.driveSafe', category: 'safety' },
      { key: 'instruction.respectVisitors', category: 'safety' },
      { key: 'instruction.followSecurity', category: 'safety' },
    ],
    entryFeePerPerson: 20,
    paymentMethod: 'OFFLINE',
  });
});

export const createVisitorEntry = asyncHandler(async (req, res) => {
  const { visitorCount, idempotencyKey } = req.body;

  const count = Number(visitorCount);
  if (!count || count < 1 || !Number.isInteger(count)) {
    return sendError(res, 'Visitor count must be a positive integer', 400);
  }

  if (idempotencyKey) {
    const existing = await VisitorEntry.findOne({ idempotencyKey });
    if (existing) {
      return sendSuccess(res, {
        entry: existing,
        duplicate: true,
        totalAmount: existing.visitorCount * existing.entryFeePerPerson,
      });
    }
  }

  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  const cooldownKey = `${clientIp}:${idempotencyKey || 'none'}`;
  const lastSubmit = recentSubmissions.get(cooldownKey);
  if (lastSubmit && Date.now() - lastSubmit < COOLDOWN_MS) {
    return sendError(res, 'Please wait before submitting again', 429);
  }

  const entry = await VisitorEntry.create({
    visitorCount: count,
    source: 'PUBLIC_QR',
    entryFeePerPerson: 20,
    paymentMethod: 'OFFLINE',
    idempotencyKey: idempotencyKey || null,
    status: 'PENDING',
  });

  recentSubmissions.set(cooldownKey, Date.now());
  notifyVisitorEntryPending(entry.toObject());

  return sendSuccess(res, {
    entry,
    totalAmount: count * 20,
    timestamp: entry.createdAt,
  }, 201);
});

export const getVisitorEntries = asyncHandler(async (req, res) => {
  const { page = 1, limit = 25 } = req.query;
  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [entries, total] = await Promise.all([
    VisitorEntry.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    VisitorEntry.countDocuments(),
  ]);

  return sendSuccess(res, {
    entries,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

export const getVisitorEntryStatus = asyncHandler(async (req, res) => {
  const entry = await VisitorEntry.findById(req.params.id).lean();
  if (!entry) {
    return sendError(res, 'Entry not found', 404);
  }

  return sendSuccess(res, {
    entry: {
      id: entry._id,
      visitorCount: entry.visitorCount,
      entryFeePerPerson: entry.entryFeePerPerson,
      totalAmount: entry.visitorCount * entry.entryFeePerPerson,
      status: entry.status || 'APPROVED',
      qrToken: entry.qrToken,
      createdAt: entry.createdAt,
      reviewedAt: entry.reviewedAt,
    },
  });
});

export const getPendingVisitorEntries = asyncHandler(async (_req, res) => {
  const entries = await VisitorEntry.find({ status: 'PENDING' })
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();

  return sendSuccess(res, { entries });
});

export const streamPendingVisitorEntries = asyncHandler(async (req, res) => {
  writeSseHeaders(res);

  const entries = await VisitorEntry.find({ status: 'PENDING' })
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();

  res.write(`data: ${JSON.stringify({ type: 'pending-list', entries })}\n\n`);
  const removeClient = addAdminVisitorEntryClient(res);
  req.on('close', removeClient);
});

export const streamVisitorEntryStatus = asyncHandler(async (req, res) => {
  const entry = await VisitorEntry.findById(req.params.id).lean();
  if (!entry) {
    return sendError(res, 'Entry not found', 404);
  }

  writeSseHeaders(res);
  res.write(`data: ${JSON.stringify({ type: 'entry-status', entry })}\n\n`);

  const removeClient = addVisitorEntryStatusClient(req.params.id, res);
  req.on('close', removeClient);
});

export const reviewVisitorEntry = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return sendError(res, 'Status must be APPROVED or REJECTED', 400);
  }

  const entry = await VisitorEntry.findById(req.params.id);
  if (!entry) {
    return sendError(res, 'Entry not found', 404);
  }

  if (entry.status !== 'PENDING') {
    return sendError(res, 'Entry already reviewed', 409);
  }

  entry.status = status;
  entry.reviewedBy = req.user._id;
  entry.reviewedAt = new Date();
  if (status === 'APPROVED') {
    entry.qrToken = entry.qrToken || `VISITOR:${generateQrToken()}`;
  }

  await entry.save();
  notifyVisitorEntryReviewed(entry.toObject());

  return sendSuccess(res, { entry });
});
