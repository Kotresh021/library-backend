import express from 'express';
import { issueBook, returnBook } from '../controllers/transactionController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/issue', protect, authorize('admin', 'staff'), issueBook);
router.post('/return', protect, authorize('admin', 'staff'), returnBook);

export default router;