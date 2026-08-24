import AuditLog from '../models/AuditLog.js';

export function parseUserAgent(ua = '') {
  if (!ua) return { os: 'Unknown OS', browser: 'Browser', deviceType: 'Desktop', deviceSummary: '💻 Desktop' };

  let os = 'Unknown';
  if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone/i.test(ua)) os = 'iPhone';
  else if (/ipad/i.test(ua)) os = 'iPad';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  const isMobile = /mobile|android|iphone|ipad|phone/i.test(ua);
  const deviceType = isMobile ? 'Mobile' : 'Desktop';
  const icon = isMobile ? '📱' : '💻';

  return {
    os,
    browser,
    deviceType,
    deviceSummary: `${icon} ${os} (${browser})`,
  };
}

export async function logAudit({ performedBy, role, action, targetType, targetId, metadata = {} }) {
  try {
    // Strictly do not track Master Admin; only track USER and ADMIN
    if (role === 'MASTER_ADMIN') {
      return;
    }

    // Auto-enrich device details if userAgent is passed
    if (metadata.userAgent && !metadata.device) {
      const parsed = parseUserAgent(metadata.userAgent);
      metadata.device = parsed.deviceSummary;
      metadata.os = parsed.os;
      metadata.browser = parsed.browser;
      metadata.deviceType = parsed.deviceType;
    }

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
