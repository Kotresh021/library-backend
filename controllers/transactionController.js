import Transaction from '../models/Transaction.js';
import Book from '../models/Book.js';
import BookCopy from '../models/BookCopy.js';
import SystemConfig from '../models/SystemConfig.js';
import User from '../models/User.js';

// Helper: Calculate Sundays between two dates
const countSundays = (start, end) => {
    let count = 0;
    let curDate = new Date(start);
    while (curDate <= end) {
        if (curDate.getDay() === 0) count++; // 0 is Sunday
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
};

// @desc    Issue a Book
// @route   POST /api/transactions/issue
// @access  Staff/Admin
export const issueBook = async (req, res) => {
    const { studentId, bookId, copyId } = req.body;

    try {
        // 1. Check Student Eligibility
        const student = await User.findById(studentId);
        if (!student || !student.isActive) {
            return res.status(400).json({ message: 'Student not found or blocked' });
        }

        // Check active issues (Max 7 books/week rule - simplified to Max 7 active books)
        const activeIssues = await Transaction.countDocuments({ userId: studentId, status: 'Issued' });
        if (activeIssues >= 7) {
            return res.status(400).json({ message: 'Student has reached maximum borrow limit (7 books)' });
        }

        // 2. Check Copy Availability
        const copy = await BookCopy.findById(copyId);
        if (!copy || copy.status !== 'Available') {
            return res.status(400).json({ message: 'Book copy is not available' });
        }

        // 3. Create Transaction
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7); // Due in 7 days

        const transaction = await Transaction.create({
            userId: studentId,
            bookId,
            copyId,
            issuedBy: req.user._id, // Staff ID from Token
            dueDate
        });

        // 4. Update Status
        copy.status = 'Issued';
        await copy.save();

        // Decrease available count
        await Book.findByIdAndUpdate(bookId, { $inc: { availableCopies: -1 } });

        res.status(201).json(transaction);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Return a Book (With Fine Calculation)
// @route   POST /api/transactions/return
// @access  Staff/Admin
export const returnBook = async (req, res) => {
    const { copyId, excludeSundays } = req.body; // excludeSundays comes from checkbox in frontend

    try {
        // 1. Find the active transaction for this copy
        const transaction = await Transaction.findOne({ copyId, status: 'Issued' });
        if (!transaction) {
            return res.status(404).json({ message: 'No active issue record found for this book copy' });
        }

        // 2. Calculate Dates
        const returnDate = new Date();
        const dueDate = new Date(transaction.dueDate);

        // Calculate time difference in milliseconds
        const diffTime = returnDate - dueDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let fine = 0;
        let lateDays = 0;

        if (diffDays > 0) {
            lateDays = diffDays;

            // Handle Sunday Exclusion
            if (excludeSundays) {
                const sundays = countSundays(dueDate, returnDate);
                lateDays = lateDays - sundays;
            }

            // Get Fine Config from DB
            const fineConfig = await SystemConfig.findOne({ key: 'FINE_PER_DAY' });
            const finePerDay = fineConfig ? parseInt(fineConfig.value) : 10; // Default 10

            if (lateDays > 0) {
                fine = lateDays * finePerDay;
            }
        }

        // 3. Update Transaction
        transaction.returnDate = returnDate;
        transaction.status = 'Returned';
        transaction.fineAmount = fine;
        transaction.finePaid = fine === 0; // If 0 fine, mark as paid automatically
        await transaction.save();

        // 4. Update Copy Status
        await BookCopy.findByIdAndUpdate(copyId, { status: 'Available' });

        // 5. Update Book Availability
        await Book.findByIdAndUpdate(transaction.bookId, { $inc: { availableCopies: 1 } });

        res.json({
            message: 'Book returned successfully',
            fineAmount: fine,
            lateDays: lateDays > 0 ? lateDays : 0,
            transactionId: transaction._id
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};