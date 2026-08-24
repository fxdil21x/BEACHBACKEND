import express from 'express';
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  addMenuItem,
  updateMenuItem,
  toggleMenuItemAvailability,
  deleteMenuItem,
} from '../controllers/serviceController.js';
import { authMiddleware, optionalAuth } from '../middleware/authMiddleware.js';
import { requireMasterAdmin } from '../middleware/roleMiddleware.js';

const router = express.Router();

// ── Public Routes (with optional auth so admin sees all if logged in) ────────
router.get('/', optionalAuth, getServices);
router.get('/:id', getServiceById);

// ── Master Admin Protected Routes ───────────────────────────────────────────
router.post('/', authMiddleware, requireMasterAdmin, createService);
router.put('/:id', authMiddleware, requireMasterAdmin, updateService);
router.delete('/:id', authMiddleware, requireMasterAdmin, deleteService);

// ── Food Menu Management Routes ─────────────────────────────────────────────
router.post('/:id/menu', authMiddleware, requireMasterAdmin, addMenuItem);
router.put('/:id/menu/:itemId', authMiddleware, requireMasterAdmin, updateMenuItem);
router.patch('/:id/menu/:itemId/toggle', authMiddleware, requireMasterAdmin, toggleMenuItemAvailability);
router.delete('/:id/menu/:itemId', authMiddleware, requireMasterAdmin, deleteMenuItem);

export default router;
