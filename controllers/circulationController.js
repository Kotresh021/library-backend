import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import Book from '../models/Book.js';
import BookCopy from '../models/BookCopy.js';
import SystemConfig from '../models/SystemConfig.js';
import { logAudit } from './auditController.js';
import sendEmail from '../utils/sendEmail.js';

// @desc    Issue a Book (Atomic Check & Set)
// @route   POST /api/circulation/issue
export const issueBook = async (req, res) => {
    const { studentId, isbn, copyId } = req.body;

    try {
        let config = await SystemConfig.findOne();
        if (!config) config = await SystemConfig.create({});

        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ message: 'Student not found' });
        if (!student.isActive) return res.status(400).json({ message: 'Student account is blocked' });

        const activeCount = await Transaction.countDocuments({ student: student._id, status: 'Issued' });
        if (activeCount >= config.maxBooksPerStudent) {
            return res.status(400).json({ message: `Limit reached (${config.maxBooksPerStudent} books max)` });
        }

        let targetCopy;

        if (copyId) {
            targetCopy = await BookCopy.findOneAndUpdate(
                { copyNumber: copyId, status: 'Available' },
                { status: 'Issued' },
                { new: true }
            );
            if (!targetCopy) return res.status(400).json({ message: 'Copy is not available (Already Issued or Lost)' });
        } else {
            const book = await Book.findOne({ isbn });
            if (!book) return res.status(404).json({ message: 'Book ISBN not found' });

            // ✅ FIX: Using 'book' (the object ID field) instead of 'bookId'
            targetCopy = await BookCopy.findOneAndUpdate(
                { book: book._id, status: 'Available' },
                { status: 'Issued' },
                { new: true }
            );
            if (!targetCopy) return res.status(400).json({ message: 'No copies currently available' });
        }

        // ✅ FIX: Using 'targetCopy.book' for the ID reference
        await Book.findByIdAndUpdate(targetCopy.book, { $inc: { availableCopies: -1 } });

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + config.issueDaysLimit);

        const transaction = await Transaction.create({
            student: student._id,
            book: targetCopy.book, // ✅ FIX: Correct field name for Transaction
            copyId: targetCopy.copyNumber,
            dueDate,
            status: 'Issued',
            isFinePaid: false
        });

        if (req.user) await logAudit(req.user._id, 'ISSUE_BOOK', `Issued ${targetCopy.copyNumber} to ${student.registerNumber}`);

        res.status(201).json({
            message: 'Book Issued Successfully',
            copy: targetCopy.copyNumber,
            transaction,
            dueDate
        });

    } catch (error) {
        if (req.body.copyId) {
            await BookCopy.findOneAndUpdate({ copyNumber: req.body.copyId }, { status: 'Available' });
        }
        res.status(500).json({ message: error.message });
    }
};

// @desc    Return a Book (Fine Logic)
// @route   POST /api/circulation/return
export const returnBook = async (req, res) => {
    const { copyId } = req.body;

    try {
        let config = await SystemConfig.findOne();
        if (!config) config = await SystemConfig.create({});

        const transaction = await Transaction.findOne({ copyId, status: 'Issued' }).populate('student', 'name email');

        if (!transaction) {
            const checkCopy = await BookCopy.findOne({ copyNumber: copyId });
            if (checkCopy && checkCopy.status === 'Available') {
                return res.status(400).json({ message: 'Book is already marked Returned.' });
            }
            return res.status(404).json({ message: 'No active Issue record found for this copy.' });
        }

        const today = new Date();
        const dueDate = new Date(transaction.dueDate);
        let fine = 0;

        const todayMidnight = new Date(today.setHours(0, 0, 0, 0));
        const dueMidnight = new Date(dueDate.setHours(0, 0, 0, 0));

        if (todayMidnight > dueMidnight) {
            const diffTime = Math.abs(todayMidnight - dueMidnight);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            fine = diffDays * config.finePerDay;
        }

        transaction.returnDate = new Date();
        transaction.status = 'Returned';
        transaction.fine = fine;
        transaction.isFinePaid = (fine === 0);
        await transaction.save();

        await BookCopy.findOneAndUpdate({ copyNumber: copyId }, { status: 'Available' });

        const copy = await BookCopy.findOne({ copyNumber: copyId });
        await Book.findByIdAndUpdate(copy.book, { $inc: { availableCopies: 1 } });

        if (req.user) await logAudit(req.user._id, 'RETURN_BOOK', `Returned ${copyId}. Fine: ₹${fine}`);

        res.json({
            message: 'Book Returned Successfully',
            fine,
            student: transaction.student.name
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Dashboard Stats (With Department Activity)
// @route   GET /api/circulation/dashboard-stats
export const getDashboardStats = async (req, res) => {
    try {
        const totalBooks = await Book.countDocuments();
        const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
        const activeIssues = await Transaction.countDocuments({ status: 'Issued' });

        const fineAgg = await Transaction.aggregate([
            { $group: { _id: null, total: { $sum: "$fine" } } }
        ]);
        const totalFine = fineAgg.length > 0 ? fineAgg[0].total : 0;

        const recentActivity = await Transaction.find()
            .sort({ updatedAt: -1 })
            .limit(5)
            .populate('student', 'name')
            .populate('book', 'title');

        // ✅ NEW: Department Activity Aggregation
        const deptStats = await Transaction.aggregate([
            {
                $lookup: {
                    from: 'users', // Must match your MongoDB collection name (usually lowercase plural of model)
                    localField: 'student',
                    foreignField: '_id',
                    as: 'studentInfo'
                }
            },
            { $unwind: '$studentInfo' },
            {
                $group: {
                    _id: '$studentInfo.department',
                    count: { $sum: 1 }
                }
            }
        ]);

        const deptActivity = {
            labels: deptStats.map(d => d._id || 'Unknown'),
            data: deptStats.map(d => d.count)
        };

        res.json({ totalBooks, totalStudents, activeIssues, totalFine, recentActivity, deptActivity });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get All Transaction History
export const getHistory = async (req, res) => {
    try {
        const history = await Transaction.find()
            .populate('student', 'name registerNumber department')
            .populate('book', 'title')
            .sort({ issueDate: -1 });
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Unpaid Fines
export const getUnpaidFines = async (req, res) => {
    try {
        const fines = await Transaction.find({ fine: { $gt: 0 }, isFinePaid: false })
            .populate('student', 'name registerNumber email')
            .populate('book', 'title')
            .sort({ dueDate: 1 });
        res.json(fines);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark Fine as Paid
export const collectFine = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
            .populate('student', 'name email registerNumber department')
            .populate('book', 'title isbn');

        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

        transaction.isFinePaid = true;
        await transaction.save();

        if (transaction.student && transaction.student.email) {
            // Email logic (simplified)
            // ... (keep your existing email logic here or assume sendEmail works)
        }

        if (req.user) await logAudit(req.user._id, 'FINE_COLLECT', `Collected ₹${transaction.fine}`);
        res.json({ message: 'Payment Collected' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Manually Edit Fine
export const editFine = async (req, res) => {
    const { amount, reason } = req.body;
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

        transaction.fine = amount;
        transaction.fineReason = reason || 'Manual Override';
        await transaction.save();

        if (req.user) await logAudit(req.user._id, 'FINE_EDIT', `Changed fine to ₹${amount}`);
        res.json({ message: 'Fine Updated', transaction });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Student Issues
export const getStudentIssues = async (req, res) => {
    try {
        const transactions = await Transaction.find({ student: req.user._id })
            .populate('book', 'title author')
            .sort({ createdAt: -1 });
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};