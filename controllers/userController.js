import User from '../models/User.js';
import Department from '../models/Department.js';
import fs from 'fs';
import csv from 'csv-parser';
import bcrypt from 'bcryptjs';

// --- HELPER: SMART DATE PARSER ---
const parseDate = (dateStr) => {
    if (!dateStr) return null;

    // Check for DDMMYYYY (No separators) e.g., 15052005
    if (/^\d{8}$/.test(dateStr)) {
        const day = dateStr.substring(0, 2);
        const month = dateStr.substring(2, 4);
        const year = dateStr.substring(4, 8);
        return new Date(`${year}-${month}-${day}`);
    }

    // Check for DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyy = /^(\d{2})[-/](\d{2})[-/](\d{4})$/;
    if (ddmmyyyy.test(dateStr)) {
        const [, day, month, year] = dateStr.match(ddmmyyyy);
        return new Date(`${year}-${month}-${day}`);
    }

    return new Date(dateStr); // Fallback to standard
};

// --- HELPER: FORMAT DATE TO DDMMYYYY (For Password) ---
const formatDateForPassword = (dateObj) => {
    if (!dateObj || isNaN(dateObj)) return "123456"; // Fallback
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    return `${d}${m}${y}`; // Result: 15052005
};

// @desc    Create Student
export const createStudent = async (req, res) => {
    const { name, registerNumber, email, phone, address, department, semester, dob } = req.body;
    try {
        const userExists = await User.findOne({ registerNumber });
        if (userExists) return res.status(400).json({ message: 'Student ID already exists' });

        const emailExists = await User.findOne({ email });
        if (emailExists) return res.status(400).json({ message: 'Email already exists' });

        const dateObj = parseDate(dob);

        // PASSWORD LOGIC: DDMMYYYY
        const plainPassword = formatDateForPassword(dateObj);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(plainPassword, salt);

        const student = await User.create({
            name, registerNumber, email, phone, address, department, semester,
            password: hashedPassword,
            dob: dateObj,
            role: 'student', isFirstLogin: true
        });
        res.status(201).json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get All Students
export const getStudents = async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).select('-password').sort({ registerNumber: 1 });
        res.json(students);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// @desc    Update Single Student (NEW)
export const updateStudent = async (req, res) => {
    try {
        const { name, registerNumber, email, phone, address, department, semester, dob } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.name = name || user.name;
        user.registerNumber = registerNumber || user.registerNumber; // e.g. 172CS23021
        user.email = email || user.email;
        user.phone = phone || user.phone;
        user.address = address || user.address;
        user.department = department || user.department;
        user.semester = semester || user.semester;
        if (dob) user.dob = parseDate(dob);

        await user.save();
        res.json({ message: 'Updated', user });
    } catch (error) { res.status(500).json({ message: error.message }); }
};


// @desc    Upload CSV
export const uploadStudentCSV = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const validDepts = await Department.find().select('code');
    const validCodes = validDepts.map(d => d.code.toUpperCase());

    const results = [];
    const report = { success: 0, updated: 0, skipped: 0, errors: [] };

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {

            for (const row of results) {
                const RegisterNo = row.RegisterNo || row.registerNo; // e.g. 172CS23021
                const Name = row.Name || row.name;
                const Email = row.Email || row.email;
                const Phone = row.Phone || row.phone;
                const Address = row.Address || row.address;
                const DeptInput = row.Department || row.department;
                const Semester = row.Semester || row.semester;
                let DOB = row.DOB || row.dob;

                if (!RegisterNo || !Name || !DeptInput || !Email) {
                    report.errors.push(`Row missing data`);
                    continue;
                }

                if (!validCodes.includes(DeptInput.toUpperCase())) {
                    report.errors.push(`RegNo ${RegisterNo}: Invalid Dept '${DeptInput}'`);
                    continue;
                }

                try {
                    const dateObj = parseDate(DOB);
                    const existingUser = await User.findOne({ registerNumber: RegisterNo });

                    if (existingUser) {
                        // Update logic (simplified)
                        existingUser.name = Name;
                        existingUser.email = Email;
                        existingUser.department = DeptInput;
                        existingUser.semester = Semester;
                        if (dateObj) existingUser.dob = dateObj;
                        await existingUser.save();
                        report.updated++;
                    } else {
                        // Create New
                        const plainPassword = formatDateForPassword(dateObj); // DDMMYYYY
                        const salt = await bcrypt.genSalt(10);
                        const hashedPassword = await bcrypt.hash(plainPassword, salt);

                        await User.create({
                            name: Name, registerNumber: RegisterNo, email: Email, phone: Phone, address: Address,
                            password: hashedPassword,
                            role: 'student', dob: dateObj, department: DeptInput, semester: Semester, isFirstLogin: true
                        });
                        report.success++;
                    }
                } catch (err) {
                    report.errors.push(`Error ${RegisterNo}: ${err.message}`);
                }
            }

            fs.unlinkSync(req.file.path);
            res.json({ message: 'Process Complete', ...report });
        });
};

