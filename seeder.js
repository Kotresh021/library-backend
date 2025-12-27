import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js'; // Ensure this path matches your User model

// 👇 PASTE YOUR MONGODB ATLAS CONNECTION STRING HERE
// (The one that looks like: mongodb+srv://admin:password@cluster...)
const MONGO_URI = "mongodb+srv://GPTKampli:KbhOG69CVT5w0AK4@clusterlms.cblwjgx.mongodb.net/?appName=ClusterLMS";

const createAdmin = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to MongoDB Atlas...");

        // 1. Check if admin already exists
        const existingAdmin = await User.findOne({ email: "admin@gmail.com" });
        if (existingAdmin) {
            console.log("⚠️ Admin already exists!");
            process.exit();
        }

        // 2. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("123456", salt);

        // 3. Create Admin
        const adminUser = new User({
            name: "Super Admin",
            email: "admin@gmail.com",
            password: hashedPassword,
            role: "admin",
            registerNumber: "ADMIN01", // Dummy value to pass validation
            department: "Library"      // Dummy value
        });

        await adminUser.save();
        console.log("🎉 SUCCESS! Admin Created.");
        console.log("📧 Email: admin@gmail.com");
        console.log("🔑 Password: 123456");

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        mongoose.disconnect();
    }
};

createAdmin();