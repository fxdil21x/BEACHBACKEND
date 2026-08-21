import { Router } from 'express';
import { updateLocation } from '../controllers/locationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', authMiddleware, updateLocation);

export default router;
