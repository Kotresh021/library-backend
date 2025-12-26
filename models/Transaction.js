import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    copyId: { type: String, required: true }, // e.g. "978-123-1"

    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date }, // Null until returned

    // 🔒 STRICT ENUM: Only 'Issued' or 'Returned' allowed
    status: {
        type: String,
        enum: ['Issued', 'Returned'],
        default: 'Issued',
        required: true
    },

    fine: { type: Number, default: 0 },
    fineReason: { type: String },
    isFinePaid: { type: Boolean, default: false }

}, { timestamps: true });

export default mongoose.model('Transaction', transactionSchema);