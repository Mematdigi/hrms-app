const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  employee: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },
  leaveType: {
    type:     String,
    // ✅ All lowercase to match what frontend sends
    enum:     ['sick', 'casual', 'earned', 'maternity', 'paternity', 'unpaid', 'holidays', 'Initial Allocation'],
    required: true
  },
  // Leave balance fields (carry remaining balance per record)
  casualLeave:    { type: Number, default: 8 },
  sickLeave:      { type: Number, default: 6 },
  earnedLeave:    { type: Number, default: 0 },
  maternityLeave: { type: Number, default: 0 },
  paternityLeave: { type: Number, default: 0 },

  startDate:   { type: Date,   default: null },
  endDate:     { type: Date,   default: null },
  numberOfDays:{ type: Number, default: 0    },
  reason:      { type: String, default: ''   },

  // ✅ FIX: Default status should be 'pending' for new applications
  // 'left' is a special marker for records created when employee leaves the company
  status: {
    type:    String,
    enum:    ['pending', 'approved', 'rejected', 'left'],
    default: 'pending'
  },

  // Short Leave extras
  category: { type: String, enum: ['Short', 'Full'], default: 'Full' },
  fromTime:  { type: String, default: null },
  toTime:    { type: String, default: null },

  approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalDate:    { type: Date },
  rejectionReason: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Leave', leaveSchema);