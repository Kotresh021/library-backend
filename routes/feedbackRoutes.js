import express from 'express';
import { submitFeedback, getAllFeedbacks, getMyFeedbacks, replyFeedback } from '../controllers/feedbackController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, authorize('student'), submitFeedback);
router.get('/', protect, authorize('admin', 'staff'), getAllFeedbacks);
router.get('/my', protect, authorize('student'), getMyFeedbacks);
router.put('/:id/reply', protect, authorize('admin', 'staff'), replyFeedback);

export default router;