import { Router } from 'express';
import { createReport } from '../controllers/reportController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';
import { uploadPhoto } from '../middleware/uploadMiddleware.js';

const router = Router();

router.post('/', optionalAuth, uploadPhoto.single('photo'), createReport);

export default router;
