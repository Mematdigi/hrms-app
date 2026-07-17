const WeeklyReport   = require('../models/WeeklyReport');
const Feedback       = require('../models/Feedback');
const Recommendation = require('../models/Recommendation');
const User           = require('../models/User');
const ScoringConfig  = require('../models/ScoringConfig');
const { computeMonthlyScore } = require('../services/scoring.services');
const { createNotification, notifyByRoles } = require('./Notificationcontroller');

// Normalize a date to the Monday of its week (start of day)
const toWeekStart = (d) => {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

class WeeklyReportController {

  // ── POST /weekly-report — TL submits a report for one team member ────────
  submitReport = async (req, res) => {
    try {
      const tlId = req.user.id || req.user._id;
      const {
        employee, weekStartDate,
        dressCodeFollowed = true, behaviourNotes = '',
        negativeFeedbackFlag = false, recommendation = false,
        weekendClientMeeting = { occurred: false, count: 0 },
      } = req.body;

      if (!employee || !weekStartDate) {
        return res.status(400).json({ success: false, message: 'employee and weekStartDate are required' });
      }

      // TL may only report on their OWN team members (admin/hr/manager bypass)
      const emp = await User.findById(employee).select('firstName lastName teamLead_id');
      if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
      if (req.user.role === 'tl' && (!emp.teamLead_id || emp.teamLead_id.toString() !== tlId.toString())) {
        return res.status(403).json({ success: false, message: 'You can only submit weekly reports for your own team members' });
      }

      const weekStart = toWeekStart(weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const existing = await WeeklyReport.findOne({ teamLead: tlId, employee, weekStartDate: weekStart });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'A weekly report for this employee and week already exists — use the edit endpoint',
        });
      }

      const report = await WeeklyReport.create({
        teamLead: tlId,
        employee,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        dressCodeFollowed,
        behaviourNotes,
        negativeFeedbackFlag,
        recommendation,
        weekendClientMeeting: {
          occurred: !!weekendClientMeeting.occurred,
          count: weekendClientMeeting.occurred ? Math.max(1, parseInt(weekendClientMeeting.count, 10) || 1) : 0,
        },
      });

      // ── Auto-create linked Feedback / Recommendation docs ──
      if (negativeFeedbackFlag) {
        const fb = await Feedback.create({
          employee, givenBy: tlId, givenByRole: 'tl', sentiment: 'negative',
          comment: behaviourNotes || 'Flagged in TL weekly report',
          date: weekEnd, sourceWeeklyReport: report._id,
        });
        report.linkedFeedback = fb._id;
      }
      if (recommendation) {
        const rec = await Recommendation.create({
          employee, recommendedBy: tlId, recommendedByRole: 'tl',
          comment: behaviourNotes || 'Recommended in TL weekly report',
          date: weekEnd, sourceWeeklyReport: report._id,
        });
        report.linkedRecommendation = rec._id;
      }
      await report.save();

      // ── Immediate partial recompute for snappier feedback on Analytics ──
      try {
        await computeMonthlyScore(employee, weekEnd.getFullYear(), weekEnd.getMonth() + 1);
      } catch (e) { console.error('weekly report inline recompute failed:', e.message); }

      // 🔔 Notify the employee + HR/Manager audit trail
      await createNotification({
        recipient: employee,
        sender:    tlId,
        type:      'weekly_report_submitted',
        title:     'Weekly Report Submitted',
        message:   `Your Team Lead submitted your weekly report for the week of ${weekStart.toDateString()}${recommendation ? ' — including a recommendation 🎉' : ''}${negativeFeedbackFlag ? ' — it includes behaviour feedback to review' : ''}.`,
        refId:     report._id,
        refModel:  'WeeklyReport',
      });
      await notifyByRoles(['hr', 'manager', 'admin'], {
        sender:   tlId,
        type:     'weekly_report_submitted',
        title:    `Weekly Report — ${emp.firstName} ${emp.lastName}`,
        message:  `A TL weekly report was submitted for ${emp.firstName} ${emp.lastName} (week of ${weekStart.toDateString()}).`,
        refId:    report._id,
        refModel: 'WeeklyReport',
      });

      res.status(201).json({ success: true, message: 'Weekly report submitted', data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── PUT /weekly-report/:id — TL edits own report inside edit window ──────
  updateReport = async (req, res) => {
    try {
      const tlId = req.user.id || req.user._id;
      const report = await WeeklyReport.findById(req.params.id);
      if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

      if (report.teamLead.toString() !== tlId.toString()) {
        return res.status(403).json({ success: false, message: 'You can only edit your own weekly reports' });
      }

      const cfg = await ScoringConfig.getConfig();
      const windowMs = (cfg.weeklyReportEditWindowDays || 3) * 24 * 60 * 60 * 1000;
      if (Date.now() - new Date(report.createdAt).getTime() > windowMs) {
        return res.status(400).json({
          success: false,
          message: `Edit window of ${cfg.weeklyReportEditWindowDays} days has expired for this report`,
        });
      }

      const {
        dressCodeFollowed, behaviourNotes, negativeFeedbackFlag,
        recommendation, weekendClientMeeting,
      } = req.body;

      if (dressCodeFollowed !== undefined) report.dressCodeFollowed = dressCodeFollowed;
      if (behaviourNotes !== undefined)    report.behaviourNotes = behaviourNotes;
      if (weekendClientMeeting !== undefined) {
        report.weekendClientMeeting = {
          occurred: !!weekendClientMeeting.occurred,
          count: weekendClientMeeting.occurred ? Math.max(1, parseInt(weekendClientMeeting.count, 10) || 1) : 0,
        };
      }

      // Keep linked Feedback / Recommendation docs in sync with flag changes
      if (negativeFeedbackFlag !== undefined && negativeFeedbackFlag !== report.negativeFeedbackFlag) {
        if (negativeFeedbackFlag) {
          const fb = await Feedback.create({
            employee: report.employee, givenBy: tlId, givenByRole: 'tl', sentiment: 'negative',
            comment: report.behaviourNotes || 'Flagged in TL weekly report',
            date: report.weekEndDate, sourceWeeklyReport: report._id,
          });
          report.linkedFeedback = fb._id;
        } else if (report.linkedFeedback) {
          await Feedback.findByIdAndDelete(report.linkedFeedback);
          report.linkedFeedback = null;
        }
        report.negativeFeedbackFlag = negativeFeedbackFlag;
      }
      if (recommendation !== undefined && recommendation !== report.recommendation) {
        if (recommendation) {
          const rec = await Recommendation.create({
            employee: report.employee, recommendedBy: tlId, recommendedByRole: 'tl',
            comment: report.behaviourNotes || 'Recommended in TL weekly report',
            date: report.weekEndDate, sourceWeeklyReport: report._id,
          });
          report.linkedRecommendation = rec._id;
        } else if (report.linkedRecommendation) {
          await Recommendation.findByIdAndDelete(report.linkedRecommendation);
          report.linkedRecommendation = null;
        }
        report.recommendation = recommendation;
      }

      await report.save();

      // Inline recompute so Analytics reflects the edit immediately
      try {
        const d = new Date(report.weekEndDate);
        await computeMonthlyScore(report.employee, d.getFullYear(), d.getMonth() + 1);
      } catch (e) { console.error('weekly report edit recompute failed:', e.message); }

      res.json({ success: true, message: 'Weekly report updated', data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /weekly-report?teamLead=&employee=&week= ─────────────────────────
  // TL → own submissions only; HR/Manager/Admin → all (read-only audit)
  getReports = async (req, res) => {
    try {
      const filter = {};
      if (req.user.role === 'tl') {
        filter.teamLead = req.user.id || req.user._id;
      } else if (req.query.teamLead) {
        filter.teamLead = req.query.teamLead;
      }
      if (req.query.employee) filter.employee = req.query.employee;
      if (req.query.week) {
        const ws = toWeekStart(req.query.week);
        filter.weekStartDate = ws;
      }

      const reports = await WeeklyReport.find(filter)
        .populate('teamLead', 'firstName lastName employeeId')
        .populate('employee', 'firstName lastName employeeId department designation')
        .sort({ weekStartDate: -1, createdAt: -1 })
        .limit(500);

      res.json({ success: true, count: reports.length, data: reports });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── PUT /weekly-report/:id/annotate — HR/Manager flag/annotate only ──────
  // HR can NOT silently alter TL input — only add a note (TL accountability).
  annotateReport = async (req, res) => {
    try {
      const { hrNote } = req.body;
      if (!hrNote || !hrNote.trim()) {
        return res.status(400).json({ success: false, message: 'hrNote is required' });
      }

      const report = await WeeklyReport.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            hrNote: hrNote.trim(),
            status: 'reviewed',
            reviewedBy: req.user.id || req.user._id,
            reviewedAt: new Date(),
          },
        },
        { new: true }
      );
      if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

      // 🔔 Tell the TL their report was reviewed/annotated
      await createNotification({
        recipient: report.teamLead,
        sender:    req.user.id || req.user._id,
        type:      'weekly_report_submitted',
        title:     'Weekly Report Reviewed',
        message:   `HR/Manager reviewed and annotated your weekly report for ${report.employeeName}.`,
        refId:     report._id,
        refModel:  'WeeklyReport',
      });

      res.json({ success: true, message: 'Report annotated', data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
}

module.exports = new WeeklyReportController();
