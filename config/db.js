import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // Initialize Default Config if not exists
        await initConfig();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

// Helper to set default fine if DB is empty
import SystemConfig from '../models/SystemConfig.js';
const initConfig = async () => {
    const fineConfig = await SystemConfig.findOne({ key: 'FINE_PER_DAY' });
    if (!fineConfig) {
        await SystemConfig.create({
            key: 'FINE_PER_DAY',
            value: '10', // Default 10 Rupees
            description: 'Fine amount in currency per day'
        });
        console.log('System Config Initialized: Default Fine set to 10');
    }
};

export default connectDB;