import AuditLog from '../models/AuditLog.js';

export function cleanIp(rawIp = '') {
  if (!rawIp) return '—';
  let ip = String(rawIp).trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
    return '127.0.0.1 (Localhost)';
  }
  return ip;
}

export function parseUserAgent(ua = '') {
  if (!ua) return { os: 'Unknown OS', browser: 'Browser', deviceType: 'Desktop', deviceSummary: '💻 Desktop' };

  let os = 'Unknown OS';
  if (/windows nt 10\.0/i.test(ua)) os = 'Windows 10/11';
  else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1';
  else if (/windows nt 6\.2/i.test(ua)) os = 'Windows 8';
  else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/android\s*([0-9\.]+)?/i.test(ua)) {
    const match = ua.match(/android\s*([0-9\.]+)/i);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (/iphone/i.test(ua)) {
    const match = ua.match(/os\s*([0-9\_]+)/i);
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS (iPhone)';
  } else if (/ipad/i.test(ua)) {
    const match = ua.match(/os\s*([0-9\_]+)/i);
    os = match ? `iPadOS ${match[1].replace(/_/g, '.')}` : 'iPadOS';
  } else if (/macintosh|mac os x/i.test(ua)) {
    const match = ua.match(/mac os x\s*([0-9\_\.]+)/i);
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/cros/i.test(ua)) os = 'ChromeOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  // Device brand / model detection
  let deviceBrand = '';
  if (/samsung|sm-[a-z0-9]+/i.test(ua)) deviceBrand = 'Samsung';
  else if (/redmi|xiaomi|poco/i.test(ua)) deviceBrand = 'Xiaomi/Redmi';
  else if (/oneplus/i.test(ua)) deviceBrand = 'OnePlus';
  else if (/pixel/i.test(ua)) deviceBrand = 'Google Pixel';
  else if (/vivo/i.test(ua)) deviceBrand = 'Vivo';
  else if (/oppo/i.test(ua)) deviceBrand = 'Oppo';
  else if (/realme/i.test(ua)) deviceBrand = 'Realme';
  else if (/huawei|honor/i.test(ua)) deviceBrand = 'Huawei';
  else if (/iphone/i.test(ua)) deviceBrand = 'Apple iPhone';
  else if (/ipad/i.test(ua)) deviceBrand = 'Apple iPad';

  // Browser detection
  let browser = 'Browser';
  if (/edg\/([0-9\.]+)/i.test(ua)) {
    browser = 'Edge';
  } else if (/samsungbrowser\/([0-9\.]+)/i.test(ua)) {
    browser = 'Samsung Internet';
  } else if (/brave/i.test(ua)) {
    browser = 'Brave';
  } else if (/chrome|crios/i.test(ua)) {
    browser = 'Chrome';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Firefox';
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browser = 'Safari';
  } else if (/opera|opr/i.test(ua)) {
    browser = 'Opera';
  }

  const isTablet = /ipad|tablet/i.test(ua);
  const isMobile = !isTablet && /mobile|android|iphone|phone/i.test(ua);
  const deviceType = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';
  const icon = isTablet ? '📟' : isMobile ? '📱' : '💻';

  const brandText = deviceBrand ? ` (${deviceBrand})` : '';
  const deviceSummary = `${icon} ${os}${brandText} • ${browser}`;

  return {
    os,
    browser,
    deviceType,
    deviceBrand,
    deviceSummary,
  };
}

export function getClientInfo(req) {
  if (!req) return { ip: '—', userAgent: '' };
  const rawIp =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    '';

  const userAgent = req.headers['user-agent'] || '';
  return {
    ip: cleanIp(rawIp),
    userAgent,
  };
}

export async function logAudit({ req, performedBy, role, action, targetType, targetId, metadata = {} }) {
  try {
    // Strictly do not track Master Admin; only track USER and ADMIN
    if (role === 'MASTER_ADMIN') {
      return;
    }

    const enrichedMetadata = { ...metadata };

    if (req) {
      const clientInfo = getClientInfo(req);
      if (!enrichedMetadata.ip) enrichedMetadata.ip = clientInfo.ip;
      if (!enrichedMetadata.userAgent) enrichedMetadata.userAgent = clientInfo.userAgent;
    }

    if (enrichedMetadata.ip) {
      enrichedMetadata.ip = cleanIp(enrichedMetadata.ip);
    }

    // Auto-enrich device details if userAgent is passed
    if (enrichedMetadata.userAgent) {
      const parsed = parseUserAgent(enrichedMetadata.userAgent);
      enrichedMetadata.device = parsed.deviceSummary;
      enrichedMetadata.os = parsed.os;
      enrichedMetadata.browser = parsed.browser;
      enrichedMetadata.deviceType = parsed.deviceType;
      enrichedMetadata.deviceBrand = parsed.deviceBrand;
    }

    await AuditLog.create({
      performedBy: performedBy || null,
      role: role || null,
      action,
      targetType: targetType || null,
      targetId: targetId || null,
      metadata: enrichedMetadata,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

