import { Router } from 'express';
import {
  createResidentPass,
  getMyPass,
  getMyQr,
  getMyEntries,
  updateMyPhoto,
} from '../controllers/residentPassController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireUser } from '../middleware/roleMiddleware.js';
import { uploadPhoto } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(authMiddleware, requireUser);

router.post('/', uploadPhoto.single('photo'), createResidentPass);
router.patch('/me/photo', uploadPhoto.single('photo'), updateMyPhoto);
router.get('/me', getMyPass);
router.get('/me/qr', getMyQr);
router.get('/me/entries', getMyEntries);

export default router;
