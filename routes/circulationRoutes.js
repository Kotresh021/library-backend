import express from 'express';
import {
    issueBook,
    returnBook,
    getHistory,
    getDashboardStats, // ✅ Make sure this matches the controller export
    getUnpaidFines,
    collectFine,
    editFine,
    getStudentIssues
} from '../controllers/circulationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// Admin/Staff Routes
router.post('/issue', authorize('admin', 'staff'), issueBook);
router.post('/return', authorize('admin', 'staff'), returnBook);
router.get('/history', authorize('admin', 'staff'), getHistory);

// ✅ Ensure this route uses the correct controller function
router.get('/dashboard-stats', authorize('admin', 'staff'), getDashboardStats);

router.get('/fines', authorize('admin', 'staff'), getUnpaidFines);
router.put('/fines/:id/pay', authorize('admin', 'staff'), collectFine);
router.put('/fines/:id/edit', authorize('admin', 'staff'), editFine);

// Student Route
router.get('/student-history', getStudentIssues);

export default router;