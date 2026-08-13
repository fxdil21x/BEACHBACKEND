import crypto from 'crypto';

export function generateQrToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function generateIdempotencyKey() {
  return crypto.randomBytes(16).toString('hex');
}
