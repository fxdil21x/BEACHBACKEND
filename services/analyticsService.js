import ResidentEntryLog from '../models/ResidentEntryLog.js';
import VisitorEntry from '../models/VisitorEntry.js';
import ResidentPass from '../models/ResidentPass.js';
import User from '../models/User.js';
import BeachReport from '../models/BeachReport.js';
import AuditLog from '../models/AuditLog.js';

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function approvedVisitorMatch(match = {}) {
  return {
    ...match,
    $or: [{ status: 'APPROVED' }, { status: { $exists: false } }],
  };
}

export async function getDashboardMetrics() {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  const [
    visitorToday,
    residentEntriesToday,
    totalRegisteredResidents,
    totalUsers,
    totalAdmins,
    newRegistrationsToday,
    openReports,
    recentActivity,
  ] = await Promise.all([
    VisitorEntry.aggregate([
      { $match: approvedVisitorMatch({ createdAt: { $gte: todayStart, $lte: todayEnd } }) },
      { $group: { _id: null, total: { $sum: '$visitorCount' } } },
    ]),
    ResidentEntryLog.countDocuments({ checkedAt: { $gte: todayStart, $lte: todayEnd } }),
    ResidentPass.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'USER' }),
    User.countDocuments({ role: 'ADMIN' }),
    ResidentPass.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
    BeachReport.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
    AuditLog.find().sort({ createdAt: -1 }).limit(10).populate('performedBy', 'name username role'),
  ]);

  const generalVisitorsToday = visitorToday[0]?.total || 0;
  const totalEntriesToday = generalVisitorsToday + residentEntriesToday;

  return {
    totalEntriesToday,
    generalVisitorsToday,
    residentFreeEntriesToday: residentEntriesToday,
    totalRegisteredResidents,
    totalUsers,
    totalAdmins,
    newResidentRegistrations: newRegistrationsToday,
    beachReports: openReports,
    recentActivity,
  };
}

export async function getAnalytics() {
  const now = new Date();
  const todayStart = startOfDay();
  const weekStart = daysAgo(7);
  const monthStart = daysAgo(30);

  const [visitorStats, residentStats, peakTimes] = await Promise.all([
    getVisitorStats(todayStart, weekStart, monthStart, now),
    getResidentStats(todayStart, weekStart, monthStart, now),
    getPeakEntryTimes(monthStart, now),
  ]);

  return {
    visitors: visitorStats,
    residents: residentStats,
    peakEntryTimes: peakTimes,
  };
}

async function getVisitorStats(todayStart, weekStart, monthStart, now) {
  const [today, week, month] = await Promise.all([
    sumVisitorCount({ createdAt: { $gte: todayStart, $lte: now } }),
    sumVisitorCount({ createdAt: { $gte: weekStart, $lte: now } }),
    sumVisitorCount({ createdAt: { $gte: monthStart, $lte: now } }),
  ]);
  return { today, week, month };
}

async function sumVisitorCount(match) {
  const result = await VisitorEntry.aggregate([
    { $match: approvedVisitorMatch(match) },
    { $group: { _id: null, total: { $sum: '$visitorCount' } } },
  ]);
  return result[0]?.total || 0;
}

async function getResidentStats(todayStart, weekStart, monthStart, now) {
  const [today, week, month, totalRegistered, withPhotos, withoutPhotos, activePasses] = await Promise.all([
    ResidentEntryLog.countDocuments({ checkedAt: { $gte: todayStart, $lte: now } }),
    ResidentEntryLog.countDocuments({ checkedAt: { $gte: weekStart, $lte: now } }),
    ResidentEntryLog.countDocuments({ checkedAt: { $gte: monthStart, $lte: now } }),
    ResidentPass.countDocuments(),
    ResidentPass.countDocuments({ photoUrl: { $ne: null } }),
    ResidentPass.countDocuments({ $or: [{ photoUrl: null }, { photoUrl: '' }] }),
    ResidentPass.countDocuments({ isActive: true }),
  ]);

  return { today, week, month, totalRegistered, withPhotos, withoutPhotos, activePasses };
}

async function getPeakEntryTimes(from, to) {
  const [visitorPeaks, residentPeaks] = await Promise.all([
    VisitorEntry.aggregate([
      { $match: approvedVisitorMatch({ createdAt: { $gte: from, $lte: to } }) },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: '$visitorCount' } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    ResidentEntryLog.aggregate([
      { $match: { checkedAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $hour: '$checkedAt' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  return { visitors: visitorPeaks, residents: residentPeaks };
}

export { startOfDay, endOfDay, daysAgo };
