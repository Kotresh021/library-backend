import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
    // Existing Fields
    finePerDay: { type: Number, default: 5 },
    issueDaysLimit: { type: Number, default: 15 },
    maxBooksPerStudent: { type: Number, default: 3 },

    // ✅ NEW: Rules Text (Array of strings for bullet points)
    libraryRules: {
        type: [String],
        default: [
            "ID Card is mandatory for entering the library.",
            "Books must be returned on or before the due date.",
            "Silence must be maintained at all times.",
            "Damaged or lost books must be replaced or paid for."
        ]
    }
}, { timestamps: true });

export default mongoose.model('SystemConfig', systemConfigSchema);