const moment = require('moment-timezone');
const User           = require('../models/User');
const MonthlyScore   = require('../models/MonthlyScore');
const Feedback       = require('../models/Feedback');
const Recommendation = require('../models/Recommendation');
const ScoringConfig  = require('../models/ScoringConfig');
const {
  computeMonthlyScore,
  recomputeMonthForAll,
  finalizeMonth,
  getNakshatraLeaderboard,
} = require('../services/scoring.services');
const { createNotification } = require('./Notificationcontroller');

const TZ = 'Asia/Kolkata';

const parseMonthYear = (req) => {
  const now = moment.tz(TZ);
  return {
    year:  parseInt(req.query.year, 10)  || now.year(),
    month: parseInt(req.query.month, 10) || now.month() + 1,
  };
};

class ScoringController {

  // ── GET /scoring/me?months=12 — own current score + trend ────────────────
  getMyScores = async (req, res) => {
    try {
      const employeeId = req.user.id || req.user._id;
      const monthsBack = Math.min(24, parseInt(req.query.months, 10) || 12);

      const now = moment.tz(TZ);
      // Ensure the current month has at least one fresh snapshot
      await computeMonthlyScore(employeeId, now.year(), now.month() + 1);

      const since = now.clone().subtract(monthsBack - 1, 'months').startOf('month');
      const scores = await MonthlyScore.find({
        employee: employeeId,
        $or: [
          { year: { $gt: since.year() } },
          { year: since.year(), month: { $gte: since.month() + 1 } },
        ],
      }).sort({ year: 1, month: 1 }).lean();

      res.json({ success: true, data: scores });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /scoring/team?year=&month= — TL: own team only ───────────────────
  getTeamScores = async (req, res) => {
    try {
      const { year, month } = parseMonthYear(req);
      const myId = req.user.id || req.user._id;

      const teamFilter = req.user.role === 'tl'
        ? { teamLead_id: myId, isActive: true }
        : { $or: [{ teamLead_id: myId }, { reportingManager_id: myId }], isActive: true };

      const team = await User.find(teamFilter).select('_id firstName lastName employeeId department designation profileImage').lean();
      const teamIds = team.map(u => u._id);

      const scores = await MonthlyScore.find({ employee: { $in: teamIds }, year, month })
        .populate('employee', 'firstName lastName employeeId department designation profileImage')
        .sort({ totalPoints: -1 })
        .lean();

      res.json({ success: true, year, month, teamSize: team.length, data: scores });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /scoring/company?year=&month=&department=&teamLead= ──────────────
  // HR/Manager/Admin — company-wide leaderboard with filters
  getCompanyScores = async (req, res) => {
    try {
      const { year, month } = parseMonthYear(req);

      const userFilter = { isActive: true };
      if (req.query.department) userFilter.department = req.query.department;
      if (req.query.teamLead)   userFilter.teamLead_id = req.query.teamLead;

      const users = await User.find(userFilter).select('_id').lean();
      const ids = users.map(u => u._id);

      const scores = await MonthlyScore.find({ employee: { $in: ids }, year, month })
        .populate('employee', 'firstName lastName employeeId department designation profileImage teamLead_id')
        .sort({ totalPoints: -1 })
        .lean();

      res.json({ success: true, year, month, data: scores });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /scoring/employee/:id — one employee's trend (TL scoped to team) ──
  getEmployeeScores = async (req, res) => {
    try {
      const targetId = req.params.id;

      if (req.user.role === 'tl') {
        const target = await User.findById(targetId).select('teamLead_id').lean();
        const myId = (req.user.id || req.user._id).toString();
        if (!target || !target.teamLead_id || target.teamLead_id.toString() !== myId) {
          return res.status(403).json({ success: false, message: 'TL can only view their own team members' });
        }
      }

      const scores = await MonthlyScore.find({ employee: targetId })
        .sort({ year: 1, month: 1 })
        .lean();

      res.json({ success: true, data: scores });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /scoring/nakshatra-leaderboard?start=&end= ───────────────────────
  getNakshatra = async (req, res) => {
    try {
      const start = req.query.start ? new Date(req.query.start) : null;
      const end   = req.query.end   ? new Date(req.query.end)   : null;
      const result = await getNakshatraLeaderboard(start, end);

      // Employees only see their own row + the top 3 (privacy); TL sees team; others see all
      if (req.user.role === 'employee') {
        const myId = (req.user.id || req.user._id).toString();
        const mine = result.leaderboard.find(r => r._id.toString() === myId) || null;
        const myRank = result.leaderboard.findIndex(r => r._id.toString() === myId) + 1;
        result.leaderboard = result.leaderboard.slice(0, 3);
        result.me = mine ? { ...mine, rank: myRank } : null;
      }

      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── POST /scoring/recalculate — admin/hr manual on-demand refresh ────────
  recalculate = async (req, res) => {
    try {
      const now = moment.tz(TZ);
      const year  = parseInt(req.body.year, 10)  || now.year();
      const month = parseInt(req.body.month, 10) || now.month() + 1;

      const count = await recomputeMonthForAll(year, month);
      res.json({ success: true, message: `Recomputed scores for ${count} employees (${month}/${year})` });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── POST /scoring/finalize — admin: lock month + pick Employee of the Month ──
  finalize = async (req, res) => {
    try {
      const now = moment.tz(TZ);
      const year  = parseInt(req.body.year, 10)  || now.year();
      const month = parseInt(req.body.month, 10) || now.month() + 1;

      const winner = await finalizeMonth(year, month);
      res.json({
        success: true,
        message: winner
          ? `Month finalized — Employee of the Month: ${winner.employee.firstName} ${winner.employee.lastName} (${winner.totalPoints} pts)`
          : 'Month finalized — no scores found',
        data: winner,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /scoring/config + PUT /scoring/config — admin-editable rules ─────
  getConfig = async (req, res) => {
    try {
      const cfg = await ScoringConfig.getConfig();
      res.json({ success: true, data: cfg });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  updateConfig = async (req, res) => {
    try {
      const cfg = await ScoringConfig.getConfig();
      const editable = [
        'taskSheetMax', 'behaviourMax', 'attendanceMax', 'recommendationMax', 'clampBuckets',
        'incompleteTaskPenalty', 'unfilledSheetDayPenalty',
        'negFeedbackEmployee', 'negFeedbackTL', 'negFeedbackHR', 'negFeedbackManager',
        'latePenalty', 'lateGroupSize', 'lateMode',
        'unpaidHalfDayPoints', 'unpaidFullDayPenalty',
        'recommendationTL', 'recommendationManager', 'recommendationHR', 'dressCodePoints',
        'nakshatraTarget', 'employeeOfMonthBonus', 'weekendClientMeetingBonus',
        'nakshatraPeriodStart', 'nakshatraPeriodEnd',
        'tieBreak', 'weeklyReportEditWindowDays',
      ];
      for (const key of editable) {
        if (req.body[key] !== undefined) cfg[key] = req.body[key];
      }
      cfg.updatedBy = req.user.id || req.user._id;
      await cfg.save();
      res.json({ success: true, message: 'Scoring config updated', data: cfg });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── POST /scoring/feedback — log feedback (any role; role snapshotted) ───
  addFeedback = async (req, res) => {
    try {
      const { employee, sentiment, comment } = req.body;
      if (!employee || !['positive', 'negative'].includes(sentiment)) {
        return res.status(400).json({ success: false, message: 'employee and sentiment (positive|negative) are required' });
      }
      const giverId = req.user.id || req.user._id;
      if (employee.toString() === giverId.toString()) {
        return res.status(400).json({ success: false, message: 'You cannot log feedback about yourself' });
      }

      const fb = await Feedback.create({
        employee,
        givenBy: giverId,
        givenByRole: req.user.role, // snapshot — roles can change later
        sentiment,
        comment: comment || '',
      });

      // Inline recompute for snappy analytics
      const now = moment.tz(TZ);
      try { await computeMonthlyScore(employee, now.year(), now.month() + 1); } catch (e) {}

      // 🔔 Notify the employee
      await createNotification({
        recipient: employee,
        sender:    giverId,
        type:      'feedback_received',
        title:     sentiment === 'negative' ? 'Behaviour Feedback Logged' : 'Positive Feedback Received',
        message:   sentiment === 'negative'
          ? 'New behaviour feedback has been logged on your profile. Check your Analytics page for details.'
          : 'You received positive feedback — keep it up! 🎉',
        refId:     fb._id,
        refModel:  'Feedback',
      });

      res.status(201).json({ success: true, message: 'Feedback logged', data: fb });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── POST /scoring/recommendation — TL/HR/Manager/Admin only ──────────────
  addRecommendation = async (req, res) => {
    try {
      const { employee, comment } = req.body;
      if (!employee) return res.status(400).json({ success: false, message: 'employee is required' });

      const giverId = req.user.id || req.user._id;
      const rec = await Recommendation.create({
        employee,
        recommendedBy: giverId,
        recommendedByRole: req.user.role, // snapshot
        comment: comment || '',
      });

      const now = moment.tz(TZ);
      try { await computeMonthlyScore(employee, now.year(), now.month() + 1); } catch (e) {}

      // 🔔 Notify the employee
      await createNotification({
        recipient: employee,
        sender:    giverId,
        type:      'recommendation_received',
        title:     'You Received a Recommendation! 🌟',
        message:   `A ${req.user.role.toUpperCase()} recommended you — this adds points toward Employee of the Month.`,
        refId:     rec._id,
        refModel:  'Recommendation',
      });

      res.status(201).json({ success: true, message: 'Recommendation added', data: rec });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /scoring/feedback/:employeeId — feedback list (self, TL-team, HR) ─
  getFeedback = async (req, res) => {
    try {
      const targetId = req.params.employeeId;
      const myId = (req.user.id || req.user._id).toString();

      if (req.user.role === 'employee' && targetId !== myId) {
        return res.status(403).json({ success: false, message: 'Employees can only view their own feedback' });
      }
      if (req.user.role === 'tl' && targetId !== myId) {
        const target = await User.findById(targetId).select('teamLead_id').lean();
        if (!target || !target.teamLead_id || target.teamLead_id.toString() !== myId) {
          return res.status(403).json({ success: false, message: 'TL can only view their own team members' });
        }
      }

      const [feedback, recommendations] = await Promise.all([
        Feedback.find({ employee: targetId }).populate('givenBy', 'firstName lastName role').sort({ date: -1 }).limit(100),
        Recommendation.find({ employee: targetId }).populate('recommendedBy', 'firstName lastName role').sort({ date: -1 }).limit(100),
      ]);

      res.json({ success: true, data: { feedback, recommendations } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
}

module.exports = new ScoringController();
