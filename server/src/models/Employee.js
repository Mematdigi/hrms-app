const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  contact: {
    type: String,
    required: true
  },
  address: {
    type: String
  },
  password: {
    type: String,
    required: true
  },
  department: {
    type: String
  },
  designation: {
    type: String
  },
  dateOfJoining: {
    type: Date
  },
  baseSalary: {
    type: Number
  },
  status: {
    type: String,
    enum: ['Full Time', 'Probation', 'Internship'],
    default: 'Full Time'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    default: 'employee' // Default role
  },
  
  // Document Paths (Storing URLs/Paths)
  profilePhoto: { type: String },
  documents: {
    adharCard: { type: String },
    panCard: { type: String },
    salarySlip: { type: String },
    relievingLetter: { type: String },
    experienceLetter: { type: String },
    offerLetter: { type: String }
  }
}, { timestamps: true });

// Pre-save hook to hash password
employeeSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

module.exports = mongoose.model('Employee', employeeSchema);