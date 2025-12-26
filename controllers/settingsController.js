import SystemConfig from '../models/SystemConfig.js';

// @desc    Get All System Settings & Rules
// @route   GET /api/settings
export const getSettings = async (req, res) => {
    try {
        let config = await SystemConfig.findOne();
        if (!config) config = await SystemConfig.create({}); // Create default if missing
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Rules (Admin Only)
// @route   PUT /api/settings/rules
export const updateRules = async (req, res) => {
    const { rules } = req.body; // Expecting an array of strings
    try {
        let config = await SystemConfig.findOne();
        if (!config) config = await SystemConfig.create({});

        config.libraryRules = rules;
        await config.save();

        res.json({ message: "Library Rules Updated", rules: config.libraryRules });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Config (Fines/Limits) - keeping this ready for later
export const updateConfig = async (req, res) => {
    const { finePerDay, issueDaysLimit, maxBooksPerStudent } = req.body;
    try {
        let config = await SystemConfig.findOne();
        if (!config) config = await SystemConfig.create({});

        if (finePerDay !== undefined) config.finePerDay = finePerDay;
        if (issueDaysLimit !== undefined) config.issueDaysLimit = issueDaysLimit;
        if (maxBooksPerStudent !== undefined) config.maxBooksPerStudent = maxBooksPerStudent;

        await config.save();
        res.json({ message: "System Configuration Updated", config });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};