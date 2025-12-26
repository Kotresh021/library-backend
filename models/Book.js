import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema({
    isbn: { type: String, required: true, index: true },
    title: { type: String, required: true },
    author: { type: String, required: true },
    department: { type: String, required: true },

    // --- NEW FIELDS ---
    publisher: { type: String },
    price: { type: Number },
    // ------------------

    totalCopies: { type: Number, default: 0 },
    availableCopies: { type: Number, default: 0 },
    ebookLink: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },

});

export default mongoose.model('Book', bookSchema);