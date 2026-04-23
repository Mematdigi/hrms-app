const mongoose = require('mongoose');

/**
 * LeaveDefaults — global defaults applied when creating a new employee's LeaveBalance.
 * Only ONE document should exist in this collection.
 */
const leaveDefaultsSchema = new mongoose.Schema({
  casualDefault:    { type: Number, default: 8   },  // casual leave days/year
  sickDefault:      { type: Number, default: 6   },  // sick leave days/year
  earnedDefault:    { type: Number, default: 14  },  // earned/annual leave days/year
  maternityDefault: { type: Number, default: 90  },  // maternity leave days
  paternityDefault: { type: Number, default: 15  },  // paternity leave days
  shortLeaveDefault:  { type: Number, default: 3   },  // short leaves per month
  halfDayDefault:   { type: Number, default: 12  },  // half-day leaves per year (each counts as 0.5 day)

  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LeaveDefaults', leaveDefaultsSchema);