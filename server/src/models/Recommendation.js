const mongoose = require('mongoose');

/**
 * Recommendation — positive recommendations, part of the
 * Recommendations & Conduct bucket (20 pts).
 *
 * Defaults (configurable in ScoringConfig):
 *   by TL → +5     by Manager → +10     by HR → +5
 *
 * recommendedByRole is a snapshot at the time of entry (roles can change later).
 */
const recommendationSchema = new mongoose.Schema({
  employee:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recommendedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recommendedByRole: { type: String, enum: ['tl', 'hr', 'manager', 'admin'], required: true },
  comment:           { type: String, default: '' },
  date:              { type: Date, default: Date.now },

  // Set when auto-created from a TL Weekly Report
  sourceWeeklyReport: { type: mongoose.Schema.Types.ObjectId, ref: 'WeeklyReport', default: null },
}, { timestamps: true });

recommendationSchema.index({ employee: 1, date: 1 });

module.exports = mongoose.model('Recommendation', recommendationSchema);
