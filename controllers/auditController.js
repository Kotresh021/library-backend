import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';

// --- INTERNAL HELPER (To be used by other controllers) ---
export const logAudit = async (actorId, action, details, ip = '0.0.0.0') => {
    try {
        const user = await User.findById(actorId);
        await AuditLog.create({
            actor: actorId,
            actorName: user ? user.name : 'Unknown',
            action,
            details,
            ip
        });
    } catch (error) {
        console.error("Audit Log Error:", error); // Don't crash app if logging fails
    }
};

// --- API ENDPOINT (For Admin Dashboard) ---
// @desc    Get All Logs
// @route   GET /api/audit
export const getAuditLogs = async (req, res) => {
    try {
        const logs = await AuditLog.find()
            .sort({ createdAt: -1 }) // Newest first
            .limit(100); // Limit to last 100 events
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};