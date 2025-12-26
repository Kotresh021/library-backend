import express from 'express';
import { getDepartments, addDepartment, deleteDepartment } from '../controllers/deptController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getDepartments);
router.post('/', protect, authorize('admin'), addDepartment);
router.delete('/:id', protect, authorize('admin'), deleteDepartment);

export default router;