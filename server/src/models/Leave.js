const mongoose = require('mongoose');
const leaveSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // reference to User model or employee model
  leaveType: { type: String, enum: ['sick', 'casual', 'earned', 'maternity', 'paternity', 'unpaid','holidays','Initial Allocation'], required: true },
  casualLeave: { type: Number, default: 8 },
  sickLeave: { type: Number, default: 6 },
  earnedLeave: { type: Number, default: 0 },
  maternityLeave: { type: Number, default: 0 },
  paternityLeave: { type: Number, default: 0 },
  startDate: { type: Date,default:null},
  endDate: { type: Date, default: null,default:null },
  numberOfDays: { type: Number, default: 0 },
  reason: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected','left'], default: 'left' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalDate: { type: Date },
  rejectionReason: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Leave', leaveSchema);
