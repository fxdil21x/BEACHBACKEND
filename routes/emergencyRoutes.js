import { Router } from 'express';
import { createEmergency, claimEmergency } from '../controllers/emergencyController.js';
import { optionalAuth, authMiddleware } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';

const router = Router();

router.post('/trigger', optionalAuth, createEmergency);
router.post('/claim/:emergencyId', authMiddleware, requireAdmin, claimEmergency);

export default router;
