/*
 * Memat Digi Inc.
 * scoringEngine.js — Employee/Intern of the Month + Nakshatra Award engine.
 *
 * DESIGN: a CONFIGURABLE rules engine, not hardcoded point values.
 * Every weight comes from the ScoringConfig singleton so HR/Admin can tune
 * points from the UI without a code change. Each rule is a discrete,
 * independently-computable function → easy to unit test and re-tune.
 *
 * Interpretation defaults (spec ambiguities — see ScoringConfig.js notes):
 *   • "Late coming −0.5 points (3 day)" → −0.5 per rolling group of 3 lates
 *     (floor(lateCount / latePenaltyGroupSize) × latePenaltyPer).
 *   • "Half day (unpaid): +1 Point" → kept as a signed configurable value
 *     (default +1 as per spec literal; flip in config if Memat confirms
 *     it should be a deduction).
 *   • Nakshatra 1200 = 12 months × 100-pt cap → cumulative running total of
 *     monthly scores across the award period + bonuses on top.
 */

const moment = require('moment-timezone');
const TaskSheet = require('../models/TaskSheet');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Feedback = require('../models/Feedback');
const Recommendation = require('../models/Recommendation');
const WeeklyReport = require('../models/WeeklyReport');
const MonthlyScore = require('../models/MonthlyScore');
const ScoringConfig = require('../models/ScoringConfig');
const User = require('../models/User');
const Holiday = require('../models/Holiday.modal');

const TZ = 'Asia/Kolkata';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Clamp a bucket score to [0, max] when caps are enforced. */
const clampBucket = (value, max, enforce) =>
  enforce ? Math.min(Math.max(value, 0), max) : value;

/**
 * Working days in the month up to (and including) `until`.
 * Mirrors the company calendar used by jobs/schedulars.js:
 * Sundays off + 2nd & 4th Saturdays off, plus any Holiday docs in that range.
 */
const getWorkingDays = async (year, month, until = null) => {
  const start = moment.tz({ year, month: month - 1, day: 1 }, TZ).startOf('day');
  const endOfMonth = start.clone().endOf('month');
  const end = until ? moment.min(moment.tz(until, TZ).endOf('day'), endOfMonth) : endOfMonth;

  let holidays = [];
  try {
    holidays = await Holiday.find({
      date: { $gte: start.toDate(), $lte: end.toDate() },
    }).select('date').lean();
  } catch (_) { /* holiday model optional */ }
  const holidaySet = new Set(holidays.map(h => moment.tz(h.date, TZ).format('YYYY-MM-DD')));

  const days = [];
  const cursor = start.clone();
  while (cursor.isSameOrBefore(end, 'day')) {
    const dow = cursor.day();               // 0 = Sunday, 6 = Saturday
    const weekOfMonth = Math.ceil(cursor.date() / 7);
    const isSunday = dow === 0;
    const is2ndOr4thSat = dow === 6 && (weekOfMonth === 2 || weekOfMonth === 4);
    const isHoliday = holidaySet.has(cursor.format('YYYY-MM-DD'));
    if (!isSunday && !is2ndOr4thSat && !isHoliday) days.push(cursor.clone().toDate());
    cursor.add(1, 'day');
  }
  return days;
};

const monthRange = (year, month) => ({
  start: moment.tz({ year, month: month - 1, day: 1 }, TZ).startOf('day').toDate(),
  end: moment.tz({ year, month: month - 1, day: 1 }, TZ).endOf('month').toDate(),
});

