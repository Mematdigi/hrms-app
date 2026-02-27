const mongoose = require('mongoose');

const payslipRequestSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  payroll: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  hrResponse: {
    type: String,
    trim: true,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// One pending/approved request per employee per payroll at a time
// (they can re-request after rejection)
payslipRequestSchema.index({ employee: 1, payroll: 1, status: 1 });

module.exports = mongoose.model('PayslipReq', payslipRequestSchema);