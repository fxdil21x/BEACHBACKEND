import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { UPLOADS_DIR } from './services/imageService.js';
import authRoutes from './routes/authRoutes.js';
import residentRoutes from './routes/residentRoutes.js';
import residentPassRoutes from './routes/residentPassRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import visitorRoutes, { entryRouter } from './routes/visitorRoutes.js';
import masterRoutes from './routes/masterRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import { generalApiRateLimit } from './middleware/rateLimitMiddleware.js';
import { requireDBConnection } from './middleware/dbMiddleware.js';
import { getDBStatus } from './config/db.js';

const app = express();

// Disable ETag generation so server always responds with fresh 200 OK instead of 304 Not Modified
app.set('etag', false);

// Disable client caching for dynamic API responses
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Trust proxy for reverse proxies (Render, Cloudflare, Heroku, Nginx) so client IP is accurately identified
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    setHeaders(res) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

// Build allowed origins list
const buildAllowedOrigins = () => {
  const origins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'https://beach-blush.vercel.app',
  ]);

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  
  // Handle CLIENT_URL with or without protocol
  if (clientUrl) {
    if (!clientUrl.startsWith('http://') && !clientUrl.startsWith('https://')) {
      // No protocol - add both versions
      origins.add(`http://${clientUrl}`);
      origins.add(`https://${clientUrl}`);
    } else {
      // Has protocol - add as-is
      origins.add(clientUrl);
      // Also add the alternative protocol version
      if (clientUrl.startsWith('https://')) {
        origins.add(clientUrl.replace('https://', 'http://'));
      } else {
        origins.add(clientUrl.replace('http://', 'https://'));
      }
    }
  }

  return origins;
};

export const allowedOrigins = buildAllowedOrigins();

const isLocalDevOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);

const isAllowedOrigin = (origin) => {
  if (!origin || origin === 'null') return true;
  if (allowedOrigins.has(origin)) return true;
  if (isLocalDevOrigin(origin)) return true;
  if (/\.exp\.direct(:\d+)?$/.test(origin)) return true;
  if (/\.expo\.dev$/.test(origin)) return true;
  if (/\.ngrok-free\.app$/.test(origin) || /\.ngrok\.io$/.test(origin)) return true;
  if (/\.loca\.lt$/.test(origin)) return true;
  if (/\.vercel\.app$/.test(origin)) return true;
  if (/\.onrender\.com$/.test(origin)) return true;
  return true; // Allow mobile and web client requests
};

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(mongoSanitize());
app.use(generalApiRateLimit);

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Muzhappilangad Beach Safety API Server is running', health: '/api/health' });
});

app.get(['/health', '/api/health', '/ping'], (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Muzhappilangad Beach API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    db: getDBStatus()
  });
});

app.use('/api', requireDBConnection);

app.use('/api/auth', authRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/resident-pass', residentPassRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/beach', visitorRoutes);
app.use('/api/visitor-entry', entryRouter);
app.use('/api/master', masterRoutes);
app.use('/api/master/resident-records', masterRoutes);
app.use('/api/resident-records', masterRoutes);
app.use('/api/beach-reports', reportRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/user/location', locationRoutes);
app.use('/api/services', serviceRoutes);

app.use(errorMiddleware);

export default app;
