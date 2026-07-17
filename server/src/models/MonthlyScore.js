const mongoose = require('mongoose');

/**
 * MonthlyScore — cached/computed snapshot of an employee's monthly score.
 *
 * This is what the Analytics page reads. The frontend NEVER recomputes live
 * from raw collections — the nightly scoring job (jobs/scoringJob.js) and the
 * manual POST /scoring/recalculate endpoint write these documents.
 *
 * Nakshatra Award: cumulative running total of monthly `totalPoints` across the
 * award period (default calendar year → 12 × 100 = 1200 base ceiling), PLUS
 * `bonusPoints` (Employee-of-the-Month +20, weekend client meeting +10 each)
 * added on top — bonuses are NOT capped by the 1200 base.
 */
const monthlyScoreSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month:    { type: Number, required: true, min: 1, max: 12 },
  year:     { type: Number, required: true },

  // Bucket scores (capped at bucket max, floored at 0 — configurable)
  taskSheetPoints:      { type: Number, default: 0 }, // /50
  behaviourPoints:      { type: Number, default: 0 }, // /10
  attendancePoints:     { type: Number, default: 0 }, // /20 (leaves & punctuality)
  recommendationPoints: { type: Number, default: 0 }, // /20 (recommendations & conduct)
  totalPoints:          { type: Number, default: 0 }, // /100

  // Nakshatra bonus points earned THIS month (EoM +20, weekend meetings +10 each)
  bonusPoints: { type: Number, default: 0 },

  isEmployeeOfMonth: { type: Boolean, default: false },
  // Locked at month-end by the scoring job — finalized months are never recomputed
  isFinalized:       { type: Boolean, default: false },

  // Raw counters kept for the data-driven "Area of Improvement" panel
  breakdown: {
    // Task data — sourced from TL-created TaskReport docs (employee never fills these)
    totalTasks:             { type: Number, default: 0 },
    completedTasks:         { type: Number, default: 0 },
    incompleteTasks:        { type: Number, default: 0 },
    taskCompletionRate:     { type: Number, default: 0 }, // %
    // Working days in the month the TL never covered with a task report
    unfilledTaskSheetDays:  { type: Number, default: 0 },
    lateArrivals:           { type: Number, default: 0 },
    unpaidHalfDays:         { type: Number, default: 0 },
    unpaidFullDayLeaves:    { type: Number, default: 0 },
    negativeFeedback: {
      employee: { type: Number, default: 0 },
      tl:       { type: Number, default: 0 },
      hr:       { type: Number, default: 0 },
      manager:  { type: Number, default: 0 },
    },
    recommendations: {
      tl:      { type: Number, default: 0 },
      hr:      { type: Number, default: 0 },
      manager: { type: Number, default: 0 },
    },
    dressCodeWeeksFollowed: { type: Number, default: 0 },
    dressCodeWeeksTotal:    { type: Number, default: 0 },
    weekendClientMeetings:  { type: Number, default: 0 },
    tookLeaveThisMonth:     { type: Boolean, default: false },
  },

  computedAt: { type: Date, default: Date.now },
}, { timestamps: true });

monthlyScoreSchema.index({ employee: 1, year: 1, month: 1 }, { unique: true });
monthlyScoreSchema.index({ year: 1, month: 1, totalPoints: -1 });

module.exports = mongoose.model('MonthlyScore', monthlyScoreSchema);
