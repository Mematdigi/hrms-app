/*
 * Memat Digi Inc.
 * www.mematdigi.com
 *
 * Scoring engine — Employee/Intern of the Month (100 pts) + Nakshatra Award (1200 pts).
 *
 * Every rule below is a discrete, independently-computable function so it is easy
 * to unit test and re-tune. All point values come from the ScoringConfig document
 * (admin-editable) — nothing is hardcoded.
 */
const moment = require('moment-timezone');
const mongoose = require('mongoose');

const User           = require('../models/User');
const Attendance     = require('../models/Attendance');
const Leave          = require('../models/Leave');
const TaskReport     = require('../models/TaskReport');
const Feedback       = require('../models/Feedback');
const Recommendation = require('../models/Recommendation');
const WeeklyReport   = require('../models/WeeklyReport');
const MonthlyScore   = require('../models/MonthlyScore');
const ScoringConfig  = require('../models/ScoringConfig');

const TZ = 'Asia/Kolkata';

// ─────────────────────────────────────────────────────────────────────────────
// Working-day helper — Mon–Sat, excluding Sundays and 2nd & 4th Saturdays
// (matches the existing attendance cron's off-day convention)
// ─────────────────────────────────────────────────────────────────────────────
const getWorkingDays = (year, month /* 1-12 */, upToDate = null) => {
  const days = [];
  const start = moment.tz({ year, month: month - 1, day: 1 }, TZ).startOf('day');
  const end   = moment.min(
    start.clone().endOf('month'),
    upToDate ? moment.tz(upToDate, TZ).endOf('day') : moment.tz(TZ).endOf('day')
  );
  const cur = start.clone();
  while (cur.isSameOrBefore(end, 'day')) {
    const dow = cur.day();
    const isSunday = dow === 0;
    const isOffSaturday = dow === 6 && [2, 4].includes(Math.ceil(cur.date() / 7));
    if (!isSunday && !isOffSaturday) days.push(cur.clone().toDate());
    cur.add(1, 'day');
  }
  return days;
};

const monthRange = (year, month) => ({
  start: moment.tz({ year, month: month - 1, day: 1 }, TZ).startOf('month').toDate(),
  end:   moment.tz({ year, month: month - 1, day: 1 }, TZ).endOf('month').toDate(),
});

const clamp = (val, max, doClamp) => (doClamp ? Math.min(max, Math.max(0, val)) : val);
const round1 = (n) => Math.round(n * 10) / 10;

