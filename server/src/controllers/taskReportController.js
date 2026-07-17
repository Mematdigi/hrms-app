const TaskReport = require('../models/TaskReport');
const User       = require('../models/User');
const { computeMonthlyScore } = require('../services/scoring.services');
const { createNotification } = require('./Notificationcontroller');

/**
 * Task Report — TEAM LEAD owned.
 *
 * The TL selects a team member, a date range, the number of tasks assigned and
 * the number completed. The employee has READ-ONLY access to their own reports.
 * Employees can never create or edit a task report.
 */
class TaskReportController {

  // ── Helper: is this employee on the requesting TL's team? ────────────────
  _assertOwnTeam = async (req, employeeId) => {
    // admin/hr/manager can log for anyone; TL is restricted to their own team
    if (req.user.role !== 'tl') return true;
    const emp = await User.findById(employeeId).select('teamLead_id').lean();
    const myId = (req.user.id || req.user._id).toString();
    return !!(emp && emp.teamLead_id && emp.teamLead_id.toString() === myId);
  };

  // ── POST /task-report — TL creates a task report for a team member ───────
  createReport = async (req, res) => {
    try {
      const tlId = req.user.id || req.user._id;
      const { employee, startDate, endDate, totalTasks, completedTasks, remarks = '' } = req.body;

      if (!employee || !startDate || !endDate || totalTasks === undefined || completedTasks === undefined) {
        return res.status(400).json({
          success: false,
          message: 'employee, startDate, endDate, totalTasks and completedTasks are required',
        });
      }

      const total     = parseInt(totalTasks, 10);
      const completed = parseInt(completedTasks, 10);

      if (isNaN(total) || isNaN(completed) || total < 0 || completed < 0) {
        return res.status(400).json({ success: false, message: 'totalTasks and completedTasks must be non-negative numbers' });
      }
      if (completed > total) {
        return res.status(400).json({ success: false, message: 'completedTasks cannot exceed totalTasks' });
      }

      const start = new Date(startDate);
      const end   = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid startDate or endDate' });
      }
      if (start > end) {
        return res.status(400).json({ success: false, message: 'startDate cannot be after endDate' });
      }
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      if (!(await this._assertOwnTeam(req, employee))) {
        return res.status(403).json({ success: false, message: 'You can only log task reports for your own team members' });
      }

      const emp = await User.findById(employee).select('firstName lastName');
      if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

      // Block an exact-duplicate window for the same employee
      const duplicate = await TaskReport.findOne({ employee, startDate: start, endDate: end });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'A task report already exists for this employee and date range — edit it instead',
        });
      }

      const tl = await User.findById(tlId).select('firstName lastName');

      const report = new TaskReport({
        teamLead: tlId,
        teamLeadName: tl ? `${tl.firstName} ${tl.lastName}` : '',
        employee,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        startDate: start,
        endDate: end,
        totalTasks: total,
        completedTasks: completed,
        remarks,
      });
      await report.save();

      // Recompute the affected month immediately so Analytics updates instantly
      try {
        await computeMonthlyScore(employee, end.getFullYear(), end.getMonth() + 1);
      } catch (e) { console.error('task report inline recompute failed:', e.message); }

      // 🔔 Notify the employee — they can now view their updated task report
      await createNotification({
        recipient: employee,
        sender:    tlId,
        type:      'task_report_updated',
        title:     'Your Task Report Was Updated',
        message:   `Your Team Lead logged ${completed}/${total} tasks completed for ${start.toDateString()} – ${new Date(endDate).toDateString()} (${report.completionRate}%).`,
        refId:     report._id,
        refModel:  'TaskReport',
        meta:      { totalTasks: total, completedTasks: completed, completionRate: report.completionRate },
      });

      res.status(201).json({ success: true, message: 'Task report created', data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── PUT /task-report/:id — TL edits their own report ─────────────────────
  updateReport = async (req, res) => {
    try {
      const tlId = req.user.id || req.user._id;
      const report = await TaskReport.findById(req.params.id);
      if (!report) return res.status(404).json({ success: false, message: 'Task report not found' });

      if (req.user.role === 'tl' && report.teamLead.toString() !== tlId.toString()) {
        return res.status(403).json({ success: false, message: 'You can only edit task reports you created' });
      }

      const { startDate, endDate, totalTasks, completedTasks, remarks } = req.body;

      if (startDate !== undefined) {
        const s = new Date(startDate);
        if (isNaN(s.getTime())) return res.status(400).json({ success: false, message: 'Invalid startDate' });
        s.setHours(0, 0, 0, 0);
        report.startDate = s;
      }
      if (endDate !== undefined) {
        const e = new Date(endDate);
        if (isNaN(e.getTime())) return res.status(400).json({ success: false, message: 'Invalid endDate' });
        e.setHours(23, 59, 59, 999);
        report.endDate = e;
      }
      if (report.startDate > report.endDate) {
        return res.status(400).json({ success: false, message: 'startDate cannot be after endDate' });
      }

      if (totalTasks !== undefined)     report.totalTasks = Math.max(0, parseInt(totalTasks, 10) || 0);
      if (completedTasks !== undefined) report.completedTasks = Math.max(0, parseInt(completedTasks, 10) || 0);
      if (report.completedTasks > report.totalTasks) {
        return res.status(400).json({ success: false, message: 'completedTasks cannot exceed totalTasks' });
      }
      if (remarks !== undefined) report.remarks = remarks;

      await report.save(); // pre-save recalculates incompleteTasks + completionRate

      try {
        const d = new Date(report.endDate);
        await computeMonthlyScore(report.employee, d.getFullYear(), d.getMonth() + 1);
      } catch (e) { console.error('task report edit recompute failed:', e.message); }

      // 🔔 Notify the employee of the revision
      await createNotification({
        recipient: report.employee,
        sender:    tlId,
        type:      'task_report_updated',
        title:     'Your Task Report Was Revised',
        message:   `Your Team Lead updated your task report to ${report.completedTasks}/${report.totalTasks} tasks completed (${report.completionRate}%).`,
        refId:     report._id,
        refModel:  'TaskReport',
      });

      res.json({ success: true, message: 'Task report updated', data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── DELETE /task-report/:id — TL removes their own report ───────────────
  deleteReport = async (req, res) => {
    try {
      const tlId = req.user.id || req.user._id;
      const report = await TaskReport.findById(req.params.id);
      if (!report) return res.status(404).json({ success: false, message: 'Task report not found' });

      if (req.user.role === 'tl' && report.teamLead.toString() !== tlId.toString()) {
        return res.status(403).json({ success: false, message: 'You can only delete task reports you created' });
      }

      const { employee, endDate } = report;
      await report.deleteOne();

      try {
        const d = new Date(endDate);
        await computeMonthlyScore(employee, d.getFullYear(), d.getMonth() + 1);
      } catch (e) { console.error('task report delete recompute failed:', e.message); }

      res.json({ success: true, message: 'Task report deleted' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /task-report/my?month=&year= — EMPLOYEE read-only view ──────────
  getMyReports = async (req, res) => {
    try {
      const employeeId = req.user.id || req.user._id;
      const filter = { employee: employeeId };

      if (req.query.month && req.query.year) {
        const y = parseInt(req.query.year, 10);
        const m = parseInt(req.query.month, 10);
        const monthStart = new Date(y, m - 1, 1);
        const monthEnd   = new Date(y, m, 0, 23, 59, 59, 999);
        // Any report overlapping the selected month
        filter.startDate = { $lte: monthEnd };
        filter.endDate   = { $gte: monthStart };
      }

      const reports = await TaskReport.find(filter)
        .populate('teamLead', 'firstName lastName employeeId')
        .sort({ startDate: -1 });

      const summary = reports.reduce((acc, r) => {
        acc.totalTasks     += r.totalTasks;
        acc.completedTasks += r.completedTasks;
        acc.incompleteTasks += r.incompleteTasks;
        return acc;
      }, { totalTasks: 0, completedTasks: 0, incompleteTasks: 0 });
      summary.completionRate = summary.totalTasks > 0
        ? Math.round((summary.completedTasks / summary.totalTasks) * 100)
        : 0;

      res.json({ success: true, count: reports.length, summary, data: reports });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /task-report/team?employeeId=&month=&year= ──────────────────────
  // TL → own team only. Manager/HR/Admin → everyone.
  getTeamReports = async (req, res) => {
    try {
      const { employeeId, month, year } = req.query;
      const filter = {};

      if (req.user.role === 'tl') {
        const myId = req.user.id || req.user._id;
        const team = await User.find({ teamLead_id: myId, isActive: true }).select('_id').lean();
        const teamIds = team.map(u => u._id.toString());
        filter.employee = (employeeId && teamIds.includes(employeeId))
          ? employeeId
          : { $in: teamIds };
      } else if (employeeId) {
        filter.employee = employeeId;
      }

      if (month && year) {
        const y = parseInt(year, 10);
        const m = parseInt(month, 10);
        const monthStart = new Date(y, m - 1, 1);
        const monthEnd   = new Date(y, m, 0, 23, 59, 59, 999);
        filter.startDate = { $lte: monthEnd };
        filter.endDate   = { $gte: monthStart };
      }

      const reports = await TaskReport.find(filter)
        .populate('employee', 'firstName lastName employeeId department designation')
        .populate('teamLead', 'firstName lastName employeeId')
        .sort({ startDate: -1 })
        .limit(500);

      res.json({ success: true, count: reports.length, data: reports });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
}

module.exports = new TaskReportController();
