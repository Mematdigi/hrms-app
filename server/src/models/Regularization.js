const mongoose = require('mongoose');

const regularizationSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String },

  // The attendance date the employee wants regularized
  date: { type: Date, required: true },

  // Why the employee is requesting regularization
  reason: { type: String, required: true },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  // Filled in only when HR rejects
  rejectionReason: { type: String },

  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },

  // ── Audit trail: what the attendance record looked like BEFORE HR approved
  // this request, and what HR set it to. Populated only at approval time —
  // lets HR (and the employee) see "old vs new" later by clicking the
  // regularization icon on the attendance table. ──────────────────────────
  previousAttendance: {
    existed:      { type: Boolean, default: false }, // false = no attendance record existed for that date at all
    checkInTime:  { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    status:       { type: String, default: null },
    workingHours: { type: Number, default: null }
  },
  newAttendance: {
    checkInTime:  { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    status:       { type: String, default: null },
    workingHours: { type: Number, default: null }
  }
}, { timestamps: true });

// Fast lookups: "my requests", "all pending requests", "requests for this date"
regularizationSchema.index({ employee: 1, date: 1 });
regularizationSchema.index({ status: 1 });

regularizationSchema.pre('save', async function (next) {
  if (!this.username && this.employee) {
    try {
      const User = mongoose.model('User');
      const user = await User.findById(this.employee);
      if (user) {
        this.username = `${user.firstName} ${user.lastName}`;
      }
    } catch (error) {
      console.error('Error setting username in regularization:', error);
    }
  }
  next();
});

module.exports = mongoose.model('Regularization', regularizationSchema);