// ─────────────────────────────────────────────────────────────────────────────
// RULE 1 — Task bucket (default max 50) — driven ENTIRELY by TL Task Reports
//
// The employee does NOT fill anything in. The Team Lead logs, per team member
// and per date range: totalTasks + completedTasks.
//
//   +max baseline
//   −2 per incomplete task  (incompleteTasks = totalTasks − completedTasks,
//                            summed over every TL report overlapping the month)
//   −1 per working day in the month NOT covered by any TL task report
//      (i.e. the TL never logged tasks for that day — replaces the old
//       "employee did not fill their sheet" penalty)
// ─────────────────────────────────────────────────────────────────────────────
const computeTaskSheetPoints = async (employeeId, year, month, cfg) => {
  const { start, end } = monthRange(year, month);

  // Any TL report whose window overlaps this month
  const reports = await TaskReport.find({
    employee: employeeId,
    startDate: { $lte: end },
    endDate:   { $gte: start },
  }).lean();

  let totalTasks = 0;
  let completedTasks = 0;
  let incompleteTasks = 0;

  // Track which calendar days the TL actually covered with a report
  const coveredDays = new Set();

  for (const r of reports) {
    totalTasks      += r.totalTasks || 0;
    completedTasks  += r.completedTasks || 0;
    incompleteTasks += (r.incompleteTasks !== undefined)
      ? r.incompleteTasks
      : Math.max(0, (r.totalTasks || 0) - (r.completedTasks || 0));

    // Mark every day inside the report window (clipped to this month) as covered
    const from = moment.max(moment.tz(r.startDate, TZ), moment.tz(start, TZ)).startOf('day');
    const to   = moment.min(moment.tz(r.endDate, TZ),   moment.tz(end, TZ)).endOf('day');
    const cur = from.clone();
    while (cur.isSameOrBefore(to, 'day')) {
      coveredDays.add(cur.format('YYYY-MM-DD'));
      cur.add(1, 'day');
    }
  }

  const workingDays = getWorkingDays(year, month);
  const uncoveredDays = workingDays.filter(
    d => !coveredDays.has(moment.tz(d, TZ).format('YYYY-MM-DD'))
  ).length;

  const raw = cfg.taskSheetMax
    + incompleteTasks * cfg.incompleteTaskPenalty   // penalty values are negative
    + uncoveredDays * cfg.unfilledSheetDayPenalty;

  return {
    points: round1(clamp(raw, cfg.taskSheetMax, cfg.clampBuckets)),
    totalTasks,
    completedTasks,
    incompleteTasks,
    unfilledTaskSheetDays: uncoveredDays,
    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// RULE 2 — Behaviour bucket (default max 10)
//   +max baseline, deductions per negative feedback by giver role
// ─────────────────────────────────────────────────────────────────────────────
const computeBehaviourPoints = async (employeeId, year, month, cfg) => {
  const { start, end } = monthRange(year, month);
  const negatives = await Feedback.find({
    employee: employeeId, sentiment: 'negative', date: { $gte: start, $lte: end },
  }).lean();

  const counts = { employee: 0, tl: 0, hr: 0, manager: 0 };
  for (const f of negatives) {
    // admin negative feedback weighted same as manager (heaviest) by default
    const role = f.givenByRole === 'admin' ? 'manager' : f.givenByRole;
    if (counts[role] !== undefined) counts[role] += 1;
  }

  const raw = cfg.behaviourMax
    + counts.employee * cfg.negFeedbackEmployee
    + counts.tl * cfg.negFeedbackTL
    + counts.hr * cfg.negFeedbackHR
    + counts.manager * cfg.negFeedbackManager;

  return {
    points: round1(clamp(raw, cfg.behaviourMax, cfg.clampBuckets)),
    negativeFeedback: counts,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// RULE 3 — Leaves & Punctuality bucket (default max 20)
//   +max baseline if no leave; late penalty per config mode; half-day (signed,
//   default +1 per spec — see ScoringConfig note); −2 per unpaid full-day leave
// ─────────────────────────────────────────────────────────────────────────────
const computeAttendancePoints = async (employeeId, year, month, cfg) => {
  const { start, end } = monthRange(year, month);

  const [attendance, leaves] = await Promise.all([
    Attendance.find({ employee: employeeId, date: { $gte: start, $lte: end } }).lean(),
    Leave.find({
      employee: employeeId, status: 'approved',
      startDate: { $lte: end },
      $or: [{ endDate: { $gte: start } }, { endDate: null, startDate: { $gte: start } }],
    }).lean(),
  ]);

  const lateArrivals = attendance.filter(a => a.status === 'late').length;

  let unpaidHalfDays = 0;
  let unpaidFullDayLeaves = 0;
  let tookLeaveThisMonth = false;

  for (const lv of leaves) {
    if (lv.leaveType === 'Initial Allocation') continue;
    tookLeaveThisMonth = true;
    if (lv.leaveType === 'half') unpaidHalfDays += 1;
    else if (lv.leaveType === 'unpaid') unpaidFullDayLeaves += Math.max(1, lv.numberOfDays || 1);
    else if (lv.numberOfDays >= 1) unpaidFullDayLeaves += lv.numberOfDays; // full-day leaves count per occurrence-day
  }

  // Late penalty — two configurable interpretations of "−0.5 points (3 day)"
  let latePenaltyTotal = 0;
  if (cfg.lateMode === 'per-group') {
    latePenaltyTotal = Math.floor(lateArrivals / cfg.lateGroupSize) * cfg.latePenalty;
  } else { // 'flat-after-threshold'
    latePenaltyTotal = lateArrivals >= cfg.lateGroupSize ? cfg.latePenalty : 0;
  }

  const raw = cfg.attendanceMax
    + latePenaltyTotal
    + unpaidHalfDays * cfg.unpaidHalfDayPoints
    + unpaidFullDayLeaves * cfg.unpaidFullDayPenalty;

  return {
    points: round1(clamp(raw, cfg.attendanceMax, cfg.clampBuckets)),
    lateArrivals, unpaidHalfDays, unpaidFullDayLeaves, tookLeaveThisMonth,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// RULE 4 — Recommendations & Conduct bucket (default max 20)
//   +5 per TL rec, +10 per Manager rec, +5 per HR rec, +5 dress code (from
//   TL Weekly Reports — counted once if followed in every submitted week)
// ─────────────────────────────────────────────────────────────────────────────
const computeRecommendationPoints = async (employeeId, year, month, cfg) => {
  const { start, end } = monthRange(year, month);

  const [recs, reports] = await Promise.all([
    Recommendation.find({ employee: employeeId, date: { $gte: start, $lte: end } }).lean(),
    WeeklyReport.find({ employee: employeeId, weekStartDate: { $gte: start, $lte: end } }).lean(),
  ]);

  const counts = { tl: 0, hr: 0, manager: 0 };
  for (const r of recs) {
    const role = r.recommendedByRole === 'admin' ? 'manager' : r.recommendedByRole;
    if (counts[role] !== undefined) counts[role] += 1;
  }

  const dressWeeksTotal    = reports.length;
  const dressWeeksFollowed = reports.filter(r => r.dressCodeFollowed).length;
  const dressCodeEarned    = dressWeeksTotal > 0 && dressWeeksFollowed === dressWeeksTotal;

  const raw = counts.tl * cfg.recommendationTL
    + counts.manager * cfg.recommendationManager
    + counts.hr * cfg.recommendationHR
    + (dressCodeEarned ? cfg.dressCodePoints : 0);

  return {
    points: round1(clamp(raw, cfg.recommendationMax, cfg.clampBuckets)),
    recommendations: counts,
    dressCodeWeeksFollowed: dressWeeksFollowed,
    dressCodeWeeksTotal: dressWeeksTotal,
    weekendClientMeetings: reports.reduce(
      (sum, r) => sum + (r.weekendClientMeeting?.occurred ? (r.weekendClientMeeting.count || 1) : 0), 0
    ),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Compute + persist one employee's MonthlyScore snapshot
// ─────────────────────────────────────────────────────────────────────────────
const computeMonthlyScore = async (employeeId, year, month, cfg = null) => {
  if (!cfg) cfg = await ScoringConfig.getConfig();

  // Never recompute a finalized (locked) month
  const existing = await MonthlyScore.findOne({ employee: employeeId, year, month });
  if (existing && existing.isFinalized) return existing;

  const [task, behaviour, att, rec] = await Promise.all([
    computeTaskSheetPoints(employeeId, year, month, cfg),
    computeBehaviourPoints(employeeId, year, month, cfg),
    computeAttendancePoints(employeeId, year, month, cfg),
    computeRecommendationPoints(employeeId, year, month, cfg),
  ]);

  const totalPoints = round1(task.points + behaviour.points + att.points + rec.points);

  // Nakshatra bonus earned this month from weekend client meetings
  // (Employee-of-the-Month bonus is added at month-end finalization)
  const bonusPoints = rec.weekendClientMeetings * cfg.weekendClientMeetingBonus;

  const doc = await MonthlyScore.findOneAndUpdate(
    { employee: employeeId, year, month },
    {
      $set: {
        taskSheetPoints:      task.points,
        behaviourPoints:      behaviour.points,
        attendancePoints:     att.points,
        recommendationPoints: rec.points,
        totalPoints,
        bonusPoints,
        breakdown: {
          totalTasks:            task.totalTasks,
          completedTasks:        task.completedTasks,
          incompleteTasks:       task.incompleteTasks,
          taskCompletionRate:    task.completionRate,
          unfilledTaskSheetDays: task.unfilledTaskSheetDays,
          lateArrivals:          att.lateArrivals,
          unpaidHalfDays:        att.unpaidHalfDays,
          unpaidFullDayLeaves:   att.unpaidFullDayLeaves,
          negativeFeedback:      behaviour.negativeFeedback,
          recommendations:       rec.recommendations,
          dressCodeWeeksFollowed: rec.dressCodeWeeksFollowed,
          dressCodeWeeksTotal:    rec.dressCodeWeeksTotal,
          weekendClientMeetings:  rec.weekendClientMeetings,
          tookLeaveThisMonth:     att.tookLeaveThisMonth,
        },
        computedAt: new Date(),
      },
      $setOnInsert: { employee: employeeId, year, month },
    },
    { new: true, upsert: true }
  );
  return doc;
};

// ─────────────────────────────────────────────────────────────────────────────
// Recompute a month for ALL active employees (used by the nightly cron and the
// manual admin recalculate endpoint)
// ─────────────────────────────────────────────────────────────────────────────
const recomputeMonthForAll = async (year, month) => {
  const cfg = await ScoringConfig.getConfig();
  const employees = await User.find({ isActive: true }).select('_id').lean();
  let count = 0;
  for (const emp of employees) {
    try {
      await computeMonthlyScore(emp._id, year, month, cfg);
      count += 1;
    } catch (err) {
      console.error(`scoring: failed for employee ${emp._id}:`, err.message);
    }
  }
  return count;
};

// ─────────────────────────────────────────────────────────────────────────────
// Month-end finalization — locks the month, awards Employee of the Month
// (highest totalPoints; tie-break configurable, default fewest negative feedback)
// Returns the winner's MonthlyScore doc (or null)
// ─────────────────────────────────────────────────────────────────────────────
const finalizeMonth = async (year, month) => {
  const cfg = await ScoringConfig.getConfig();
  await recomputeMonthForAll(year, month);

  const scores = await MonthlyScore.find({ year, month, isFinalized: false }).lean();
  if (!scores.length) return null;

  const totalNeg = (s) => {
    const n = s.breakdown?.negativeFeedback || {};
    return (n.employee || 0) + (n.tl || 0) + (n.hr || 0) + (n.manager || 0);
  };

  const sorted = [...scores].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (cfg.tieBreak === 'fewest-negative-feedback') return totalNeg(a) - totalNeg(b);
    return 0;
  });

  const winner = sorted[0];

  await MonthlyScore.updateMany({ year, month }, { $set: { isFinalized: true } });
  const winnerDoc = await MonthlyScore.findByIdAndUpdate(
    winner._id,
    {
      $set: { isEmployeeOfMonth: true },
      $inc: { bonusPoints: cfg.employeeOfMonthBonus },
    },
    { new: true }
  ).populate('employee', 'firstName lastName employeeId department');

  return winnerDoc;
};

// ─────────────────────────────────────────────────────────────────────────────
// Nakshatra ledger — cumulative running total per employee over the award period
// (computed on the fly from MonthlyScore; the caller may cache the response)
// ─────────────────────────────────────────────────────────────────────────────
const getNakshatraLeaderboard = async (periodStart = null, periodEnd = null) => {
  const cfg = await ScoringConfig.getConfig();
  const now = moment.tz(TZ);
  const start = periodStart || cfg.nakshatraPeriodStart || now.clone().startOf('year').toDate();
  const end   = periodEnd   || cfg.nakshatraPeriodEnd   || now.clone().endOf('year').toDate();

  const sm = moment.tz(start, TZ);
  const em = moment.tz(end, TZ);

  const orClauses = [];
  const cur = sm.clone().startOf('month');
  while (cur.isSameOrBefore(em, 'month')) {
    orClauses.push({ year: cur.year(), month: cur.month() + 1 });
    cur.add(1, 'month');
  }
  if (!orClauses.length) return { periodStart: start, periodEnd: end, target: cfg.nakshatraTarget, leaderboard: [] };

  const rows = await MonthlyScore.aggregate([
    { $match: { $or: orClauses } },
    {
      $group: {
        _id: '$employee',
        basePoints:  { $sum: '$totalPoints' },
        bonusPoints: { $sum: '$bonusPoints' },
        monthsCounted: { $sum: 1 },
        eomWins: { $sum: { $cond: ['$isEmployeeOfMonth', 1, 0] } },
      },
    },
    { $addFields: { nakshatraTotal: { $add: ['$basePoints', '$bonusPoints'] } } },
    { $sort: { nakshatraTotal: -1 } },
    {
      $lookup: {
        from: 'users', localField: '_id', foreignField: '_id', as: 'employee',
        pipeline: [{ $project: { firstName: 1, lastName: 1, employeeId: 1, department: 1, designation: 1, profileImage: 1, teamLead_id: 1 } }],
      },
    },
    { $unwind: '$employee' },
  ]);

  return { periodStart: start, periodEnd: end, target: cfg.nakshatraTarget, leaderboard: rows };
};

module.exports = {
  getWorkingDays,
  computeTaskSheetPoints,
  computeBehaviourPoints,
  computeAttendancePoints,
  computeRecommendationPoints,
  computeMonthlyScore,
  recomputeMonthForAll,
  finalizeMonth,
  getNakshatraLeaderboard,
};
