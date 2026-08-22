import { Router } from 'express';
import { updateLocation, stopLocation, getActiveLocations } from '../controllers/locationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', authMiddleware, updateLocation);
router.post('/stop', stopLocation);
router.get('/active', getActiveLocations);

export default router;
