import express from 'express';
import { authUser, forgotPassword, resetPassword } from '../controllers/authController.js';

const router = express.Router();

router.post('/login', authUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
export default router;