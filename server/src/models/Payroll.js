const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  month:       { type: Number, required: true, min: 1, max: 12 },
  year:        { type: Number, required: true },
  baseSalary:  { type: Number, required: true, default: 0 },
  workedDays:  { type: Number, default: 0 },
  deductions:  { type: Number, default: 0 },
  workingDays: { type: Number, default: 26 },  // Actual Mon-Sat days computed per month
  netSalary:   { type: Number, required: true, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'processed', 'paid'],
    default: 'draft'
  },
  paidDate:  { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// One record per employee per month per year
payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);