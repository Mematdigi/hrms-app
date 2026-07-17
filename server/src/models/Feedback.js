const mongoose = require('mongoose');

/**
 * Feedback — behaviour feedback log used by the Behaviour bucket (10 pts).
 *
 * Negative feedback deductions (defaults, all configurable in ScoringConfig):
 *   by peer employee → −1     by TL → −2     by HR → −2     by Manager → −4
 *
 * givenByRole is a SNAPSHOT of the giver's role at the time of entry — roles can
 * change later, and scoring must use the role that applied when feedback was given.
 */
const feedbackSchema = new mongoose.Schema({
  employee:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  givenBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  givenByRole: { type: String, enum: ['employee', 'tl', 'hr', 'manager', 'admin'], required: true },
  sentiment:   { type: String, enum: ['positive', 'negative'], required: true },
  comment:     { type: String, default: '' },
  date:        { type: Date, default: Date.now },

  // Set when auto-created from a TL Weekly Report
  sourceWeeklyReport: { type: mongoose.Schema.Types.ObjectId, ref: 'WeeklyReport', default: null },
}, { timestamps: true });

feedbackSchema.index({ employee: 1, date: 1 });
feedbackSchema.index({ employee: 1, sentiment: 1, date: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
