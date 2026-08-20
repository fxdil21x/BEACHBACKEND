import { Router } from 'express';
import { createReport, getMyReports, streamUserReportEvents } from '../controllers/reportController.js';
import { optionalAuth, authMiddleware, eventAuthMiddleware } from '../middleware/authMiddleware.js';
import { uploadPhoto } from '../middleware/uploadMiddleware.js';

const router = Router();

router.get('/me', authMiddleware, getMyReports);
router.get('/events/user', eventAuthMiddleware, streamUserReportEvents);
router.post('/', optionalAuth, uploadPhoto.single('photo'), createReport);

export default router;

