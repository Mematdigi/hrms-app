const mongoose = require('mongoose');

/**
 * Leave — represents a single leave REQUEST.
 * Balance tracking is done in LeaveBalance model + aggregation.
 * Do NOT store running balance here — it causes the calculation bugs.
 */
const leaveSchema = new mongoose.Schema({
  employee: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },
  // After the `employee` field:
  employeePhone: { type: String, default: '' },

  leaveType: {
    type:     String,
    enum:     ['sick', 'casual', 'short', 'half', 'earned', 'maternity', 'paternity', 'unpaid', 'holidays', 'Initial Allocation'],
    required: true
  },

  // Leave duration
  startDate:    { type: Date,   default: null },
  endDate:      { type: Date,   default: null },
  // numberOfDays: 0 for short leave, 0.5 for half day, whole numbers for full-day leaves
  numberOfDays: { type: Number, default: 0    },

  // Request details
  reason:   { type: String, default: '' },
  category: { type: String, enum: ['Prob', 'Full', 'Intern'], default: 'Full' },
  fromTime: { type: String, default: null },  // for Short / Half Day leave (optional)
  toTime:   { type: String, default: null },  // for Short / Half Day leave (optional)

  // Half day specific: which half of the day
  // 'first' = morning half, 'second' = afternoon half
  halfDayPeriod: { type: String, enum: ['first', 'second', null], default: null },

  // Status lifecycle: pending → approved / rejected
  status: {
    type:    String,
    enum:    ['pending', 'approved', 'rejected', 'left'],
    default: 'pending'
  },

  // Medical document
  medicalDocumentSubmitted: { type: Boolean, default: false },

  // Approval info
  approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalDate:    { type: Date   },
  rejectionReason: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Leave', leaveSchema);