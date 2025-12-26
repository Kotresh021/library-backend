import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who did it?
    actorName: { type: String }, // Snapshot of name in case user is deleted later
    action: { type: String, required: true }, // e.g. "LOGIN", "ISSUE_BOOK"
    details: { type: String }, // e.g. "Issued Harry Potter to Rahul"
    ip: { type: String },
}, { timestamps: true }); // Automatically adds createdAt (Time)

export default mongoose.model('AuditLog', auditLogSchema);