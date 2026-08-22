import { Router } from 'express';
import { createEmergency, getActiveEmergencies, claimEmergency, cancelEmergency } from '../controllers/emergencyController.js';
import { optionalAuth, authMiddleware } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';

const router = Router();

router.post('/trigger', optionalAuth, createEmergency);
router.get('/active', optionalAuth, getActiveEmergencies);
router.post('/claim/:emergencyId', optionalAuth, claimEmergency);
router.post('/cancel/:emergencyId', optionalAuth, cancelEmergency);

export default router;
