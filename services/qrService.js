export function getQrPayload(qrToken) {
  return qrToken;
}

export function parseQrScan(rawValue) {
  if (!rawValue) return null;
  const trimmed = String(rawValue).trim();
  // Support URL format: https://domain/verify/TOKEN or raw token
  const urlMatch = trimmed.match(/\/verify\/([a-f0-9]{64})$/i);
  if (urlMatch) return urlMatch[1];
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return trimmed;
  return trimmed;
}
