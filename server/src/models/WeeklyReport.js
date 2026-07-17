const mongoose = require('mongoose');

/**
 * WeeklyReport — submitted by a Team Lead, one document per (team member, week).
 *
 * Feeds the scoring engine:
 *   dressCodeFollowed         → +dressCode points (default +5, once per month if consistently true)
 *   negativeFeedbackFlag      → auto-creates a Feedback doc (givenByRole: 'tl', −2 by default)
 *   recommendation            → auto-creates a Recommendation doc (byRole: 'tl', +5 by default)
 *   weekendClientMeeting      → Nakshatra bonus (+10 per occurrence by default)
 *
 * HR/Manager get a read-only audit view — they can annotate (hrNote) but never
 * silently alter the TL's original input (TL accountability).
 */
const weeklyReportSchema = new mongoose.Schema({
  teamLead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeName: { type: String },

  weekStartDate: { type: Date, required: true }, // Monday, normalized to start of day
  weekEndDate:   { type: Date, required: true },

  dressCodeFollowed:    { type: Boolean, default: true },
  behaviourNotes:       { type: String, default: '' },
  negativeFeedbackFlag: { type: Boolean, default: false },

  // The TL's recommendation TEXT. Empty string = no recommendation given.
  // (This is a String, not a Boolean: the UI is a textarea, and the text becomes
  //  the `comment` on the auto-created Recommendation doc. A bare boolean would
  //  throw the recommendation's actual content away.)
  recommendation:       { type: String, default: '' },

  weekendClientMeeting: {
    occurred: { type: Boolean, default: false },
    count:    { type: Number, default: 0, min: 0 },
  },

  // Links to the auto-created docs so edits inside the edit window stay in sync
  linkedFeedback:       { type: mongoose.Schema.Types.ObjectId, ref: 'Feedback', default: null },
  linkedRecommendation: { type: mongoose.Schema.Types.ObjectId, ref: 'Recommendation', default: null },

  status: { type: String, enum: ['submitted', 'reviewed'], default: 'submitted' },

  // HR/Manager annotation only — original TL fields are never altered by HR
  hrNote:      { type: String, default: '' },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:  { type: Date, default: null },
}, { timestamps: true });

// One report per TL per employee per week
weeklyReportSchema.index({ teamLead: 1, employee: 1, weekStartDate: 1 }, { unique: true });
weeklyReportSchema.index({ employee: 1, weekStartDate: 1 });

module.exports = mongoose.model('WeeklyReport', weeklyReportSchema);