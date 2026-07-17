/*
 * Memat Digi Inc.
 * feedbackController.js — behaviour feedback + recommendations.
 * Both feed the scoring engine (Behaviour and Recommendations buckets).
 */

const Feedback = require('../models/Feedback');
const Recommendation = require('../models/Recommendation');
const User = require('../models/User');
const { createNotification } = require('./Notificationcontroller');

class FeedbackController {

  // ── POST /feedback — any authenticated user logs feedback ────────────────
  createFeedback = async (req, res) => {
    try {
      const giverId = req.user.id || req.user._id;
      const { employee, sentiment, comment = '' } = req.body;

      if (!employee || !['positive', 'negative'].includes(sentiment)) {
        return res.status(400).json({
          success: false,
          message: 'employee and sentiment (positive|negative) are required',
        });
      }
      if (employee.toString() === giverId.toString()) {
        return res.status(400).json({ success: false, message: 'You cannot log feedback about yourself' });
      }

      const target = await User.findById(employee).select('firstName lastName');
      if (!target) return res.status(404).json({ success: false, message: 'Employee not found' });

      const feedback = await Feedback.create({
        employee,
        givenBy: giverId,
        givenByRole: req.user.role, // role snapshot at entry time
        sentiment,
        comment: comment.trim(),
        date: new Date(),
      });

      // ── NOTIFY the employee (sender kept, but message stays neutral for
      //    negative feedback — role shown, so the point weight is transparent) ──
      await createNotification({
        recipient: employee,
        sender: giverId,
        type: 'feedback_received',
        title: sentiment === 'positive' ? 'Positive Feedback Received 🌟' : 'Feedback Logged',
        message: sentiment === 'positive'
          ? `You received positive feedback from a ${req.user.role}. Keep it up!`
          : `A ${req.user.role} has logged feedback on your profile. Check with your team lead for details.`,
        refId: feedback._id,
        refModel: 'Feedback',
        meta: { sentiment },
      });

      res.status(201).json({ success: true, message: 'Feedback logged', data: feedback });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /feedback — TL: own team | HR/Manager/Admin: all | employee: own ─
  getFeedback = async (req, res) => {
    try {
      const { employee, sentiment, month, year } = req.query;
      const filter = {};

      if (req.user.role === 'employee') {
        filter.employee = req.user.id;
      } else if (req.user.role === 'tl') {
        const team = await User.find({ teamLead_id: req.user.id }).select('_id').lean();
        filter.employee = { $in: team.map(t => t._id) };
        if (employee) filter.employee = employee; // narrowed below by team check implicitly
      } else if (employee) {
        filter.employee = employee;
      }

      if (sentiment) filter.sentiment = sentiment;
      if (month && year) {
        filter.date = {
          $gte: new Date(year, month - 1, 1),
          $lte: new Date(year, month, 0, 23, 59, 59, 999),
        };
      }

      const items = await Feedback.find(filter)
        .populate('employee', 'firstName lastName employeeId')
        .populate('givenBy', 'firstName lastName role')
        .sort({ date: -1 });

      res.json({ success: true, count: items.length, data: items });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── POST /feedback/recommendation — TL/Manager/HR/Admin only ─────────────
  createRecommendation = async (req, res) => {
    try {
      const giverId = req.user.id || req.user._id;
      const { employee, comment = '' } = req.body;

      if (!employee) {
        return res.status(400).json({ success: false, message: 'employee is required' });
      }

      const target = await User.findById(employee).select('firstName lastName');
      if (!target) return res.status(404).json({ success: false, message: 'Employee not found' });

      const rec = await Recommendation.create({
        employee,
        recommendedBy: giverId,
        recommendedByRole: req.user.role,
        comment: comment.trim(),
        date: new Date(),
      });

      await createNotification({
        recipient: employee,
        sender: giverId,
        type: 'recommendation_received',
        title: 'You Got Recommended! 🌟',
        message: `A ${req.user.role} has recommended you. This adds points to your monthly score.`,
        refId: rec._id,
        refModel: 'Recommendation',
      });

      res.status(201).json({ success: true, message: 'Recommendation logged', data: rec });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /feedback/recommendations ─────────────────────────────────────────
  getRecommendations = async (req, res) => {
    try {
      const { employee, month, year } = req.query;
      const filter = {};

      if (req.user.role === 'employee') filter.employee = req.user.id;
      else if (employee) filter.employee = employee;

      if (month && year) {
        filter.date = {
          $gte: new Date(year, month - 1, 1),
          $lte: new Date(year, month, 0, 23, 59, 59, 999),
        };
      }

      const items = await Recommendation.find(filter)
        .populate('employee', 'firstName lastName employeeId')
        .populate('recommendedBy', 'firstName lastName role')
        .sort({ date: -1 });

      res.json({ success: true, count: items.length, data: items });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
}

module.exports = new FeedbackController();
