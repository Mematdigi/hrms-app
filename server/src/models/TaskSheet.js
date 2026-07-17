const mongoose = require('mongoose');

/**
 * TaskSheet — one document per employee per day.
 * Feeds the scoring engine's Task Sheet bucket (50 pts):
 *   +50 baseline when filled & all tasks completed
 *   −2 per incomplete task
 *   −1 per day not filled at all (computed by the scoring job from missing docs)
 */
const taskSheetSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String },

  // The working date this sheet covers (normalized to 00:00)
  date: { type: Date, required: true },

  tasks: [{
    title:  { type: String, required: true },
    status: { type: String, enum: ['completed', 'incomplete', 'pending'], default: 'pending' },
    remark: { type: String, default: '' },
  }],

  // True once the employee submits (a sheet can exist as a draft)
  filled:      { type: Boolean, default: false },
  submittedAt: { type: Date },

  // TL/HR review (optional, read-only workflow like Regularization HR-view)
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewNote: { type: String, default: '' },
}, { timestamps: true });

taskSheetSchema.index({ employee: 1, date: 1 }, { unique: true });
taskSheetSchema.index({ date: 1 });

taskSheetSchema.pre('save', async function (next) {
  if (!this.username && this.employee) {
    try {
      const User = mongoose.model('User');
      const user = await User.findById(this.employee);
      if (user) this.username = `${user.firstName} ${user.lastName}`;
    } catch (error) {
      console.error('Error setting username in task sheet:', error);
    }
  }
  next();
});

module.exports = mongoose.model('TaskSheet', taskSheetSchema);
