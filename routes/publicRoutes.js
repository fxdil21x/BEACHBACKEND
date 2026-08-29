import { Router } from 'express';
import {
  publicSearchResidents,
  publicRegisterResident,
  publicLoginResident,
} from '../controllers/publicController.js';
import { getActiveAnnouncements } from '../controllers/announcementController.js';
import { getFeatureSettings, getAppearance } from '../controllers/featureSettingsController.js';
import { uploadPhoto } from '../middleware/uploadMiddleware.js';
import { loginRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = Router();

router.get('/residents/search', publicSearchResidents);
router.post('/resident-register', loginRateLimit, uploadPhoto.single('photo'), publicRegisterResident);
router.post('/resident-login', loginRateLimit, publicLoginResident);
router.get('/announcements', getActiveAnnouncements);
router.get('/features', getFeatureSettings);
router.get('/appearance', getAppearance);

export default router;
