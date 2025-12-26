import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
    name: { type: String, required: true }, // e.g., "Computer Science"
    code: { type: String, required: true, unique: true } // e.g., "CS"
});

export default mongoose.model('Department', departmentSchema);