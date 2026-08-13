import { Router } from 'express';
import {
  scanResident,
  getAdminResidents,
  getAdminResidentById,
  getAdminEntryLogs,
  getBeachReports,
  updateBeachReportStatus,
} from '../controllers/adminController.js';
import { getPendingVisitorEntries, getVisitorEntries, reviewVisitorEntry, streamPendingVisitorEntries } from '../controllers/visitorController.js';
import { authMiddleware, eventAuthMiddleware } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';

const router = Router();

router.get('/visitor-entries/events', eventAuthMiddleware, requireAdmin, streamPendingVisitorEntries);
router.use(authMiddleware, requireAdmin);

router.post('/scan-resident', scanResident);
router.get('/residents', getAdminResidents);
router.get('/residents/:id', getAdminResidentById);
router.get('/entry-logs', getAdminEntryLogs);
router.get('/visitor-entries', getVisitorEntries);
router.get('/visitor-entries/pending', getPendingVisitorEntries);
router.patch('/visitor-entries/:id/review', reviewVisitorEntry);
router.get('/beach-reports', getBeachReports);
router.patch('/beach-reports/:id', updateBeachReportStatus);

export default router;
