import { Router } from 'express';
import { createVisitorEntry, getBeachInstructions, getVisitorEntryStatus, streamVisitorEntryStatus } from '../controllers/visitorController.js';
import { visitorEntryRateLimit } from '../middleware/rateLimitMiddleware.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/instructions', getBeachInstructions);

const entryRouter = Router();
entryRouter.post('/', visitorEntryRateLimit, createVisitorEntry);
entryRouter.get('/:id/status', getVisitorEntryStatus);
entryRouter.get('/:id/events', streamVisitorEntryStatus);

export { entryRouter };
export default router;
