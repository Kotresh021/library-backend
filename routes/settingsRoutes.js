import express from 'express';
import { getSettings, updateRules, updateConfig } from '../controllers/settingsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public: Anyone logged in (Student/Staff/Admin) can VIEW rules
router.get('/', protect, getSettings);

// Admin Only: Can EDIT rules & config
router.put('/rules', protect, authorize('admin'), updateRules);
router.put('/config', protect, authorize('admin'), updateConfig);

export default router;