import AuditLog from '../models/AuditLog.js';

export async function logAudit({ performedBy, role, action, targetType, targetId, metadata = {} }) {
  try {
    await AuditLog.create({
      performedBy: performedBy || null,
      role: role || null,
      action,
      targetType: targetType || null,
      targetId: targetId || null,
      metadata,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}
