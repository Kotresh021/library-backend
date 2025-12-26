import express from 'express';
import multer from 'multer';
import {
    getStudents,
    uploadStudentCSV,
    bulkStudentUpdate,
    createStudent,
    updateStudent,
    updateUserProfile,
    getStaffList,
    createStaff,
    deleteUser,
    createAdmin,
    getAdmins
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// ✅ FIX: Add this root route. 
// When Frontend calls API.get('/users'), it hits this.
// We map it to 'getStudents' so it returns the list of students for the search bar.
router.get('/', protect, authorize('admin', 'staff'), getStudents);

// Existing routes
router.get('/students', protect, authorize('admin', 'staff'), getStudents);
router.post('/upload', protect, authorize('admin'), upload.single('file'), uploadStudentCSV);
router.put('/bulk-update', protect, authorize('admin'), bulkStudentUpdate);
router.post('/student', protect, authorize('admin'), createStudent);
router.put('/student/:id', protect, authorize('admin'), updateStudent);
router.put('/profile', protect, updateUserProfile);
router.get('/staff-list', protect, authorize('admin'), getStaffList);
router.post('/create-staff', protect, authorize('admin'), createStaff);
router.delete('/:id', protect, authorize('admin'), deleteUser);
router.post('/create-admin', protect, authorize('admin'), createAdmin);
router.get('/admins', protect, authorize('admin'), getAdmins);

export default router;