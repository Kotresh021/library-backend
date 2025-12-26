import mongoose from 'mongoose';

const bookCopySchema = new mongoose.Schema({
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    copyNumber: { type: String, required: true, unique: true }, // e.g. "978-013-1"
    status: {
        type: String,
        enum: ['Available', 'Issued', 'Damaged', 'Lost', 'Reserved'],
        default: 'Available'
    }
}, { timestamps: true });

export default mongoose.model('BookCopy', bookCopySchema);