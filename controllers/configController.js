import SystemConfig from '../models/SystemConfig.js';
import { logAudit } from './auditController.js';

// Get Current Rules
export const getConfig = async (req, res) => {
    try {
        // Find the first config doc, or create one if it doesn't exist
        let config = await SystemConfig.findOne();
        if (!config) {
            config = await SystemConfig.create({});
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update Rules
export const updateConfig = async (req, res) => {
    try {
        const { finePerDay, issueDaysLimit, maxBooksPerStudent } = req.body;

        // Update the single config document
        const config = await SystemConfig.findOneAndUpdate({}, {
            finePerDay,
            issueDaysLimit,
            maxBooksPerStudent
        }, { new: true, upsert: true }); // upsert = create if not exists

        if (req.user) await logAudit(req.user._id, 'UPDATE_SETTINGS', `Updated System Rules`);

        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};