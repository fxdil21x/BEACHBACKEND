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
  createResidentRecord,
  updateResidentRecord,
  deleteResidentRecord,
} from '../controllers/residentController.js';
import {
  getRegisteredResidents,
  togglePassStatus,
} from '../controllers/residentPassController.js';
import { getEntryLogs } from '../controllers/adminController.js';
import { getVisitorEntries } from '../controllers/visitorController.js';
import { getReportsMaster } from '../controllers/reportController.js';
import {
  createAnnouncement,
  getAnnouncementsMaster,
  updateAnnouncement,
  deleteAnnouncement,
} from '../controllers/announcementController.js';
import {
  getFeatureSettings,
  updateFeatureSettings,
} from '../controllers/featureSettingsController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireMasterAdmin } from '../middleware/roleMiddleware.js';
import { uploadJson } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(authMiddleware, requireMasterAdmin);

router.get('/dashboard', getDashboard);
router.get('/analytics', getAnalyticsData);
router.get('/features', getFeatureSettings);
router.put('/features', updateFeatureSettings);
router.post('/import-residents', uploadJson.single('file'), importResidents);
router.get('/resident-records', getResidentRecordsMaster);
router.post('/resident-records', createResidentRecord);
router.put('/resident-records/:id', updateResidentRecord);
router.patch('/resident-records/:id', updateResidentRecord);
router.post('/resident-records/:id', updateResidentRecord);
router.delete('/resident-records/:id', deleteResidentRecord);

// Direct root aliases when mounted at /api/resident-records or /api/master/resident-records
router.get('/', getResidentRecordsMaster);
router.post('/', createResidentRecord);
router.put('/:id', updateResidentRecord);
router.patch('/:id', updateResidentRecord);
router.delete('/:id', deleteResidentRecord);
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

router.get('/announcements', getAnnouncementsMaster);
router.post('/announcements', createAnnouncement);
router.patch('/announcements/:id', updateAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

export default router;
