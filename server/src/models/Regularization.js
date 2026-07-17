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
  reviewedAt: { type: Date }
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