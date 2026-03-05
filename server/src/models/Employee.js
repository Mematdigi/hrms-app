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
    type: String,
    default: ''
  },
  currentAddress: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    required: true
  },
  department: {
    type: String,
    default: ''
  },
  designation: {
    type: String,
    default: ''
  },
  dateOfJoining: {
    type: Date,
    default: null
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  lastWorkingDay: {
    type: Date,
    default: null
  },
  baseSalary: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Full Time', 'Internship'],
    default: 'Full Time'
  },
  periodType: {
    type: String,
    enum: ['Probation', 'Permanent', 'Contractual'],
    default: 'Permanent'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    default: 'employee'
  },

  // Gender — NO enum so empty string / any value is accepted
  gender: {
    type: String,
    default: ''
  },
  maritalStatus: {
    type: String,
    default: ''
  },
  nationality: {
    type: String,
    default: ''
  },

  // Identity
  panNumber: {
    type: String,
    default: ''
  },
  aadharNumber: {
    type: String,
    default: ''
  },

  // Work Mode
  workMode: {
    type: String,
    enum: ['Work From Office', 'Work From Home', 'Hybrid'],
    default: 'Work From Office'
  },

  // Bank Details
  bankName: {
    type: String,
    default: ''
  },
  bankAccountNumber: {
    type: String,
    default: ''
  },
  ifscCode: {
    type: String,
    default: ''
  },

  // Emergency Contact
  emergencyContactName: {
    type: String,
    default: ''
  },
  emergencyContactPhone: {
    type: String,
    default: ''
  },
  emergencyContactRelation: {
    type: String,
    default: ''
  },

  // Document Paths
  profilePhoto: { type: String, default: null },
  documents: {
    adharCard: { type: String, default: null },
    panCard: { type: String, default: null },
    salarySlip: { type: String, default: null },
    relievingLetter: { type: String, default: null },
    experienceLetter: { type: String, default: null },
    offerLetter: { type: String, default: null }
  }
}, { timestamps: true });

// Pre-save hook to hash password
employeeSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

module.exports = mongoose.model('Employee', employeeSchema);