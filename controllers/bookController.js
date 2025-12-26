import Book from '../models/Book.js';
import BookCopy from '../models/BookCopy.js';
import Department from '../models/Department.js'; // ✅ Required for validation
import csv from 'csv-parser';
import fs from 'fs';

// --- CREATE BOOK (Single) ---
export const createBook = async (req, res) => {
    try {
        const { title, author, isbn, department, quantity } = req.body;

        // 1. Validate Department
        const validDept = await Department.findOne({ code: department });
        if (!validDept) {
            return res.status(400).json({ message: `Invalid Department Code: '${department}'` });
        }

        // 2. Check if ISBN exists
        const existingBook = await Book.findOne({ isbn });
        if (existingBook) return res.status(400).json({ message: "Book with this ISBN already exists" });

        // 3. Create Book
        const newBook = new Book({
            title, author, isbn, department,
            totalCopies: quantity, availableCopies: quantity
        });
        await newBook.save();

        // 4. Generate Copies
        const copies = [];
        for (let i = 1; i <= quantity; i++) {
            copies.push({
                book: newBook._id,
                copyNumber: `${isbn}-${i}`, // e.g., 978-123-1
                status: 'Available'
            });
        }
        await BookCopy.insertMany(copies);

        res.status(201).json(newBook);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- GET ALL BOOKS ---
export const getBooks = async (req, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- UPDATE BOOK ---
export const updateBook = async (req, res) => {
    try {
        const { title, author, department } = req.body;

        // Validate Dept if it's being changed
        if (department) {
            const validDept = await Department.findOne({ code: department });
            if (!validDept) return res.status(400).json({ message: "Invalid Department Code" });
        }

        const updatedBook = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedBook);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- DELETE BOOK (Single) + CASCADE DELETE COPIES ---
export const deleteBook = async (req, res) => {
    try {
        const bookId = req.params.id;

        // 1. Delete all copies associated with this book
        await BookCopy.deleteMany({ book: bookId }); // ✅ Fixed: Deletes copies

        // 2. Delete the book itself
        await Book.findByIdAndDelete(bookId);

        res.json({ message: "Book and all its copies deleted" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- BULK DELETE BOOKS + CASCADE DELETE COPIES ---
export const bulkDeleteBooks = async (req, res) => {
    try {
        const { bookIds } = req.body;
        if (!bookIds || bookIds.length === 0) {
            return res.status(400).json({ message: "No books selected" });
        }

        // 1. Delete all copies for these books
        await BookCopy.deleteMany({ book: { $in: bookIds } }); // ✅ Fixed

        // 2. Delete the books
        await Book.deleteMany({ _id: { $in: bookIds } });

        res.status(200).json({ message: `${bookIds.length} books and their copies deleted.` });
    } catch (error) {
        res.status(500).json({ message: "Bulk delete failed", error: error.message });
    }
};

// --- UPLOAD CSV (With Validation) ---
export const uploadBookCSV = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const results = [];
    const errors = [];
    let addedCount = 0;
    let updatedCount = 0;

    // 1. Fetch Valid Departments first for quick lookup
    const allDepts = await Department.find();
    const validDeptCodes = allDepts.map(d => d.code.toUpperCase());

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            for (const row of results) {
                // Normalize Keys (handle case sensitivity)
                const title = row.Title || row.title;
                const author = row.Author || row.author;
                const isbn = row.ISBN || row.isbn;
                const dept = row.Department || row.department; // Expecting Code (e.g. "CSE")
                const quantity = parseInt(row.Quantity || row.quantity || 1);

                // --- VALIDATION CHECKS ---

                // Check 1: Missing Basic Fields
                if (!isbn || !title) {
                    errors.push(`Row missing ISBN or Title`);
                    continue;
                }

                // Check 2: Validate Department (CRITICAL FIX)
                // If dept is missing or not in our list of codes
                if (!dept || !validDeptCodes.includes(dept.toUpperCase())) {
                    errors.push(`ISBN ${isbn}: Invalid or Missing Department '${dept}'. Please add Dept first.`);
                    continue; // 🛑 Stop here. Do not try to save.
                }

                try {
                    let book = await Book.findOne({ isbn });

                    if (book) {
                        // UPDATE EXISTING
                        // Optionally update title/author if needed
                        updatedCount++;
                    } else {
                        // CREATE NEW
                        book = new Book({
                            title,
                            author,
                            isbn,
                            department: dept.toUpperCase(),
                            totalCopies: 0, // Will increase below
                            availableCopies: 0
                        });
                        await book.save();
                        addedCount++;
                    }

                    // GENERATE COPIES (Safely)
                    const copiesToInsert = [];
                    // Start from current total + 1
                    let startCopyNum = book.totalCopies + 1;

                    for (let i = 0; i < quantity; i++) {
                        const copyNumString = `${isbn}-${startCopyNum + i}`;

                        // Double check if this specific copy ID exists (to prevent E11000)
                        const exists = await BookCopy.findOne({ copyNumber: copyNumString });
                        if (!exists) {
                            copiesToInsert.push({
                                book: book._id,
                                copyNumber: copyNumString,
                                status: 'Available'
                            });
                        }
                    }

                    if (copiesToInsert.length > 0) {
                        await BookCopy.insertMany(copiesToInsert);

                        // Update Book Counts
                        book.totalCopies += copiesToInsert.length;
                        book.availableCopies += copiesToInsert.length;
                        await book.save();
                    }

                } catch (err) {
                    // Catch duplicate key errors if they still slip through
                    if (err.code === 11000) {
                        errors.push(`ISBN ${isbn}: Duplicate Entry Detected (ISBN or Copy Number)`);
                    } else {
                        errors.push(`ISBN ${isbn}: ${err.message}`);
                    }
                }
            }

            fs.unlinkSync(req.file.path); // Clean up file
            res.json({
                message: "Process Complete",
                added: addedCount,
                updated: updatedCount,
                errors
            });
        });
};

// --- COPY MANAGEMENT CONTROLLERS ---
export const getBookCopies = async (req, res) => {
    try {
        const copies = await BookCopy.find({ book: req.params.bookId });
        res.json(copies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const addCopies = async (req, res) => {
    try {
        const { bookId, count } = req.body;
        const book = await Book.findById(bookId);
        if (!book) return res.status(404).json({ message: "Book not found" });

        const copies = [];
        let startNum = book.totalCopies + 1;

        for (let i = 0; i < count; i++) {
            copies.push({
                book: book._id,
                copyNumber: `${book.isbn}-${startNum + i}`,
                status: 'Available'
            });
        }

        await BookCopy.insertMany(copies);

        // Update counts
        book.totalCopies += count;
        book.availableCopies += count;
        await book.save();

        res.json({ message: `${count} Copies Added` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteCopy = async (req, res) => {
    try {
        const copy = await BookCopy.findById(req.params.id);
        if (!copy) return res.status(404).json({ message: "Copy not found" });

        const book = await Book.findById(copy.book);

        await BookCopy.findByIdAndDelete(req.params.id);

        // Update Book Counts
        if (book) {
            book.totalCopies -= 1;
            if (copy.status === 'Available') {
                book.availableCopies -= 1;
            }
            await book.save();
        }

        res.json({ message: "Copy deleted" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateCopyStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const copy = await BookCopy.findById(req.params.id);
        if (!copy) return res.status(404).json({ message: "Copy not found" });

        const book = await Book.findById(copy.book);

        // Handle Available Logic
        if (copy.status === 'Available' && status !== 'Available') {
            book.availableCopies -= 1;
        } else if (copy.status !== 'Available' && status === 'Available') {
            book.availableCopies += 1;
        }

        copy.status = status;
        await copy.save();
        await book.save();

        res.json(copy);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};