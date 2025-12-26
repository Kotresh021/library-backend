import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import connectDB from './config/db.js';

// Load env vars
dotenv.config();

// Connect to DB
connectDB();

const importData = async () => {
    try {
        // 1. Check if an admin already exists to prevent duplicates
        const existingAdmin = await User.findOne({ role: 'admin' });

        if (existingAdmin) {
            console.log('⚠️ Admin already exists. Seeding skipped.');
            process.exit();
        }

        // 2. Hash the password (REQUIRED because authController compares hashes)
        const salt = await bcrypt.genSalt(10);
        // Change 'admin123' to whatever default password you want
        const hashedPassword = await bcrypt.hash('admin123', salt);

        // 3. Define Admin Object
        const adminUser = {
            name: 'Super Admin',
            email: 'admin@gmail.com', // Default Email
            password: hashedPassword,
            role: 'admin',
            isActive: true,
            isFirstLogin: false, // Set to false so they aren't prompted to change pass immediately
            department: 'Administration'
        };

        // 4. Insert into DB
        await User.create(adminUser);

        console.log('✅ Admin User Imported Successfully!');
        console.log('📧 Email: admin@gmail.com');
        console.log('🔑 Password: admin123');

        process.exit();
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
};

const destroyData = async () => {
    try {
        // Optional: clear all users (Use with caution)
        await User.deleteMany();
        console.log('🔴 Data Destroyed!');
        process.exit();
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
};

// Handle command line arguments
if (process.argv[2] === '-d') {
    destroyData();
} else {
    importData();
}