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
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const yesterdayStart = daysAgo(1);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = daysAgo(1);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const [
    visitorToday,
    visitorYesterday,
    residentEntriesToday,
    residentEntriesYesterday,
    totalRegisteredResidents,
    totalUsers,
    totalAdmins,
    newRegistrationsToday,
    openReports,
    totalReports,
    resolvedReports,
    passesWithPhoto,
    recentResidentLogs,
    recentVisitorLogs,
    recentReports,
    auditActivities,
  ] = await Promise.all([
    VisitorEntry.aggregate([
      { $match: approvedVisitorMatch({ createdAt: { $gte: todayStart, $lte: todayEnd } }) },
      { $group: { _id: null, total: { $sum: '$visitorCount' } } },
    ]),
    VisitorEntry.aggregate([
      { $match: approvedVisitorMatch({ createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } }) },
      { $group: { _id: null, total: { $sum: '$visitorCount' } } },
    ]),
    ResidentEntryLog.countDocuments({ checkedAt: { $gte: todayStart, $lte: todayEnd } }),
    ResidentEntryLog.countDocuments({ checkedAt: { $gte: yesterdayStart, $lte: yesterdayEnd } }),
    ResidentPass.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'USER' }),
    User.countDocuments({ role: 'ADMIN' }),
    ResidentPass.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
    BeachReport.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
    BeachReport.countDocuments(),
    BeachReport.countDocuments({ status: 'RESOLVED' }),
    ResidentPass.countDocuments({ photoUrl: { $ne: null } }),
    ResidentEntryLog.find().sort({ checkedAt: -1 }).limit(5).populate({
      path: 'residentPassId',
      populate: { path: 'userId', select: 'name username' },
    }),
    VisitorEntry.find().sort({ createdAt: -1 }).limit(5),
    BeachReport.find().sort({ createdAt: -1 }).limit(5),
    AuditLog.find().sort({ createdAt: -1 }).limit(5).populate('performedBy', 'name username role'),
  ]);

  const generalVisitorsToday = visitorToday[0]?.total || 0;
  const generalVisitorsYesterday = visitorYesterday[0]?.total || 0;
  const totalEntriesToday = generalVisitorsToday + residentEntriesToday;
  const totalEntriesYesterday = generalVisitorsYesterday + residentEntriesYesterday;

  // Real Monthly Overview for Current Year (Jan - Dec)
  const currentYear = now.getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

  const [monthlyVisitors, monthlyResidents] = await Promise.all([
    VisitorEntry.aggregate([
      { $match: approvedVisitorMatch({ createdAt: { $gte: yearStart, $lte: yearEnd } }) },
      {
        $group: {
          _id: { $month: '$createdAt' },
          total: { $sum: '$visitorCount' },
        },
      },
    ]),
    ResidentEntryLog.aggregate([
      { $match: { checkedAt: { $gte: yearStart, $lte: yearEnd } } },
      {
        $group: {
          _id: { $month: '$checkedAt' },
          total: { $sum: 1 },
        },
      },
    ]),
  ]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthVisitorMap = {};
  monthlyVisitors.forEach((m) => {
    monthVisitorMap[m._id] = m.total;
  });
  const monthResidentMap = {};
  monthlyResidents.forEach((m) => {
    monthResidentMap[m._id] = m.total;
  });

  const monthlyData = monthNames.map((name, index) => {
    const monthNum = index + 1;
    const isCurrentMonth = index === now.getMonth();
    const actualRes = monthResidentMap[monthNum] || 0;
    const actualVis = monthVisitorMap[monthNum] || 0;
    const actualTotal = actualRes + actualVis;

    return {
      month: name,
      monthIndex: index,
      residents: actualRes,
      visitors: actualVis,
      value: actualTotal,
      isCurrent: isCurrentMonth,
    };
  });

  // Identify peak month
  let peakIdx = now.getMonth();
  let maxVal = -1;
  monthlyData.forEach((item, idx) => {
    if (item.value > maxVal) {
      maxVal = item.value;
      peakIdx = idx;
    }
  });
  if (monthlyData[peakIdx]) {
    monthlyData[peakIdx].isPeak = true;
  }

  // Real 7-day sparkline history for each metric from database
  const dayIntervals = [];
  for (let i = 6; i >= 0; i--) {
    const dStart = daysAgo(i);
    dStart.setHours(0, 0, 0, 0);
    const dEnd = daysAgo(i);
    dEnd.setHours(23, 59, 59, 999);
    dayIntervals.push({ start: dStart, end: dEnd, label: dStart.toLocaleDateString(undefined, { weekday: 'short' }) });
  }

  const [dailyVisAgg, dailyResAgg] = await Promise.all([
    VisitorEntry.aggregate([
      { $match: approvedVisitorMatch({ createdAt: { $gte: dayIntervals[0].start, $lte: dayIntervals[6].end } }) },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$visitorCount' },
        },
      },
    ]),
    ResidentEntryLog.aggregate([
      { $match: { checkedAt: { $gte: dayIntervals[0].start, $lte: dayIntervals[6].end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$checkedAt' } },
          total: { $sum: 1 },
        },
      },
    ]),
  ]);

  const dailyVisMap = {};
  dailyVisAgg.forEach((v) => { dailyVisMap[v._id] = v.total; });
  const dailyResMap = {};
  dailyResAgg.forEach((r) => { dailyResMap[r._id] = r.total; });

  const totalEntriesSpark = [];
  const residentSpark = [];
  const visitorSpark = [];
  const verifiedSpark = [];

  dayIntervals.forEach((interval) => {
    const key = interval.start.toISOString().split('T')[0];
    const vCount = dailyVisMap[key] || 0;
    const rCount = dailyResMap[key] || 0;
    visitorSpark.push(vCount);
    residentSpark.push(rCount);
    totalEntriesSpark.push(vCount + rCount);
    verifiedSpark.push(totalRegisteredResidents);
  });

  // Calculate real trends
  const entriesDiff = totalEntriesToday - totalEntriesYesterday;
  const entriesTrendPct = totalEntriesYesterday > 0
    ? Math.round(((totalEntriesToday - totalEntriesYesterday) / totalEntriesYesterday) * 100)
    : (totalEntriesToday > 0 ? 100 : 0);

  const resDiff = residentEntriesToday - residentEntriesYesterday;
  const resTrendPct = residentEntriesYesterday > 0
    ? Math.round(((residentEntriesToday - residentEntriesYesterday) / residentEntriesYesterday) * 100)
    : (residentEntriesToday > 0 ? 100 : 0);

  const visDiff = generalVisitorsToday - generalVisitorsYesterday;
  const visTrendPct = generalVisitorsYesterday > 0
    ? Math.round(((generalVisitorsToday - generalVisitorsYesterday) / generalVisitorsYesterday) * 100)
    : (generalVisitorsToday > 0 ? 100 : 0);

  // Operations Breakdown with real database counts
  const residentPassCount = totalRegisteredResidents;
  const visitorEntriesCount = generalVisitorsToday;
  const residentEntriesCount = residentEntriesToday;
  const reportsCount = totalReports;
  const systemUsersCount = totalUsers + totalAdmins;

  const totalOps = residentPassCount + visitorEntriesCount + residentEntriesCount + reportsCount + systemUsersCount;

  const breakdown = [
    {
      name: 'Resident Pass Entries',
      count: residentEntriesCount,
      percent: totalOps > 0 ? Math.round((residentEntriesCount / totalOps) * 100) : 0,
      color: '#F97316', // Primary Orange
    },
    {
      name: 'General Visitor Entries',
      count: visitorEntriesCount,
      percent: totalOps > 0 ? Math.round((visitorEntriesCount / totalOps) * 100) : 0,
      color: '#FB923C', // Amber Orange
    },
    {
      name: 'Registered Residents',
      count: residentPassCount,
      percent: totalOps > 0 ? Math.round((residentPassCount / totalOps) * 100) : 0,
      color: '#F59E0B', // Warm Yellow
    },
    {
      name: 'Beach Incident Reports',
      count: reportsCount,
      percent: totalOps > 0 ? Math.round((reportsCount / totalOps) * 100) : 0,
      color: '#C2410C', // Deep Bronze
    },
    {
      name: 'Admins & Staff Accounts',
      count: systemUsersCount,
      percent: totalOps > 0 ? Math.round((systemUsersCount / totalOps) * 100) : 0,
      color: '#78350F', // Dark Bronze
    },
  ];

  // Flow Trend from real 7-day or hourly data
  const flowTrend = dayIntervals.map((d, i) => ({
    label: d.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value: totalEntriesSpark[i] || 0,
    isPeak: totalEntriesSpark[i] === Math.max(...totalEntriesSpark),
  }));

  // Real-time Operational Goals
  const photoVerificationRate = totalRegisteredResidents > 0
    ? Math.round((passesWithPhoto / totalRegisteredResidents) * 100)
    : 0;

  const resolutionRate = totalReports > 0
    ? Math.round((resolvedReports / totalReports) * 100)
    : 100;

  const activePassRate = totalRegisteredResidents > 0
    ? 100
    : 0;

  const currentAnnualTotal = monthlyData.reduce((acc, curr) => acc + curr.value, 0);

  const goals = [
    {
      id: 'photo_verification',
      title: 'Resident Photo Verification Rate',
      current: passesWithPhoto,
      target: totalRegisteredResidents,
      formattedCurrent: String(passesWithPhoto),
      formattedTarget: String(totalRegisteredResidents),
      percent: photoVerificationRate,
      icon: 'CreditCard',
      color: 'orange',
    },
    {
      id: 'report_resolution',
      title: 'Incident Report Resolution Rate',
      current: resolvedReports,
      target: totalReports,
      formattedCurrent: String(resolvedReports),
      formattedTarget: String(totalReports),
      percent: resolutionRate,
      icon: 'TrendingUp',
      color: 'emerald',
    },
    {
      id: 'active_passes',
      title: 'Active Resident Pass Compliance',
      current: totalRegisteredResidents,
      target: totalRegisteredResidents,
      formattedCurrent: String(totalRegisteredResidents),
      formattedTarget: String(totalRegisteredResidents),
      percent: activePassRate,
      icon: 'Target',
      color: 'amber',
    },
  ];

  // Combined Real Live Activity
  const liveActivity = [];

  // Recent resident scans
  recentResidentLogs.forEach((item) => {
    liveActivity.push({
      id: `res-${item._id}`,
      type: 'resident_entry',
      title: item.residentPassId?.userId?.name
        ? `${item.residentPassId.userId.name} (Resident Pass)`
        : 'Resident Pass Check-in',
      subtitle: new Date(item.checkedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      timestamp: item.checkedAt,
      tag: '+1 Entry',
      tagType: 'success',
      status: 'Completed',
      icon: 'BadgeCheck',
      accent: 'emerald',
    });
  });

  // Recent visitor entries
  recentVisitorLogs.forEach((item) => {
    liveActivity.push({
      id: `vis-${item._id}`,
      type: 'visitor_entry',
      title: `Visitor Group (${item.visitorCount} ${item.visitorCount === 1 ? 'guest' : 'guests'})`,
      subtitle: new Date(item.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      timestamp: item.createdAt,
      tag: `+${item.visitorCount} Visitors`,
      tagType: item.status === 'APPROVED' ? 'success' : 'warning',
      status: item.status === 'APPROVED' ? 'Completed' : item.status || 'Pending',
      icon: 'Ticket',
      accent: 'violet',
    });
  });

  // Recent beach reports
  recentReports.forEach((item) => {
    liveActivity.push({
      id: `rep-${item._id}`,
      type: 'beach_report',
      title: `${item.category}: ${item.description ? item.description.slice(0, 24) + '...' : 'Incident Report'}`,
      subtitle: new Date(item.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      timestamp: item.createdAt,
      tag: item.status === 'RESOLVED' ? 'Resolved' : 'Report',
      tagType: item.status === 'RESOLVED' ? 'success' : 'danger',
      status: item.status === 'RESOLVED' ? 'Completed' : 'Open',
      icon: 'TriangleAlert',
      accent: 'amber',
    });
  });

  // Recent Audit Logs
  auditActivities.forEach((item) => {
    liveActivity.push({
      id: `aud-${item._id}`,
      type: 'audit_log',
      title: item.action?.replace(/_/g, ' ') || 'System Action',
      subtitle: new Date(item.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      timestamp: item.createdAt,
      tag: item.role || 'Admin',
      tagType: 'success',
      status: 'Logged',
      icon: 'Shield',
      accent: 'orange',
    });
  });

  // Sort by latest timestamp
  liveActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return {
    totalEntriesToday,
    totalEntriesYesterday,
    generalVisitorsToday,
    residentFreeEntriesToday: residentEntriesToday,
    totalRegisteredResidents,
    totalUsers,
    totalAdmins,
    newResidentRegistrations: newRegistrationsToday,
    beachReports: openReports,
    recentActivity: auditActivities,
    liveActivity: liveActivity.slice(0, 5),
    monthlyOverview: monthlyData,
    weeklyOverview: weeklyData,
    annualTotal: currentAnnualTotal,
    breakdown,
    totalOps,
    flowTrend,
    goals,
    sparklines: {
      totalEntries: totalEntriesSpark,
      residentEntries: residentSpark,
      visitorEntries: visitorSpark,
      registeredResidents: verifiedSpark,
    },
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

