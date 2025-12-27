import Book from '../models/Book.js';
import BookCopy from '../models/BookCopy.js';
import Department from '../models/Department.js';
import csv from 'csv-parser';
import fs from 'fs';

// --- HELPER: GENERATE UNIQUE COPIES (The Fix) ---
// This function finds available slots (holes) or appends to the end
const generateUniqueCopies = async (bookId, isbn, startFrom, quantity) => {
    const copies = [];
    let added = 0;
    let iterator = 1;

    while (added < quantity) {
        // Calculate candidate number
        const candidateNum = `${isbn}-${startFrom + iterator}`;

        // Check if this specific copy ID already exists in DB
        const exists = await BookCopy.findOne({ copyNumber: candidateNum });

        if (!exists) {
            copies.push({
                book: bookId,
                copyNumber: candidateNum,
                status: 'Available'
            });
            added++;
        }
        // If exists, we just increment iterator and try the next number
        iterator++;
    }
    return copies;
};

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

        // 4. Generate Copies (Safe Check)
        // Even for new books, we use the safe generator just in case of orphan data
        const copies = await generateUniqueCopies(newBook._id, isbn, 0, quantity);

        if (copies.length > 0) {
            await BookCopy.insertMany(copies);
        }

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

// --- DELETE BOOK ---
export const deleteBook = async (req, res) => {
    try {
        const bookId = req.params.id;
        await BookCopy.deleteMany({ book: bookId });
        await Book.findByIdAndDelete(bookId);
        res.json({ message: "Book and all its copies deleted" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- BULK DELETE BOOKS ---
export const bulkDeleteBooks = async (req, res) => {
    try {
        const { bookIds } = req.body;
        if (!bookIds || bookIds.length === 0) return res.status(400).json({ message: "No books selected" });

        await BookCopy.deleteMany({ book: { $in: bookIds } });
        await Book.deleteMany({ _id: { $in: bookIds } });
        res.status(200).json({ message: `${bookIds.length} books and their copies deleted.` });
    } catch (error) {
        res.status(500).json({ message: "Bulk delete failed", error: error.message });
    }
};

// --- UPLOAD CSV (Robust) ---
export const uploadBookCSV = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const results = [];
    const errors = [];
    let addedCount = 0;
    let updatedCount = 0;

    const allDepts = await Department.find();
    const validDeptCodes = allDepts.map(d => d.code.toUpperCase());

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            for (const row of results) {
                const title = row.Title || row.title;
                const author = row.Author || row.author;
                const isbn = row.ISBN || row.isbn;
                const dept = row.Department || row.department;
                const quantity = parseInt(row.Quantity || row.quantity || 1);

                if (!isbn || !title) {
                    errors.push(`Row missing ISBN or Title`);
                    continue;
                }

                if (!dept || !validDeptCodes.includes(dept.toUpperCase())) {
                    errors.push(`ISBN ${isbn}: Invalid/Missing Department '${dept}'.`);
                    continue;
                }

                try {
                    let book = await Book.findOne({ isbn });
                    let isNew = false;

                    if (book) {
                        updatedCount++;
                    } else {
                        isNew = true;
                        book = new Book({
                            title, author, isbn,
                            department: dept.toUpperCase(),
                            totalCopies: 0,
                            availableCopies: 0
                        });
                        await book.save();
                        addedCount++;
                    }

                    // Safe Copy Generation
                    // We pass book.totalCopies as the starting point, but the helper will skip collisions
                    const copiesToInsert = await generateUniqueCopies(book._id, isbn, book.totalCopies, quantity);

                    if (copiesToInsert.length > 0) {
                        await BookCopy.insertMany(copiesToInsert);
                        book.totalCopies += copiesToInsert.length;
                        book.availableCopies += copiesToInsert.length;
                        await book.save();
                    }

                } catch (err) {
                    errors.push(`ISBN ${isbn}: ${err.message}`);
                }
            }

            fs.unlinkSync(req.file.path);
            res.json({ message: "Process Complete", added: addedCount, updated: updatedCount, errors });
        });
};

// --- COPY MANAGEMENT ---
export const getBookCopies = async (req, res) => {
    try {
        const copies = await BookCopy.find({ book: req.params.bookId });
        res.json(copies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ✅ FIX: "Smart" Add Copies
export const addCopies = async (req, res) => {
    try {
        const { bookId, count, quantity } = req.body;
        const amountToAdd = parseInt(quantity || count);

        if (!amountToAdd || isNaN(amountToAdd) || amountToAdd < 1) {
            return res.status(400).json({ message: "Invalid quantity provided" });
        }

        const book = await Book.findById(bookId);
        if (!book) return res.status(404).json({ message: "Book not found" });

        // Use the smart helper to find free slots
        const copies = await generateUniqueCopies(book._id, book.isbn, book.totalCopies, amountToAdd);

        if (copies.length > 0) {
            await BookCopy.insertMany(copies);

            // Update counts
            book.totalCopies = (book.totalCopies || 0) + copies.length;
            book.availableCopies = (book.availableCopies || 0) + copies.length;
            await book.save();
        }

        res.json({ message: `${copies.length} Copies Added` });
    } catch (error) {
        console.error("Add Copies Error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const deleteCopy = async (req, res) => {
    try {
        const copy = await BookCopy.findById(req.params.id);
        if (!copy) return res.status(404).json({ message: "Copy not found" });

        const book = await Book.findById(copy.book);
        await BookCopy.findByIdAndDelete(req.params.id);

        if (book) {
            book.totalCopies = Math.max(0, book.totalCopies - 1);
            if (copy.status === 'Available') {
                book.availableCopies = Math.max(0, book.availableCopies - 1);
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

        if (copy.status === 'Available' && status !== 'Available') {
            book.availableCopies = Math.max(0, book.availableCopies - 1);
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