// @desc    Bulk Update
export const bulkStudentUpdate = async (req, res) => {
    const { studentIds, action } = req.body;
    try {
        if (action === 'delete') {
            await User.deleteMany({ _id: { $in: studentIds } });
            return res.json({ message: `Deleted.` });
        }
        if (action === 'activate') {
            await User.updateMany({ _id: { $in: studentIds } }, { $set: { isActive: true } });
            return res.json({ message: `Activated.` });
        }
        if (action === 'deactivate') {
            await User.updateMany({ _id: { $in: studentIds } }, { $set: { isActive: false } });
            return res.json({ message: `Deactivated.` });
        }
        if (action === '+1' || action === '-1') {
            const students = await User.find({ _id: { $in: studentIds } });
            let updatedCount = 0;
            const bulkOps = students.map(student => {
                let currentSem = parseInt(student.semester);
                let newSem = student.semester;
                if (action === '+1') {
                    if (!isNaN(currentSem)) {
                        if (currentSem < 6) newSem = (currentSem + 1).toString();
                        else if (currentSem === 6) newSem = 'Alumni';
                    }
                } else if (action === '-1') {
                    if (student.semester === 'Alumni') newSem = '6';
                    else if (!isNaN(currentSem) && currentSem > 1) {
                        newSem = (currentSem - 1).toString();
                    }
                }
                if (newSem !== student.semester) {
                    updatedCount++;
                    return { updateOne: { filter: { _id: student._id }, update: { semester: newSem } } };
                }
                return null;
            }).filter(op => op !== null);
            if (bulkOps.length > 0) await User.bulkWrite(bulkOps);
            return res.json({ message: `Promoted/Demoted ${updatedCount} students.` });
        }
        await User.updateMany({ _id: { $in: studentIds } }, { $set: { semester: action } });
        res.json({ message: `Updated ${studentIds.length} students to Sem ${action}` });
    } catch (error) {
        res.status(500).json({ message: 'Bulk update failed: ' + error.message });
    }
};

// @desc    Update User Profile (Change Password)
// @route   PUT /api/users/profile
export const updateUserProfile = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        // 1. Check if Old Password matches
        if (req.body.oldPassword && req.body.newPassword) {
            const isMatch = await bcrypt.compare(req.body.oldPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Incorrect old password' });
            }
            // 2. Hash & Set New Password
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(req.body.newPassword, salt);
            user.isFirstLogin = false; // Flag that they have secured their account
        }

        // (Optional) Update other fields if sent
        if (req.body.name) user.name = req.body.name;
        if (req.body.email) user.email = req.body.email;

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            token: req.body.token // Keep existing token
        });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc Get All Staff
export const getStaffList = async (req, res) => {
    const staff = await User.find({ role: 'staff' });
    res.json(staff);
};

// @desc Create Staff
export const createStaff = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ message: 'Email exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            name, email, password: hashedPassword, role: 'staff'
        });
        res.status(201).json(user);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// @desc Delete User (Generic)
export const deleteUser = async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
};

// @desc    Create a new Admin
// @route   POST /api/users/create-admin
export const createAdmin = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'User already exists' });

        const user = await User.create({
            name, email, password, role: 'admin' // Force role to admin
        });

        if (user) {
            res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get List of Admins
// @route   GET /api/users/admins
export const getAdmins = async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' }).select('-password');
        res.json(admins);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

