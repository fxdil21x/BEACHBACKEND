import { Router } from 'express';
import { register, login, me } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { loginRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = Router();

router.post('/register', loginRateLimit, register);
router.post('/login', loginRateLimit, login);
router.get('/me', authMiddleware, me);

export default router;
