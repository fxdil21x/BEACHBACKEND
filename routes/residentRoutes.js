import { Router } from 'express';
import { searchResidents, getResidentById } from '../controllers/residentController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireUser } from '../middleware/roleMiddleware.js';

const router = Router();

router.use(authMiddleware, requireUser);

router.get('/search', searchResidents);
router.get('/:id', getResidentById);

export default router;
