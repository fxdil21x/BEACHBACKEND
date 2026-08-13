import BeachReport from '../models/BeachReport.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/index.js';
import { processAndUploadPhoto } from '../services/imageService.js';

const VALID_CATEGORIES = [
  'Garbage', 'Overflowing Bin', 'Unsafe Driving', 'Damaged Facility',
  'Noise Problem', 'Safety Issue', 'Other',
];

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseDeviceInfo(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      userAgent: parsed.userAgent ? String(parsed.userAgent).slice(0, 500) : null,
      platform: parsed.platform ? String(parsed.platform).slice(0, 120) : null,
      language: parsed.language ? String(parsed.language).slice(0, 40) : null,
      vendor: parsed.vendor ? String(parsed.vendor).slice(0, 120) : null,
      screenWidth: parseNumber(parsed.screenWidth),
      screenHeight: parseNumber(parsed.screenHeight),
      timezone: parsed.timezone ? String(parsed.timezone).slice(0, 80) : null,
    };
  } catch {
    return null;
  }
}

export const createReport = asyncHandler(async (req, res) => {
  const { category, description, forceAnonymous } = req.body;

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return sendError(res, 'Valid category is required', 400);
  }

  const trimmedDescription = String(description || '').trim();
  const hasPhoto = Boolean(req.file);

  if (!trimmedDescription && !hasPhoto) {
    return sendError(res, 'Photo or description is required', 400);
  }

  let photoUrl = null;
  let photoPublicId = null;

  if (req.file) {
    try {
      const uploaded = await processAndUploadPhoto(req.file.buffer, 'beach-reports');
      photoUrl = uploaded.photoUrl;
      photoPublicId = uploaded.photoPublicId;
    } catch (err) {
      return sendError(res, err.message || 'Photo upload failed', 500);
    }
  }

  const latitude = parseNumber(req.body.latitude);
  const longitude = parseNumber(req.body.longitude);
  const accuracy = parseNumber(req.body.accuracy);
  const deviceInfo = parseDeviceInfo(req.body.deviceInfo);
  const anonymous = forceAnonymous === true || forceAnonymous === 'true' || !req.user;

  const report = await BeachReport.create({
    category,
    description: trimmedDescription,
    photoUrl,
    photoPublicId,
    submittedBy: anonymous ? null : req.user?._id || null,
    isAnonymous: anonymous,
    location: {
      latitude,
      longitude,
      accuracy,
      capturedAt: latitude != null && longitude != null ? new Date() : null,
    },
    deviceInfo: deviceInfo || undefined,
  });

  return sendSuccess(res, { report }, 201);
});

export const getReportsMaster = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [reports, total] = await Promise.all([
    BeachReport.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    BeachReport.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    reports,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});
