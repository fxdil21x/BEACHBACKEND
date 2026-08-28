import rateLimit from 'express-rate-limit';

// Extract client IP safely behind proxies (Cloudflare, Render, etc.)
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
};

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false, default: false },
  message: { success: false, message: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const visitorEntryRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false, default: false },
  message: { success: false, message: 'Too many entry requests, please wait' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalApiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false, default: false },
  skip: (req) => {
    // Never rate-limit health checks, features check, or continuous location telemetry
    const url = req.originalUrl || req.url;
    return (
      url.includes('/api/health') ||
      url.includes('/api/public/features') ||
      url.includes('/api/features') ||
      url.includes('/api/user/location')
    );
  },
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
