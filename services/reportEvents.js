import { writeSseHeaders } from './visitorEntryEvents.js';

const adminClients = new Set();
const userClients = new Map(); // userId string -> Set of res

function writeEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function addAdminReportClient(res) {
  adminClients.add(res);
  return () => adminClients.delete(res);
}

export function addUserReportClient(userId, res) {
  const key = String(userId);
  if (!userClients.has(key)) userClients.set(key, new Set());
  userClients.get(key).add(res);

  return () => {
    const clients = userClients.get(key);
    if (!clients) return;
    clients.delete(res);
    if (clients.size === 0) userClients.delete(key);
  };
}

export function notifyNewReport(report) {
  const payload = { type: 'new-report', report };
  adminClients.forEach((client) => writeEvent(client, payload));
}

export function notifyReportStatusUpdated(report) {
  const payload = { type: 'report-status-updated', report };
  
  // Notify all admin clients
  adminClients.forEach((client) => writeEvent(client, payload));

  // Notify specific reporting user if authenticated
  if (report.submittedBy) {
    const userId = typeof report.submittedBy === 'object' ? report.submittedBy._id : report.submittedBy;
    const key = String(userId);
    userClients.get(key)?.forEach((client) => writeEvent(client, payload));
  }
}

export { writeSseHeaders };
