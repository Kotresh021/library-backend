import Department from '../models/Department.js';

// @desc    Get All Departments
export const getDepartments = async (req, res) => {
    try {
        const depts = await Department.find({});
        res.json(depts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add Department
export const addDepartment = async (req, res) => {
    const { name, code } = req.body;
    try {
        const exists = await Department.findOne({ code });
        if (exists) return res.status(400).json({ message: 'Department code already exists' });

        const dept = await Department.create({ name, code });
        res.status(201).json(dept);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete Department
export const deleteDepartment = async (req, res) => {
    try {
        await Department.findByIdAndDelete(req.params.id);
        res.json({ message: 'Department removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};