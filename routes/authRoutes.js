import { Router } from 'express';
import { register, login, logout, me, refreshToken } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/refresh', refreshToken);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, me);

export default router;
