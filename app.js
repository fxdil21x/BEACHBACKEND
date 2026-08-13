import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import authRoutes from './routes/authRoutes.js';
import residentRoutes from './routes/residentRoutes.js';
import residentPassRoutes from './routes/residentPassRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import visitorRoutes, { entryRouter } from './routes/visitorRoutes.js';
import masterRoutes from './routes/masterRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import { generalApiRateLimit } from './middleware/rateLimitMiddleware.js';
import { requireDBConnection } from './middleware/dbMiddleware.js';
import { getDBStatus } from './config/db.js';

const app = express();

app.use(helmet());
const allowedOrigins = new Set([
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(mongoSanitize());
app.use(generalApiRateLimit);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Muzhappilangad Beach API', db: getDBStatus() });
});

app.use('/api', requireDBConnection);

app.use('/api/auth', authRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/resident-pass', residentPassRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/beach', visitorRoutes);
app.use('/api/visitor-entry', entryRouter);
app.use('/api/master', masterRoutes);
app.use('/api/beach-reports', reportRoutes);
app.use('/api/public', publicRoutes);

app.use(errorMiddleware);

export default app;
