/*
 * Memat Digi Inc.
 * taskSheetController.js — daily task sheets.
 * Mirrors the Regularization employee-submit / HR-view pattern.
 *
 * Employee: submit/update their sheet for a day.
 * TL: view sheets ONLY for employees where teamLead_id === req.user.id.
 * Manager/HR/Admin: view all.
 */

const mongoose = require('mongoose');
const TaskSheet = require('../models/TaskSheet');
const User = require('../models/User');
const { notifyUsers } = require('./Notificationcontroller');

const normalizeDate = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

class TaskSheetController {

  // ── POST /task-sheet — employee submits/updates today's sheet ────────────
  submit = async (req, res) => {
    try {
      const employeeId = req.user.id || req.user._id;
      const { date, tasks, filled = true } = req.body;

      if (!date || !Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'date and a non-empty tasks array are required',
        });
      }

      const targetDate = normalizeDate(date);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date' });
      }

      const today = normalizeDate(new Date());
      if (targetDate > today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot submit a task sheet for a future date',
        });
      }

      const cleanTasks = tasks
        .filter(t => t.title && t.title.trim())
        .map(t => ({
          title: t.title.trim(),
          status: ['completed', 'incomplete', 'pending'].includes(t.status) ? t.status : 'pending',
          remark: (t.remark || '').trim(),
        }));

      if (!cleanTasks.length) {
        return res.status(400).json({ success: false, message: 'At least one task with a title is required' });
      }

      const sheet = await TaskSheet.findOneAndUpdate(
        { employee: employeeId, date: targetDate },
        {
          $set: {
            tasks: cleanTasks,
            filled: !!filled,
            submittedAt: filled ? new Date() : undefined,
          },
          $setOnInsert: { employee: employeeId, date: targetDate },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      // ── NOTIFY the employee's TL (if assigned) on submission ─────────────
      if (filled) {
        const emp = await User.findById(employeeId).select('firstName lastName teamLead_id');
        if (emp?.teamLead_id) {
          const dateLabel = targetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          await notifyUsers([emp.teamLead_id], {
            sender: employeeId,
            type: 'tasksheet_submitted',
            title: 'Task Sheet Submitted',
            message: `${emp.firstName} ${emp.lastName} submitted their task sheet for ${dateLabel} (${cleanTasks.length} tasks).`,
            refId: sheet._id,
            refModel: 'TaskSheet',
            meta: { date: targetDate, taskCount: cleanTasks.length },
          });
        }
      }

      res.status(201).json({ success: true, message: 'Task sheet saved', data: sheet });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /task-sheet/my — employee's own sheets (?month=&year=) ───────────
  getMine = async (req, res) => {
    try {
      const employeeId = req.user.id || req.user._id;
      const { month, year } = req.query;

      const filter = { employee: employeeId };
      if (month && year) {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        filter.date = { $gte: start, $lte: end };
      }

      const sheets = await TaskSheet.find(filter).sort({ date: -1 });
      res.json({ success: true, count: sheets.length, data: sheets });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /task-sheet — TL sees own team; HR/Manager/Admin see all ─────────
  // Query: ?employee=&date=&month=&year=&filled=
  getAll = async (req, res) => {
    try {
      const { employee, date, month, year, filled } = req.query;
      const filter = {};

      // TL scoping: only their team members
      if (req.user.role === 'tl') {
        const teamIds = await User.find({ teamLead_id: req.user.id })
          .select('_id').lean();
        const ids = teamIds.map(t => t._id);
        filter.employee = employee && ids.some(id => id.toString() === employee)
          ? new mongoose.Types.ObjectId(employee)
          : { $in: ids };
      } else if (employee) {
        filter.employee = employee;
      }

      if (date) filter.date = normalizeDate(date);
      else if (month && year) {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        filter.date = { $gte: start, $lte: end };
      }
      if (filled !== undefined) filter.filled = filled === 'true';

      const sheets = await TaskSheet.find(filter)
        .populate('employee', 'employeeId firstName lastName department designation')
        .sort({ date: -1 });

      res.json({ success: true, count: sheets.length, data: sheets });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── PUT /task-sheet/:id/review — TL/HR add a review note (read-only wf) ──
  review = async (req, res) => {
    try {
      const { reviewNote } = req.body;
      const sheet = await TaskSheet.findById(req.params.id);
      if (!sheet) return res.status(404).json({ success: false, message: 'Task sheet not found' });

      // TL can only review own team members' sheets
      if (req.user.role === 'tl') {
        const emp = await User.findById(sheet.employee).select('teamLead_id');
        if (!emp || emp.teamLead_id?.toString() !== req.user.id) {
          return res.status(403).json({ success: false, message: 'Access denied — not your team member' });
        }
      }

      sheet.reviewedBy = req.user.id;
      sheet.reviewedAt = new Date();
      sheet.reviewNote = (reviewNote || '').trim();
      await sheet.save();

      res.json({ success: true, message: 'Review saved', data: sheet });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
}

module.exports = new TaskSheetController();
