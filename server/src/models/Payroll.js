const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to User model and  works as employee id 
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  baseSalary: { type: Number, required: true },
  workedDays: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  workingDays: { type: Number, default: 24 },
  netSalary: { type: Number, required: true },
  status: { type: String, enum: ['draft', 'processed', 'paid'], default: 'draft' },
  paidDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
