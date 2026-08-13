const adminClients = new Set();
const entryClients = new Map();

function writeEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function addAdminVisitorEntryClient(res) {
  adminClients.add(res);
  return () => adminClients.delete(res);
}

export function addVisitorEntryStatusClient(entryId, res) {
  const key = String(entryId);
  if (!entryClients.has(key)) entryClients.set(key, new Set());
  entryClients.get(key).add(res);

  return () => {
    const clients = entryClients.get(key);
    if (!clients) return;
    clients.delete(res);
    if (clients.size === 0) entryClients.delete(key);
  };
}

export function notifyVisitorEntryPending(entry) {
  const payload = { type: 'pending-created', entry };
  adminClients.forEach((client) => writeEvent(client, payload));
}

export function notifyVisitorEntryReviewed(entry) {
  const id = String(entry._id);
  const payload = { type: 'entry-reviewed', entry };

  adminClients.forEach((client) => writeEvent(client, payload));
  entryClients.get(id)?.forEach((client) => writeEvent(client, payload));
}

export function writeSseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}
