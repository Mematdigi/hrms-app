const mongoose = require('mongoose');

/**
 * LeaveBalance — stores the TOTAL/ALLOCATED leave per employee per year.
 * Actual USED values are computed dynamically by aggregating approved Leave records.
 *
 * One document per employee per year.
 */
const leaveBalanceSchema = new mongoose.Schema({
  employee: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },
  year: {
    type:     Number,
    required: true,
    default:  () => new Date().getFullYear()
  },

  // Allocated totals for this employee for this year
  casualTotal:    { type: Number, default: 8  },
  sickTotal:      { type: Number, default: 6  },
  earnedTotal:    { type: Number, default: 14 },
  maternityTotal: { type: Number, default: 90 }, // days
  paternityTotal: { type: Number, default: 15 },
  unpaidTotal:    { type: Number, default: 0  }, // unlimited — track separately
  shortLeaveTotal:{ type: Number, default: 3  }, // per month
  halfDayTotal:   { type: Number, default: 12 }, // half-day leaves per year (each = 0.5 day)

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Unique per employee per year
leaveBalanceSchema.index({ employee: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);