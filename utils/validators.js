import mongoose from 'mongoose';

export function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitizeUserSearch(query) {
  return String(query || '').trim().slice(0, 100);
}

export function buildNameSearchRegex(query) {
  const tokens = sanitizeUserSearch(query).split(/\s+/).filter(Boolean);
  const pattern = tokens
    .map((token) => {
      const escaped = escapeRegex(token);
      return token.length <= 3 ? escaped.split('').join('\\s*') : escaped;
    })
    .join('\\s+');

  return new RegExp(pattern, 'i');
}

export function validatePhone(phone) {
  const cleaned = String(phone || '').replace(/\s/g, '');
  return /^(\+91)?[6-9]\d{9}$/.test(cleaned) || /^\d{10}$/.test(cleaned);
}

export function normalizePhone(phone) {
  const cleaned = String(phone || '').replace(/\s/g, '');
  if (cleaned.startsWith('+91')) return cleaned.slice(3);
  if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.slice(2);
  return cleaned;
}

export function buildUsernameFromRecord(record) {
  const base = String(record.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 40) || 'resident';
  const suffix = String(record.newSecIdNo || record._id).replace(/\D/g, '').slice(-4) || '0000';
  return `${base}_${suffix}`;
}
