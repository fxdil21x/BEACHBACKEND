import { Router } from 'express';
import { createEmergency, getActiveEmergencies, claimEmergency, cancelEmergency } from '../controllers/emergencyController.js';
import { optionalAuth, authMiddleware } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';

const router = Router();

router.post('/trigger', optionalAuth, createEmergency);
router.get('/active', authMiddleware, requireAdmin, getActiveEmergencies);
router.post('/claim/:emergencyId', authMiddleware, requireAdmin, claimEmergency);
router.post('/cancel/:emergencyId', optionalAuth, cancelEmergency);

export default router;
