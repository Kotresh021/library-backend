import express from 'express';
import {
    createBook,
    getBooks,
    updateBook,
    deleteBook,
    uploadBookCSV,
    bulkDeleteBooks, // Make sure this is imported
    getBookCopies,
    addCopies,
    deleteCopy,
    updateCopyStatus
} from '../controllers/bookController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// --- PUBLIC ROUTES ---
router.get('/', protect, getBooks); // Everyone can view books

// --- ADMIN / STAFF ROUTES ---
router.post('/', protect, authorize('admin', 'staff'), createBook);
router.put('/:id', protect, authorize('admin', 'staff'), updateBook);

// ✅ FIX: Ensure these Delete routes exist and use the correct controller functions
router.delete('/:id', protect, authorize('admin'), deleteBook);
router.post('/bulk-delete', protect, authorize('admin'), bulkDeleteBooks);

// --- COPY MANAGEMENT ---
router.get('/:bookId/copies', protect, getBookCopies);
router.post('/copy', protect, authorize('admin', 'staff'), addCopies);
router.delete('/copy/:id', protect, authorize('admin'), deleteCopy);
router.put('/copy/:id', protect, authorize('admin', 'staff'), updateCopyStatus);

// --- CSV UPLOAD ---
router.post('/upload', protect, authorize('admin'), upload.single('file'), uploadBookCSV);

export default router;