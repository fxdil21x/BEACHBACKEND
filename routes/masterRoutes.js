import { Router } from 'express';
import {
  getDashboard,
  getAnalyticsData,
  getUsers,
  createUser,
  updateUser,
  getAdmins,
  getAuditLogs,
} from '../controllers/masterController.js';
import {
  importResidents,
  getResidentRecordsMaster,
} from '../controllers/residentController.js';
import {
  getRegisteredResidents,
  togglePassStatus,
} from '../controllers/residentPassController.js';
import { getEntryLogs } from '../controllers/adminController.js';
import { getVisitorEntries } from '../controllers/visitorController.js';
import { getReportsMaster } from '../controllers/reportController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireMasterAdmin } from '../middleware/roleMiddleware.js';
import { uploadJson } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(authMiddleware, requireMasterAdmin);

router.get('/dashboard', getDashboard);
router.get('/analytics', getAnalyticsData);
router.post('/import-residents', uploadJson.single('file'), importResidents);
router.get('/resident-records', getResidentRecordsMaster);
router.get('/registered-residents', getRegisteredResidents);
router.patch('/passes/:id', togglePassStatus);
router.get('/visitor-entries', getVisitorEntries);
router.get('/entry-logs', getEntryLogs);
router.get('/users', getUsers);
router.post('/users', createUser);
router.patch('/users/:id', updateUser);
router.get('/admins', getAdmins);
router.get('/audit-logs', getAuditLogs);
router.get('/beach-reports', getReportsMaster);

export default router;
