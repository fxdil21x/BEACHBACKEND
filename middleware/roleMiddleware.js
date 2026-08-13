import { sendError } from '../utils/index.js';

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 401);
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Access denied', 403);
    }
    next();
  };
}

export const requireUser = requireRole('USER', 'ADMIN', 'MASTER_ADMIN');
export const requireAdmin = requireRole('ADMIN', 'MASTER_ADMIN');
export const requireMasterAdmin = requireRole('MASTER_ADMIN');
