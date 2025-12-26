import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    registerNumber: { type: String, unique: true, sparse: true },

    // --- CONTACT INFO ---
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    address: { type: String },
    // --------------------

    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin', 'staff'], default: 'student' },

    // Personal Details
    dob: { type: Date },
    department: { type: String },
    semester: { type: String },

    // Status Flags
    isFirstLogin: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },

    // Password Reset
    resetPasswordOtp: { type: String },
    resetPasswordExpires: { type: Date },

    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('User', userSchema);