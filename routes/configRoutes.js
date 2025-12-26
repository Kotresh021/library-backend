import express from 'express';
import { getConfig, updateConfig } from '../controllers/configController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getConfig); // Any logged in user can read (e.g. to show due dates)
router.put('/', protect, authorize('admin'), updateConfig); // Only Admin can update

export default router;