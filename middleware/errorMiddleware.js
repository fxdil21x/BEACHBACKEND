import multer from 'multer';
import { sendError } from '../utils/index.js';

export function errorMiddleware(err, _req, res, _next) {
  console.error(err);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return sendError(res, messages.join(', '), 400);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return sendError(res, `Duplicate value for ${field}`, 409);
  }

  if (err.name === 'CastError') {
    return sendError(res, 'Invalid ID format', 400);
  }

  if (err.message?.includes('Only JPG') || err.message?.includes('Only JSON')) {
    return sendError(res, err.message, 400);
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'File too large', 400);
    }
    return sendError(res, err.message, 400);
  }

  return sendError(res, err.message || 'Internal server error', err.statusCode || 500);
}
