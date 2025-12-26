import mongoose from 'mongoose';

const feedbackSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    reply: { type: String }, // Staff/Admin reply
    replyBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who replied?
    isResolved: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Feedback', feedbackSchema);