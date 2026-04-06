const mongoose = require('mongoose');

const previousEmploymentSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  employeeName: { type: String, default: '' },
  department: { type: String, default: '' },
  designation: { type: String, default: '' },
  joiningDate: { type: Date, default: null },
  lastWorkingDay: { type: Date, default: null },
  exitType: {
    type: String,
    enum: ['Resignation', 'Termination', 'Retirement', 'Contract End', 'Layoff', 'Absconding', 'Other', ''],
    default: ''
  },
  reasonForExit: { type: String, default: '' },
  managerName: { type: String, default: '' },
  noticePeriodServed: {
    type: String,
    enum: ['Yes', 'No', 'Partial', ''],
    default: ''
  },
  finalSettlementDone: {
    type: String,
    enum: ['Yes', 'No', 'Pending', ''],
    default: ''
  },
  fnfDate: { type: Date, default: null },
  exitInterviewDate: { type: Date, default: null },
  companyAssetsReturned: {
    type: String,
    enum: ['Yes', 'No', 'Partial', ''],
    default: ''
  },
  hrRepresentative: { type: String, default: '' },
  remarks: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('PreviousEmployment', previousEmploymentSchema);