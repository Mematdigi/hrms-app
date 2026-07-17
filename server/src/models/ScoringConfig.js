const mongoose = require('mongoose');

/**
 * ScoringConfig — single admin-editable document holding EVERY weight used by
 * the scoring engine, so HR/Admin can re-tune any rule from the UI without a
 * code change or redeploy.
 *
 * ── Documented default interpretations of ambiguous spec rules ──────────────
 * 1. "Late coming −0.5 points (3 day)"  → interpreted as −0.5 PER GROUP OF 3
 *    late arrivals in the month (floor(lateCount / lateGroupSize) × latePenalty).
 *    Flip `lateMode` to 'flat-after-threshold' for the other reading
 *    (a single −0.5 once lateCount ≥ 3).
 * 2. "Half day (unpaid): +1 Point" is listed in the source spec under the
 *    "No Leaves Taken" bucket even though it is a leave event. Implemented as a
 *    SIGNED configurable value (default +1 per spec) — set it to a negative
 *    number to flip it to a deduction without any code change.
 * 3. Nakshatra period defaults to the calendar year (12 × 100 = 1200 base).
 */
const scoringConfigSchema = new mongoose.Schema({
  // There is only ever one active config doc
  key: { type: String, default: 'default', unique: true },

  // ── Bucket caps ────────────────────────────────────────────────────────────
  taskSheetMax:      { type: Number, default: 50 },
  behaviourMax:      { type: Number, default: 10 },
  attendanceMax:     { type: Number, default: 20 },
  recommendationMax: { type: Number, default: 20 },
  // When true (default), each bucket is clamped to [0, bucketMax]
  clampBuckets:      { type: Boolean, default: true },

  // ── Task bucket (50) — data comes from TL-created TaskReport docs ──────────
  // (Employees do NOT fill task sheets; the Team Lead logs totalTasks +
  //  completedTasks per team member per date range.)
  incompleteTaskPenalty:   { type: Number, default: -2 }, // per incomplete task (total − completed)
  unfilledSheetDayPenalty: { type: Number, default: -1 }, // per working day NOT covered by any TL task report

  // ── Behaviour (10) ──────────────────────────────────────────────────────────
  negFeedbackEmployee: { type: Number, default: -1 },
  negFeedbackTL:       { type: Number, default: -2 },
  negFeedbackHR:       { type: Number, default: -2 },
  negFeedbackManager:  { type: Number, default: -4 },

  // ── Leaves & Punctuality (20) ──────────────────────────────────────────────
  latePenalty:   { type: Number, default: -0.5 },
  lateGroupSize: { type: Number, default: 3 },
  lateMode:      { type: String, enum: ['per-group', 'flat-after-threshold'], default: 'per-group' },
  unpaidHalfDayPoints:  { type: Number, default: 1 },  // signed — see note 2 above
  unpaidFullDayPenalty: { type: Number, default: -2 }, // per occurrence

  // ── Recommendations & Conduct (20) ─────────────────────────────────────────
  recommendationTL:      { type: Number, default: 5 },
  recommendationManager: { type: Number, default: 10 },
  recommendationHR:      { type: Number, default: 5 },
  dressCodePoints:       { type: Number, default: 5 }, // when followed across the month's weekly reports

  // ── Nakshatra Award ────────────────────────────────────────────────────────
  nakshatraTarget:          { type: Number, default: 1200 },
  employeeOfMonthBonus:     { type: Number, default: 20 },
  weekendClientMeetingBonus:{ type: Number, default: 10 }, // per occurrence
  // Award period (configurable window; default = current calendar year)
  nakshatraPeriodStart: { type: Date, default: null }, // null → Jan 1 of current year
  nakshatraPeriodEnd:   { type: Date, default: null }, // null → Dec 31 of current year

  // ── Misc ───────────────────────────────────────────────────────────────────
  // Tie-break for Employee of the Month: 'fewest-negative-feedback' | 'earliest-joiner'
  tieBreak: { type: String, enum: ['fewest-negative-feedback', 'earliest-joiner'], default: 'fewest-negative-feedback' },
  // TL Weekly Report edit window (days after submission during which TL can edit)
  weeklyReportEditWindowDays: { type: Number, default: 3 },

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

/** Get (or lazily create) the single active config document. */
scoringConfigSchema.statics.getConfig = async function () {
  let cfg = await this.findOne({ key: 'default' });
  if (!cfg) cfg = await this.create({ key: 'default' });
  return cfg;
};

module.exports = mongoose.model('ScoringConfig', scoringConfigSchema);