// ─────────────────────────────────────────────────────────────────────────────
// RULE 1 — Task Sheet bucket (max 50 default)
//   baseline +50, −2 per incomplete task, −1 per day sheet not filled
// ─────────────────────────────────────────────────────────────────────────────
const computeTaskSheetPoints = async (employeeId, year, month, cfg, workingDays) => {
  const { start, end } = monthRange(year, month);

  const sheets = await TaskSheet.find({
    employee: employeeId,
    date: { $gte: start, $lte: end },
  }).lean();

  const filledDates = new Set(
    sheets.filter(s => s.filled).map(s => moment.tz(s.date, TZ).format('YYYY-MM-DD'))
  );

  // Days not filled = elapsed working days without a filled sheet
  const today = moment.tz(TZ).endOf('day');
  const elapsedWorkingDays = workingDays.filter(d => moment.tz(d, TZ).isSameOrBefore(today));
  const daysNotFilled = elapsedWorkingDays.filter(
    d => !filledDates.has(moment.tz(d, TZ).format('YYYY-MM-DD'))
  ).length;

  const incompleteTasks = sheets.reduce(
    (sum, s) => sum + (s.tasks || []).filter(t => t.status !== 'completed').length,
    0
  );

  const raw =
    cfg.taskSheetBaseline +
    incompleteTasks * cfg.incompleteTaskPenalty +
    daysNotFilled * cfg.notFilledDayPenalty;

  return {
    points: clampBucket(raw, cfg.taskSheetMax, cfg.enforceBucketCaps),
    detail: { daysNotFilled, incompleteTasks },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// RULE 2 — Behaviour bucket (max 10 default)
//   baseline +10, negative feedback: peer −1 / TL −2 / HR −2 / Manager −4
// ─────────────────────────────────────────────────────────────────────────────
const computeBehaviourPoints = async (employeeId, year, month, cfg) => {
  const { start, end } = monthRange(year, month);

  const negatives = await Feedback.find({
    employee: employeeId,
    sentiment: 'negative',
    date: { $gte: start, $lte: end },
  }).lean();

  const penaltyByRole = {
    employee: cfg.negFeedbackEmployee,
    tl: cfg.negFeedbackTL,
    hr: cfg.negFeedbackHR,
    manager: cfg.negFeedbackManager,
    admin: cfg.negFeedbackManager, // admin feedback weighted like manager
  };

  const byRole = {};
  let deduction = 0;
  for (const f of negatives) {
    byRole[f.givenByRole] = (byRole[f.givenByRole] || 0) + 1;
    deduction += penaltyByRole[f.givenByRole] ?? cfg.negFeedbackEmployee;
  }

  const raw = cfg.behaviourBaseline + deduction; // penalties are negative values

  return {
    points: clampBucket(raw, cfg.behaviourMax, cfg.enforceBucketCaps),
    detail: { negativeFeedback: negatives.length, negativeFeedbackByRole: byRole },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// RULE 3 — Leaves & Punctuality bucket (max 20 default)
//   baseline +20 (no leave), late −0.5 per group of 3, half day (signed, default +1),
//   full-day unpaid leave −2 each
// ─────────────────────────────────────────────────────────────────────────────
const computeAttendancePoints = async (employeeId, year, month, cfg) => {
  const { start, end } = monthRange(year, month);

  const [attendanceDocs, leaves] = await Promise.all([
    Attendance.find({
      employee: employeeId,
      date: { $gte: start, $lte: end },
    }).select('status').lean(),
    Leave.find({
      employee: employeeId,
      status: 'approved',
      startDate: { $lte: end },
      endDate: { $gte: start },
      leaveType: { $ne: 'Initial Allocation' },
    }).lean(),
  ]);

  const lateArrivals = attendanceDocs.filter(a => a.status === 'late').length;
  const halfDays = leaves.filter(l => l.leaveType === 'half').length
    + attendanceDocs.filter(a => a.status === 'half-day').length;
  const fullDayLeaves = leaves
    .filter(l => !['half', 'short'].includes(l.leaveType))
    .reduce((sum, l) => sum + Math.max(1, Math.round(l.numberOfDays || 1)), 0);

  const lateGroups = cfg.latePenaltyGroupSize > 0
    ? Math.floor(lateArrivals / cfg.latePenaltyGroupSize)
    : lateArrivals;

  const raw =
    cfg.noLeaveBaseline +
    lateGroups * cfg.latePenaltyPer +
    halfDays * cfg.halfDayPoints +          // signed value — see config note
    fullDayLeaves * cfg.fullDayLeavePenalty;

  return {
    points: clampBucket(raw, cfg.attendanceMax, cfg.enforceBucketCaps),
    detail: { lateArrivals, halfDays, fullDayLeaves },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// RULE 4 — Recommendations & Conduct bucket (max 20 default)
//   TL +5 / Manager +10 / HR +5 per recommendation, dress code +5 (from
//   TL Weekly Reports — all weeks of the month must be marked compliant)
// ─────────────────────────────────────────────────────────────────────────────
const computeRecommendationPoints = async (employeeId, year, month, cfg) => {
  const { start, end } = monthRange(year, month);

  const [recs, reports] = await Promise.all([
    Recommendation.find({
      employee: employeeId,
      date: { $gte: start, $lte: end },
    }).lean(),
    WeeklyReport.find({
      employee: employeeId,
      weekStartDate: { $gte: start, $lte: end },
    }).lean(),
  ]);

  const pointsByRole = {
    tl: cfg.recommendationTL,
    manager: cfg.recommendationManager,
    hr: cfg.recommendationHR,
    admin: cfg.recommendationManager,
  };

  let recPoints = 0;
  for (const r of recs) recPoints += pointsByRole[r.recommendedByRole] ?? cfg.recommendationTL;

  // Dress code: +5 if every submitted weekly report this month says compliant
  const dressCodeWeeks = reports.filter(r => r.dressCodeFollowed).length;
  const dressCodeOk = reports.length > 0 && dressCodeWeeks === reports.length;
  if (dressCodeOk) recPoints += cfg.dressCodePoints;

  const weekendMeetings = reports.reduce(
    (sum, r) => sum + (r.weekendClientMeeting?.occurred ? (r.weekendClientMeeting.count || 1) : 0),
    0
  );

  return {
    points: clampBucket(recPoints, cfg.recommendationMax, cfg.enforceBucketCaps),
    detail: { recommendations: recs.length, dressCodeWeeks, weekendMeetings },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — compute (and upsert) the MonthlyScore for one employee for one month
// ─────────────────────────────────────────────────────────────────────────────
const computeMonthlyScore = async (employeeId, year, month, cfg = null) => {
  cfg = cfg || (await ScoringConfig.getConfig());

  // Never recompute a finalized (locked) month
  const existing = await MonthlyScore.findOne({ employee: employeeId, year, month });
  if (existing?.isFinalized) return existing;

  const workingDays = await getWorkingDays(year, month);

  const [taskSheet, behaviour, attendance, recommendation] = await Promise.all([
    computeTaskSheetPoints(employeeId, year, month, cfg, workingDays),
    computeBehaviourPoints(employeeId, year, month, cfg),
    computeAttendancePoints(employeeId, year, month, cfg),
    computeRecommendationPoints(employeeId, year, month, cfg),
  ]);

  const totalPoints = +(
    taskSheet.points + behaviour.points + attendance.points + recommendation.points
  ).toFixed(2);

  // Nakshatra bonus points earned this month (weekend client meetings;
  // EOM bonus is applied at finalization time when the winner is known)
  const bonusPoints = recommendation.detail.weekendMeetings * cfg.weekendMeetingBonus;

  const score = await MonthlyScore.findOneAndUpdate(
    { employee: employeeId, year, month },
    {
      $set: {
        taskSheetPoints: taskSheet.points,
        behaviourPoints: behaviour.points,
        attendancePoints: attendance.points,
        recommendationPoints: recommendation.points,
        totalPoints,
        bonusPoints,
        detail: {
          ...taskSheet.detail,
          ...behaviour.detail,
          ...attendance.detail,
          ...recommendation.detail,
          workingDaysInMonth: workingDays.length,
        },
        computedAt: new Date(),
      },
      $setOnInsert: { employee: employeeId, year, month },
    },
    { new: true, upsert: true }
  );

  return score;
};

// ─────────────────────────────────────────────────────────────────────────────
// Compute for ALL active employees (nightly job / manual recalculate)
// ─────────────────────────────────────────────────────────────────────────────
const computeAllMonthlyScores = async (year, month) => {
  const cfg = await ScoringConfig.getConfig();
  const employees = await User.find({
    isActive: true,
    role: { $in: ['employee', 'tl'] }, // scored population; managers/HR/admin excluded
  }).select('_id').lean();

  const results = [];
  for (const emp of employees) {
    try {
      results.push(await computeMonthlyScore(emp._id, year, month, cfg));
    } catch (err) {
      console.error(`scoring: failed for employee ${emp._id}:`, err.message);
    }
  }
  return results;
};

// ─────────────────────────────────────────────────────────────────────────────
// Month-end finalization — lock scores + pick Employee/Intern of the Month
// Tie-break: fewest negative-feedback entries (configurable).
// Returns { employeeOfMonth, internOfMonth }.
// ─────────────────────────────────────────────────────────────────────────────
const finalizeMonth = async (year, month) => {
  const cfg = await ScoringConfig.getConfig();
  await computeAllMonthlyScores(year, month); // final recompute before lock

  const scores = await MonthlyScore.find({ year, month, isFinalized: false })
    .populate('employee', 'firstName lastName employmentType role isActive')
    .lean();

  const eligible = scores.filter(s => s.employee?.isActive);

  const pickWinner = (pool) => {
    if (!pool.length) return null;
    const sorted = [...pool].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (cfg.eomTieBreak === 'least-negative-feedback') {
        return (a.detail?.negativeFeedback || 0) - (b.detail?.negativeFeedback || 0);
      }
      return 0;
    });
    return sorted[0];
  };

  let employeeOfMonth = null;
  let internOfMonth = null;

  if (cfg.separateInternAward) {
    employeeOfMonth = pickWinner(eligible.filter(s => s.employee.employmentType !== 'intern'));
    internOfMonth = pickWinner(eligible.filter(s => s.employee.employmentType === 'intern'));
  } else {
    employeeOfMonth = pickWinner(eligible);
  }

  // Lock all scores for the month
  await MonthlyScore.updateMany({ year, month }, { $set: { isFinalized: true } });

  // Flag winners + apply the EOM Nakshatra bonus
  if (employeeOfMonth) {
    await MonthlyScore.updateOne(
      { _id: employeeOfMonth._id },
      { $set: { isEmployeeOfMonth: true }, $inc: { bonusPoints: cfg.eomBonus } }
    );
  }
  if (internOfMonth) {
    await MonthlyScore.updateOne(
      { _id: internOfMonth._id },
      { $set: { isInternOfMonth: true }, $inc: { bonusPoints: cfg.eomBonus } }
    );
  }

  return { employeeOfMonth, internOfMonth };
};

// ─────────────────────────────────────────────────────────────────────────────
// Nakshatra Award — cumulative running total per employee over the award period
// (default: current calendar year). Computed from cached MonthlyScore docs and
// served pre-aggregated; the frontend never recomputes.
// ─────────────────────────────────────────────────────────────────────────────
const getNakshatraLeaderboard = async (periodStart = null, periodEnd = null) => {
  const cfg = await ScoringConfig.getConfig();

  const start = periodStart || cfg.nakshatraPeriodStart || moment.tz(TZ).startOf('year').toDate();
  const end = periodEnd || cfg.nakshatraPeriodEnd || moment.tz(TZ).endOf('year').toDate();

  const startM = moment.tz(start, TZ);
  const endM = moment.tz(end, TZ);

  const rows = await MonthlyScore.aggregate([
    {
      $match: {
        $expr: {
          $and: [
            {
              $gte: [
                { $add: [{ $multiply: ['$year', 100] }, '$month'] },
                startM.year() * 100 + (startM.month() + 1),
              ],
            },
            {
              $lte: [
                { $add: [{ $multiply: ['$year', 100] }, '$month'] },
                endM.year() * 100 + (endM.month() + 1),
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: '$employee',
        basePoints: { $sum: '$totalPoints' },
        bonusPoints: { $sum: '$bonusPoints' },
        monthsCounted: { $sum: 1 },
        eomWins: { $sum: { $cond: ['$isEmployeeOfMonth', 1, 0] } },
      },
    },
    {
      $addFields: { nakshatraTotal: { $add: ['$basePoints', '$bonusPoints'] } },
    },
    { $sort: { nakshatraTotal: -1 } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'employee',
      },
    },
    { $unwind: '$employee' },
    { $match: { 'employee.isActive': true } },
    {
      $project: {
        basePoints: 1, bonusPoints: 1, nakshatraTotal: 1, monthsCounted: 1, eomWins: 1,
        'employee._id': 1, 'employee.firstName': 1, 'employee.lastName': 1,
        'employee.department': 1, 'employee.designation': 1, 'employee.employeeId': 1,
        'employee.employmentType': 1, 'employee.teamLead_id': 1, 'employee.profileImage': 1,
      },
    },
  ]);

  return { rows, target: cfg.nakshatraTarget, periodStart: start, periodEnd: end };
};

module.exports = {
  computeTaskSheetPoints,
  computeBehaviourPoints,
  computeAttendancePoints,
  computeRecommendationPoints,
  computeMonthlyScore,
  computeAllMonthlyScores,
  finalizeMonth,
  getNakshatraLeaderboard,
  getWorkingDays,
};
