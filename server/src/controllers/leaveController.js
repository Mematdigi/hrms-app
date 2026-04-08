const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveDefaults = require('../models/LeaveDefaults');
const User = require('../models/User');
const Payroll = require('../models/Payroll');
const nodemailer = require('nodemailer');
const { createNotification, notifyAllHR } = require('./Notificationcontroller');
const xlsx = require('xlsx');
const Employee = require('../models/Employee');

// ─── Email Transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  }
});

const sendMail = (options) => {
  transporter.sendMail(options, (err, info) => {
    if (err) console.error('Email error:', err.message);
    else console.log('Email sent:', info.response);
  });
};

// ─── Helper: get or create LeaveBalance for employee+year ────────────────────
const getOrCreateLeaveBalance = async (employeeId, year) => {
  const defaults = await LeaveDefaults.findOne();
  let balance = await LeaveBalance.findOne({ employee: employeeId, year });

  if (!balance) {
    balance = await LeaveBalance.create({
      employee: employeeId,
      year,
      casualTotal: defaults?.casualDefault ?? 8,
      sickTotal: defaults?.sickDefault ?? 6,
      earnedTotal: defaults?.earnedDefault ?? 14,
      maternityTotal: defaults?.maternityDefault ?? 90,
      paternityTotal: defaults?.paternityDefault ?? 15,
      shortLeaveTotal: defaults?.shortLeaveTotal ?? 3,
    });
  }
  return balance;
};

// ─── Helper: compute used days per leave type for an employee ─────────────────
/**
 * Aggregates ALL APPROVED leave requests for an employee in the given year.
 * Returns { casual, sick, earned, maternity, paternity, unpaid }  (days used)
 * Short leaves are counted separately by month.
 */
const computeUsedLeaves = async (employeeId, year) => {
  const yearStart = new Date(year, 0, 1, 0, 0, 0);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  // Aggregate approved leaves for this year
  const agg = await Leave.aggregate([
    {
      $match: {
        employee: require('mongoose').Types.ObjectId.createFromHexString
          ? require('mongoose').Types.ObjectId.createFromHexString(String(employeeId))
          : new (require('mongoose').Types.ObjectId)(String(employeeId)),
        status: 'approved',
        startDate: { $gte: yearStart, $lte: yearEnd }
      }
    },
    {
      $group: {
        _id: '$leaveType',
        totalDays: { $sum: '$numberOfDays' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Build a map: { casual: N, sick: N, earned: N, ... }
  const usedMap = { casual: 0, sick: 0, earned: 0, maternity: 0, paternity: 0, unpaid: 0, short: 0 };
  agg.forEach(row => {
    if (usedMap.hasOwnProperty(row._id)) {
      usedMap[row._id] = row.totalDays;
    }
  });

  return usedMap;
};

// ─── Helper: compute short leaves used THIS MONTH ────────────────────────────
const computeShortLeavesThisMonth = async (employeeId) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  return await Leave.countDocuments({
    employee: employeeId,
    leaveType: 'short',
    status: { $in: ['pending', 'approved'] },
    startDate: { $gte: start, $lte: end }
  });
};

// ═════════════════════════════════════════════════════════════════════════════
class LeaveController {

  // ───────────────────────────────────────────────────────────────────────────
  // APPLY LEAVE
  // ───────────────────────────────────────────────────────────────────────────
  applyLeave = async (req, res) => {
    try {
      const { employeeId, leaveType, startDate, endDate, reason, category, fromTime, toTime } = req.body;

      if (!employeeId || !leaveType || !startDate) {
        return res.status(400).json({ message: 'employeeId, leaveType and startDate are required.' });
      }

      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date(startDate);

      // Clamp: end cannot be before start
      if (end < start) {
        return res.status(400).json({ message: 'End date cannot be before start date.' });
      }

      // numberOfDays: for Short leave always 0 (hour-based), for Full Day ≥ 1
      const isShort = leaveType === 'Short';
      const numberOfDays = isShort
        ? 0
        : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      const year = start.getFullYear();

      // ── BALANCE CHECK ──────────────────────────────────────────────────────
      if (isShort) {
        // Short leave: check monthly limit
        const shortUsed = await computeShortLeavesThisMonth(employeeId);
        const balance = await getOrCreateLeaveBalance(employeeId, year);
        if (shortUsed >= balance.shortLeaveLimit) {
          return res.status(400).json({
            message: `Short leave limit reached (${balance.shortLeaveLimit}/month). Please apply for a Full Day leave.`
          });
        }
      } else {
        // Full day: check yearly balance per leave type
        const balance = await getOrCreateLeaveBalance(employeeId, year);
        const used = await computeUsedLeaves(employeeId, year);

        if (leaveType === 'casual') {
          const remaining = balance.casualTotal - used.casual;
          if (numberOfDays > remaining) {
            return res.status(400).json({
              message: `Insufficient casual leave. Remaining: ${remaining} day(s), Requested: ${numberOfDays}.`
            });
          }
        }
        if (leaveType === 'sick') {
          const remaining = balance.sickTotal - used.sick;
          if (numberOfDays > remaining) {
            return res.status(400).json({
              message: `Insufficient sick leave. Remaining: ${remaining} day(s), Requested: ${numberOfDays}.`
            });
          }
        }
        if (leaveType === 'earned') {
          const remaining = balance.earnedTotal - used.earned;
          if (numberOfDays > remaining) {
            return res.status(400).json({
              message: `Insufficient earned leave. Remaining: ${remaining} day(s), Requested: ${numberOfDays}.`
            });
          }
        }
        if (leaveType === 'maternity') {
          const remaining = balance.maternityTotal - used.maternity;
          if (numberOfDays > remaining) {
            return res.status(400).json({
              message: `Insufficient maternity leave. Remaining: ${remaining} day(s), Requested: ${numberOfDays}.`
            });
          }
        }
        if (leaveType === 'paternity') {
          const remaining = balance.paternityTotal - used.paternity;
          if (numberOfDays > remaining) {
            return res.status(400).json({
              message: `Insufficient paternity leave. Remaining: ${remaining} day(s), Requested: ${numberOfDays}.`
            });
          }
        }
      }

      // ── CREATE LEAVE REQUEST ───────────────────────────────────────────────
      const leave = new Leave({
        employee: employeeId,
        leaveType,
        startDate: start,
        endDate: end,
        numberOfDays,
        reason: reason || '',
        status: 'pending',
        category: category || 'Full',
        fromTime: fromTime || null,
        toTime: toTime || null,
      });

      await leave.save();
      await leave.populate('employee', 'firstName lastName email department');

      // ── NOTIFY HR (in-app) ────────────────────────────────────────────────
      const empName = `${leave.employee.firstName} ${leave.employee.lastName}`;
      await notifyAllHR({
        sender: leave.employee._id,
        type: 'leave_applied',
        title: 'New Leave Request',
        message: `${empName} has applied for ${leaveType} leave (${numberOfDays} day${numberOfDays !== 1 ? 's' : ''}).`,
        refId: leave._id,
        refModel: 'Leave',
        meta: { leaveType, numberOfDays, startDate, endDate },
      });

      // ── NOTIFY HR (email) ─────────────────────────────────────────────────
      const hrManagers = await User.find({ role: 'hr' }, 'email firstName lastName');
      if (hrManagers.length > 0) {
        const emp = leave.employee;
        const emailList = hrManagers.map(h => h.email).filter(Boolean).join(', ');
        sendMail({
          from: process.env.EMAIL_USER || 'your-email@gmail.com',
          to: emailList,
          subject: `New Leave Request – ${emp.firstName} ${emp.lastName}`,
          html: `
            <h2>New Leave Request for Approval</h2>
            <p><strong>Employee:</strong> ${emp.firstName} ${emp.lastName}</p>
            <p><strong>Department:</strong> ${emp.department || 'N/A'}</p>
            <p><strong>Leave Type:</strong> ${leaveType}</p>
            <p><strong>Category:</strong> ${category || 'Full Day'}</p>
            <p><strong>Start Date:</strong> ${start.toLocaleDateString()}</p>
            <p><strong>End Date:</strong> ${end.toLocaleDateString()}</p>
            <p><strong>Number of Days:</strong> ${numberOfDays}</p>
            <p><strong>Reason:</strong> ${reason || 'N/A'}</p>
            <p><strong>Status:</strong> <span style="color:orange;font-weight:bold;">PENDING APPROVAL</span></p>
            <p>Please log in to the HRMS to approve or reject this request.</p>
          `
        });
      }

      return res.status(201).json({
        message: 'Leave application submitted successfully. HR will review your request.',
        leave
      });
    } catch (error) {
      console.error('applyLeave error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // GET LEAVE REQUESTS (list with history)
  // ───────────────────────────────────────────────────────────────────────────
  getLeaveRequests = async (req, res) => {
    try {
      const { employeeId, status, role } = req.query;
      const query = {};

      if (role === 'employee' && employeeId) {
        query.employee = employeeId;
        // Employee sees their own leaves (all except 'left' status)
        query.status = { $ne: 'left' };
      } else if (role === 'hr' || role === 'manager' || role === 'admin') {
        if (status) query.status = status;
        else query.status = { $ne: 'left' };
      } else if (status) {
        query.status = status;
      }

      const leaves = await Leave.find(query)
        .populate({ path: 'employee', select: 'firstName lastName email department designation dateOfJoining employeeId' })
        .populate({ path: 'approvedBy', select: 'firstName lastName' })
        .sort({ createdAt: -1 })
        .lean();

      if (!leaves || leaves.length === 0) return res.json([]);

      // Attach leave history per employee
      const employeeIds = [...new Set(
        leaves.map(l => l.employee?._id?.toString()).filter(Boolean)
      )];

      const allLeavesForEmployees = await Leave.find({
        employee: { $in: employeeIds },
        status: { $ne: 'left' }
      }).sort({ createdAt: -1 }).lean();

      const historyMap = {};
      allLeavesForEmployees.forEach(lv => {
        const id = lv.employee.toString();
        if (!historyMap[id]) historyMap[id] = [];
        historyMap[id].push(lv);
      });

      const enriched = leaves.map(l => {
        const id = l.employee?._id?.toString();
        return { ...l, employeeLeaveHistory: id ? historyMap[id] || [] : [] };
      });

      return res.json(enriched);
    } catch (error) {
      console.error('getLeaveRequests error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // GET PENDING LEAVE REQUESTS
  // ───────────────────────────────────────────────────────────────────────────
  getPendingLeaveRequests = async (req, res) => {
    try {
      const leaves = await Leave.find({ status: 'pending' })
        .populate('employee', 'firstName lastName email department')
        .sort({ createdAt: -1 });
      return res.json(leaves);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // APPROVE LEAVE
  // ───────────────────────────────────────────────────────────────────────────
  approveLeave = async (req, res) => {
    try {
      const { leaveId, approverId } = req.body;

      if (!leaveId || !approverId) {
        return res.status(400).json({ message: 'leaveId and approverId are required.' });
      }

      const leave = await Leave.findById(leaveId)
        .populate('employee', 'firstName lastName email employeeId _id');

      if (!leave) return res.status(404).json({ message: 'Leave not found.' });
      if (leave.status === 'approved') return res.status(400).json({ message: 'Leave is already approved.' });
      if (leave.status === 'rejected') return res.status(400).json({ message: 'Cannot approve a rejected leave. Ask employee to re-apply.' });

      // ── Update status ──────────────────────────────────────────────────────
      // NOTE: No balance deduction here — balances are computed dynamically
      // by aggregating approved records in getEmployeeBalances.
      leave.status = 'approved';
      leave.approvedBy = approverId;
      leave.approvalDate = new Date();
      leave.updatedAt = new Date();
      await leave.save();

      // ── NOTIFY Employee (in-app) ───────────────────────────────────────────
      await createNotification({
        recipient: leave.employee._id,
        sender: approverId,
        type: 'leave_approved',
        title: 'Leave Request Approved ✅',
        message: `Your ${leave.leaveType} leave request (${leave.numberOfDays} day${leave.numberOfDays !== 1 ? 's' : ''}) has been approved.`,
        refId: leave._id,
        refModel: 'Leave',
        meta: { leaveType: leave.leaveType, numberOfDays: leave.numberOfDays },
      });

      // ── Send approval email ────────────────────────────────────────────────
      const approver = await User.findById(approverId).select('firstName lastName');
      if (leave.employee?.email) {
        sendMail({
          from: process.env.EMAIL_USER || 'your-email@gmail.com',
          to: leave.employee.email,
          subject: 'Leave Request Approved ✅',
          html: `
            <h2>Your Leave Request Has Been Approved</h2>
            <p>Dear ${leave.employee.firstName} ${leave.employee.lastName},</p>
            <p>Your leave request has been approved${approver ? ' by <strong>' + approver.firstName + ' ' + approver.lastName + '</strong>' : ''}.</p>
            <table style="border-collapse:collapse;width:100%;max-width:400px">
              <tr><td style="padding:6px;border:1px solid #eee;font-weight:bold">Leave Type</td><td style="padding:6px;border:1px solid #eee">${leave.leaveType}</td></tr>
              <tr><td style="padding:6px;border:1px solid #eee;font-weight:bold">Start Date</td><td style="padding:6px;border:1px solid #eee">${new Date(leave.startDate).toLocaleDateString()}</td></tr>
              <tr><td style="padding:6px;border:1px solid #eee;font-weight:bold">End Date</td><td style="padding:6px;border:1px solid #eee">${new Date(leave.endDate).toLocaleDateString()}</td></tr>
              <tr><td style="padding:6px;border:1px solid #eee;font-weight:bold">Days</td><td style="padding:6px;border:1px solid #eee">${leave.numberOfDays}</td></tr>
            </table>
            <p style="color:#05CD99;font-weight:bold">Status: APPROVED</p>
          `
        });
      }

      // ── Update payroll deduction if payroll exists for this month ──────────
      try {
        const payroll = await Payroll.findOne({
          employee: leave.employee._id,
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear()
        });
        if (payroll && leave.numberOfDays > 0) {
          const perDay = payroll.baseSalary / (payroll.workingDays || 26);
          payroll.deductions = (payroll.deductions || 0) + (perDay * leave.numberOfDays);
          payroll.netSalary = payroll.baseSalary - payroll.deductions;
          await payroll.save();
        }
      } catch (payrollErr) {
        console.error('Payroll update failed (non-critical):', payrollErr.message);
      }

      return res.json({ message: 'Leave approved successfully.', leave });
    } catch (error) {
      console.error('approveLeave error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // REJECT LEAVE
  // ───────────────────────────────────────────────────────────────────────────
  rejectLeave = async (req, res) => {
    try {
      const { leaveId, rejectionReason, approverId } = req.body;

      if (!leaveId || !approverId) {
        return res.status(400).json({ message: 'leaveId and approverId are required.' });
      }

      const leave = await Leave.findById(leaveId)
        .populate('employee', 'firstName lastName email employeeId');

      if (!leave) return res.status(404).json({ message: 'Leave not found.' });
      if (leave.status === 'rejected') return res.status(400).json({ message: 'Leave is already rejected.' });

      // ── Update status ──────────────────────────────────────────────────────
      // NOTE: No balance restoration needed — balances are computed dynamically.
      // Rejected records simply won't be counted in the approved aggregation.
      leave.status = 'rejected';
      leave.approvedBy = approverId;
      leave.approvalDate = new Date();
      leave.rejectionReason = rejectionReason || '';
      leave.updatedAt = new Date();
      await leave.save();

      // ── NOTIFY Employee (in-app) ───────────────────────────────────────────
      await createNotification({
        recipient: leave.employee._id,
        sender: approverId,
        type: 'leave_rejected',
        title: 'Leave Request Rejected ❌',
        message: `Your ${leave.leaveType} leave request has been rejected. Reason: ${rejectionReason || 'No reason provided'}.`,
        refId: leave._id,
        refModel: 'Leave',
        meta: { leaveType: leave.leaveType, rejectionReason },
      });

      // ── Send rejection email ───────────────────────────────────────────────
      const approver = await User.findById(approverId).select('firstName lastName');
      if (leave.employee?.email) {
        sendMail({
          from: process.env.EMAIL_USER || 'your-email@gmail.com',
          to: leave.employee.email,
          subject: 'Leave Request Rejected ❌',
          html: `
            <h2>Your Leave Request Has Been Rejected</h2>
            <p>Dear ${leave.employee.firstName} ${leave.employee.lastName},</p>
            <p>Your leave request has been rejected${approver ? ' by <strong>' + approver.firstName + ' ' + approver.lastName + '</strong>' : ''}.</p>
            <p><strong>Rejection Reason:</strong> ${rejectionReason || 'No reason provided'}</p>
            <table style="border-collapse:collapse;width:100%;max-width:400px">
              <tr><td style="padding:6px;border:1px solid #eee;font-weight:bold">Leave Type</td><td style="padding:6px;border:1px solid #eee">${leave.leaveType}</td></tr>
              <tr><td style="padding:6px;border:1px solid #eee;font-weight:bold">Start Date</td><td style="padding:6px;border:1px solid #eee">${new Date(leave.startDate).toLocaleDateString()}</td></tr>
              <tr><td style="padding:6px;border:1px solid #eee;font-weight:bold">End Date</td><td style="padding:6px;border:1px solid #eee">${new Date(leave.endDate).toLocaleDateString()}</td></tr>
              <tr><td style="padding:6px;border:1px solid #eee;font-weight:bold">Days</td><td style="padding:6px;border:1px solid #eee">${leave.numberOfDays}</td></tr>
            </table>
            <p style="color:#EE5D50;font-weight:bold">Status: REJECTED</p>
            <p>Please contact HR for more information.</p>
          `
        });
      }

      return res.json({ message: 'Leave rejected successfully.', leave });
    } catch (error) {
      console.error('rejectLeave error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // GET LEAVE STATS (global counts for HR dashboard)
  // ───────────────────────────────────────────────────────────────────────────
  getLeaveStats = async (req, res) => {
    try {
      const [pending, approved, rejected] = await Promise.all([
        Leave.countDocuments({ status: 'pending' }),
        Leave.countDocuments({ status: 'approved' }),
        Leave.countDocuments({ status: 'rejected' }),
      ]);
      return res.json({ pending, approved, rejected });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // GET LEAVE DEFAULTS (global settings)
  // ───────────────────────────────────────────────────────────────────────────
  getDefaults = async (req, res) => {
    try {
      let defaults = await LeaveDefaults.findOne();
      if (!defaults) {
        defaults = await LeaveDefaults.create({
          casualDefault: 8,
          sickDefault: 6,
          earnedDefault: 14,
          shortLeaveLimit: 3
        });
      }
      return res.json(defaults);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // UPDATE LEAVE DEFAULTS (HR only)
  // ───────────────────────────────────────────────────────────────────────────
  updateDefaults = async (req, res) => {
    try {
      const { casualDefault, sickDefault, earnedDefault, shortLeaveLimit } = req.body;

      if (casualDefault !== undefined && typeof casualDefault !== 'number') {
        return res.status(400).json({ message: 'casualDefault must be a number.' });
      }
      if (sickDefault !== undefined && typeof sickDefault !== 'number') {
        return res.status(400).json({ message: 'sickDefault must be a number.' });
      }

      const update = {};
      if (casualDefault !== undefined) update.casualDefault = casualDefault;
      if (sickDefault !== undefined) update.sickDefault = sickDefault;
      if (earnedDefault !== undefined) update.earnedDefault = earnedDefault;
      if (shortLeaveLimit !== undefined) update.shortLeaveLimit = shortLeaveLimit;

      const updatedDefaults = await LeaveDefaults.findOneAndUpdate(
        {},
        { $set: update },
        { new: true, upsert: true }
      );
      return res.json(updatedDefaults);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // GET EMPLOYEE LEAVE BALANCES  ← FULLY REWRITTEN — CORRECT CALCULATIONS
  // Route: GET /leave/balances/:employeeId
  // ───────────────────────────────────────────────────────────────────────────
  getEmployeeBalances = async (req, res) => {
    try {
      const { employeeId } = req.params;
      const year = new Date().getFullYear();

      if (!employeeId) {
        return res.status(400).json({ message: 'employeeId is required.' });
      }

      // 1. Get or create this employee's balance allocation for current year
      const balance = await getOrCreateLeaveBalance(employeeId, year);

      // 2. Compute USED days per type by aggregating APPROVED leave records
      const used = await computeUsedLeaves(employeeId, year);
      //    used = { casual: N, sick: N, earned: N, maternity: N, paternity: N, unpaid: N }

      // 3. Short leaves used THIS month (pending + approved)
      const shortLeavesUsed = await computeShortLeavesThisMonth(employeeId);
      const shortLeavesLimit = balance.shortLeaveTotal;

      // 4. Compute REMAINING = total - used  (clamp to 0)
      const clamp = (val) => Math.max(val, 0);

      const casualRemaining = clamp(balance.casualTotal - used.casual);
      const sickRemaining = clamp(balance.sickTotal - used.sick);
      const earnedRemaining = clamp(balance.earnedTotal - used.earned);
      const maternityRemaining = clamp(balance.maternityTotal - used.maternity);
      const paternityRemaining = clamp(balance.paternityTotal - used.paternity);

      return res.json({
        year,
        employee: employeeId,

        // ── Casual Leave ────────────────────────────────────────────────────
        casualTotal: balance.casualTotal,
        casualUsed: used.casual,
        casualRemaining,

        // ── Sick Leave ──────────────────────────────────────────────────────
        sickTotal: balance.sickTotal,
        sickUsed: used.sick,         // ✅ This now correctly reflects approved sick leaves
        sickRemaining,

        // ── Earned / Annual Leave ───────────────────────────────────────────
        earnedTotal: balance.earnedTotal,
        earnedUsed: used.earned,        // ✅ Only earned-type leaves counted
        earnedRemaining,
        // Aliases for frontend compatibility
        annualTotal: balance.earnedTotal,
        annualUsed: used.earned,        // ✅ annualUsed = earned leave only, not casual/sick

        // ── Maternity Leave ─────────────────────────────────────────────────
        maternityTotal: balance.maternityTotal,
        maternityUsed: used.maternity,
        maternityRemaining,

        // ── Paternity Leave ─────────────────────────────────────────────────
        paternityTotal: balance.paternityTotal,
        paternityUsed: used.paternity,
        paternityRemaining,

        // ── Short Leaves (monthly) ──────────────────────────────────────────
        shortLeavesUsed,
        shortLeavesLimit,
        shortLeavesRemaining: clamp(shortLeavesLimit - shortLeavesUsed),

        // ── Summary (total days off taken all types this year) ──────────────
        totalUsedThisYear: used.casual + used.sick + used.earned + used.maternity + used.paternity + used.unpaid,
      });
    } catch (error) {
      console.error('getEmployeeBalances error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // UPDATE EMPLOYEE LEAVE ALLOCATION (HR: set custom totals for one employee)
  // Route: PUT /leave/balances/:employeeId
  // ───────────────────────────────────────────────────────────────────────────
  updateEmployeeBalances = async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { casualTotal, sickTotal, earnedTotal, maternityTotal, paternityTotal, shortLeaveLimit, year } = req.body;

      const targetYear = year || new Date().getFullYear();
      const balance = await getOrCreateLeaveBalance(employeeId, targetYear);

      if (casualTotal !== undefined) balance.casualTotal = casualTotal;
      if (sickTotal !== undefined) balance.sickTotal = sickTotal;
      if (earnedTotal !== undefined) balance.earnedTotal = earnedTotal;
      if (maternityTotal !== undefined) balance.maternityTotal = maternityTotal;
      if (paternityTotal !== undefined) balance.paternityTotal = paternityTotal;
      if (shortLeaveLimit !== undefined) balance.shortLeaveLimit = shortLeaveLimit;
      balance.updatedAt = new Date();

      await balance.save();
      return res.json({ message: 'Leave allocation updated.', balance });
    } catch (error) {
      console.error('updateEmployeeBalances error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ── paste starts here ──────────────────────────────────────────────────────

  downloadLeaveTemplate = async (req, res) => {
    try {
      const xlsx = require('xlsx');
      const headers = [
        'Employee Name', 'Department', 'Designation', 'Intern/Probation', 'Leave Type',
        'Leave Start Date', 'Leave End Date', 'Total Days', 'Leave Status',
        'Medical Document Submitted', 'Applied On', 'Remarks',
      ];
      const sample = ['Jane Smith', 'Marketing', 'Manager', 'Full', 'sick', '01/06/2025', '02/06/2025', '2', 'approved', 'Yes', '31/05/2025', 'Fever and cold'];
      const ws = xlsx.utils.aoa_to_sheet([headers, sample]);
      const wb = xlsx.utils.book_new();
      ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));
      xlsx.utils.book_append_sheet(wb, ws, 'Leave Data');
      const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename="leave_upload_template.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    } catch (error) {
      console.error('downloadLeaveTemplate error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  bulkUploadLeaves = async (req, res) => {
    try {
      const xlsx = require('xlsx');
      const Employee = require('../models/Employee');
      if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

      const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      if (!rows.length) return res.status(400).json({ message: 'Excel file is empty.' });

      const parseDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) return val;
        const s = String(val).trim();
        const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
      };
      const LEAVE_TYPE_MAP = { sick: 'sick', casual: 'casual', short: 'short', earned: 'earned', maternity: 'maternity', paternity: 'paternity', unpaid: 'unpaid', holidays: 'holidays', 'initial allocation': 'Initial Allocation' };
      const STATUS_MAP = { pending: 'pending', approved: 'approved', rejected: 'rejected', left: 'left' };
      const CATEGORY_MAP = { full: 'Full', prob: 'Prob', probation: 'Prob', intern: 'Intern' };

      const allEmployees = await Employee.find({}, 'firstName lastName _id').lean();
      const empMap = {};
      allEmployees.forEach(e => { empMap[`${e.firstName} ${e.lastName}`.toLowerCase()] = e; });

      const results = { inserted: 0, skipped: 0, errors: [] };
      const docs = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        const empName = String(row['Employee Name'] || '').trim();
        if (!empName) { results.skipped++; results.errors.push({ row: rowNum, message: 'Employee Name empty' }); continue; }
        const emp = empMap[empName.toLowerCase()];
        if (!emp) { results.skipped++; results.errors.push({ row: rowNum, message: `"${empName}" not found` }); continue; }
        const startDate = parseDate(row['Leave Start Date']);
        if (!startDate) { results.skipped++; results.errors.push({ row: rowNum, message: 'Invalid Start Date' }); continue; }
        const endDate = parseDate(row['Leave End Date']) || startDate;
        const totalDays = parseInt(row['Total Days']) || Math.ceil((endDate - startDate) / 86400000) + 1;
        docs.push({
          employee: emp._id,
          leaveType: LEAVE_TYPE_MAP[String(row['Leave Type'] || 'casual').toLowerCase()] || 'casual',
          startDate, endDate, numberOfDays: totalDays,
          reason: String(row['Remarks'] || ''),
          status: STATUS_MAP[String(row['Leave Status'] || 'pending').toLowerCase()] || 'pending',
          category: CATEGORY_MAP[String(row['Intern/Probation'] || 'Full').toLowerCase()] || 'Full',
          medicalDocumentSubmitted: String(row['Medical Document Submitted'] || '').toLowerCase().trim() === 'yes',  // ← ADD THIS LINE
          createdAt: parseDate(row['Applied On']) || new Date(),
          updatedAt: new Date(),
        });
        results.inserted++;
      }

      if (docs.length) await Leave.insertMany(docs, { ordered: false });
      return res.json({ message: `Inserted: ${results.inserted}, Skipped: ${results.skipped}.`, ...results });
    } catch (error) {
      console.error('bulkUploadLeaves error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  getAllLeavesHR = async (req, res) => {
    try {
      const { leaveType, status, category, startDate, endDate, page = 1, limit = 200 } = req.query;
      const query = { status: { $ne: 'left' } };
      if (leaveType) query.leaveType = leaveType;
      if (status && status !== 'all') query.status = status;
      if (category) query.category = category;
      if (startDate || endDate) {
        query.startDate = {};
        if (startDate) query.startDate.$gte = new Date(startDate);
        if (endDate) query.startDate.$lte = new Date(endDate);
      }
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await Leave.countDocuments(query);
      const leaves = await Leave.find(query)
        .populate({ path: 'employee', select: 'firstName lastName email department designation employeeId periodType status' })
        .populate({ path: 'approvedBy', select: 'firstName lastName' })
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean();
      return res.json({ leaves, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
      console.error('getAllLeavesHR error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ── paste ends here ────────────────────────────────────────────────────────
}


/**
 * ─────────────────────────────────────────────────────────────────
 *  LEAVE CONTROLLER ADDITIONS
 *  Add these three methods inside the LeaveController class in
 *  your existing leaveController.js file (before the closing brace).
 *  Also add:  const xlsx = require('xlsx');   at the top of the file.
 * ─────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────
// ADD THIS AT TOP OF leaveController.js (with other requires):
// const xlsx    = require('xlsx');
// const Employee= require('../models/Employee');
// const multer  = require('multer');
// ─────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────────────
// DOWNLOAD LEAVE TEMPLATE  (GET /leave/bulk/template)
// Returns a preformatted .xlsx file the user fills and uploads.
// ───────────────────────────────────────────────────────────────────────────
downloadLeaveTemplate = async (req, res) => {
  try {
    const xlsx = require('xlsx');

    const headers = [
      'Employee Name',       // e.g. "John Doe"  — must match firstName+lastName in DB
      'Department',          // e.g. "Engineering"
      'Designation',         // e.g. "Developer"
      'Intern/Probation',    // Full | Prob | Intern
      'Leave Type',          // sick | casual | earned | maternity | paternity | unpaid | short | holidays
      'Leave Start Date',    // DD/MM/YYYY
      'Leave End Date',      // DD/MM/YYYY
      'Total Days',          // number
      'Leave Status',        // pending | approved | rejected
      'Medical Document Submitted', // Yes | No
      'Applied On',          // DD/MM/YYYY
      'Remarks',             // free text
    ];

    // Sample row so user understands the format
    const sample = [
      'Jane Smith',
      'Marketing',
      'Manager',
      'Full',
      'sick',
      '01/06/2025',
      '02/06/2025',
      '2',
      'approved',
      'Yes',
      '31/05/2025',
      'Fever and cold',
    ];

    const ws = xlsx.utils.aoa_to_sheet([headers, sample]);
    const wb = xlsx.utils.book_new();

    // Column widths
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

    // Style header row (SheetJS CE only supports basic styles via write options)
    xlsx.utils.book_append_sheet(wb, ws, 'Leave Data');

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="leave_upload_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  } catch (error) {
    console.error('downloadLeaveTemplate error:', error);
    return res.status(500).json({ message: error.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// BULK UPLOAD LEAVES  (POST /leave/bulk/upload)
// Accepts multipart/form-data with field "leaveFile" (.xlsx).
// Parses rows, matches employees by name, and inserts Leave documents.
// ───────────────────────────────────────────────────────────────────────────
bulkUploadLeaves = async (req, res) => {
  try {
    const xlsx = require('xlsx');
    const Employee = require('../models/Employee');

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Please attach an .xlsx file.' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty or unreadable.' });
    }

    // ── Helper: parse DD/MM/YYYY or any date cell → JS Date ─────────────────
    const parseDate = (val) => {
      if (!val) return null;
      if (val instanceof Date) return val;
      const s = String(val).trim();
      // DD/MM/YYYY
      const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
      // YYYY-MM-DD or ISO
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };

    // ── Normalise leave type to enum values in Leave model ───────────────────
    const LEAVE_TYPE_MAP = {
      sick: 'sick', casual: 'casual', short: 'short', earned: 'earned',
      maternity: 'maternity', paternity: 'paternity', unpaid: 'unpaid',
      holidays: 'holidays', 'initial allocation': 'Initial Allocation',
    };
    const normaliseLeaveType = (v) => LEAVE_TYPE_MAP[String(v).toLowerCase().trim()] || 'casual';

    const STATUS_MAP = { pending: 'pending', approved: 'approved', rejected: 'rejected', left: 'left' };
    const normaliseStatus = (v) => STATUS_MAP[String(v).toLowerCase().trim()] || 'pending';

    const CATEGORY_MAP = { full: 'Full', prob: 'Prob', probation: 'Prob', intern: 'Intern' };
    const normaliseCategory = (v) => CATEGORY_MAP[String(v).toLowerCase().trim()] || 'Full';

    const results = { inserted: 0, skipped: 0, errors: [] };
    const leaveDocs = [];

    // ── Cache all employees for name matching (avoid N+1 queries) ────────────
    const allEmployees = await Employee.find({}, 'firstName lastName _id department designation').lean();
    const empMap = {};
    allEmployees.forEach(e => {
      const key = `${e.firstName} ${e.lastName}`.toLowerCase().trim();
      empMap[key] = e;
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed, row 1 = header

      try {
        const empName = String(row['Employee Name'] || '').trim();
        if (!empName) {
          results.skipped++;
          results.errors.push({ row: rowNum, message: 'Employee Name is empty — skipped.' });
          continue;
        }

        const emp = empMap[empName.toLowerCase()];
        if (!emp) {
          results.skipped++;
          results.errors.push({ row: rowNum, message: `Employee "${empName}" not found in database — skipped.` });
          continue;
        }

        const startDate = parseDate(row['Leave Start Date']);
        const endDate = parseDate(row['Leave End Date']);

        if (!startDate) {
          results.skipped++;
          results.errors.push({ row: rowNum, message: `Invalid or missing "Leave Start Date" for "${empName}" — skipped.` });
          continue;
        }

        const leaveType = normaliseLeaveType(row['Leave Type'] || 'casual');
        const status = normaliseStatus(row['Leave Status'] || 'pending');
        const category = normaliseCategory(row['Intern/Probation'] || 'Full');
        const totalDays = parseInt(row['Total Days']) || (startDate && endDate
          ? Math.ceil((endDate - startDate) / 86400000) + 1
          : 1);
        const remarks = String(row['Remarks'] || '').trim();
        const appliedOn = parseDate(row['Applied On']) || new Date();

        leaveDocs.push({
          employee: emp._id,
          leaveType,
          startDate,
          endDate: endDate || startDate,
          numberOfDays: totalDays,
          reason: remarks,
          status,
          category,
          createdAt: appliedOn,
          updatedAt: new Date(),
        });

        results.inserted++;
      } catch (rowErr) {
        results.errors.push({ row: rowNum, message: rowErr.message });
        results.skipped++;
      }
    }

    if (leaveDocs.length > 0) {
      await Leave.insertMany(leaveDocs, { ordered: false });
    }

    return res.status(200).json({
      message: `Bulk upload complete. Inserted: ${results.inserted}, Skipped: ${results.skipped}.`,
      inserted: results.inserted,
      skipped: results.skipped,
      errors: results.errors,
    });
  } catch (error) {
    console.error('bulkUploadLeaves error:', error);
    return res.status(500).json({ message: error.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// GET ALL LEAVES FOR HR  (GET /leave/hr/all)
// Full leave list with optional filters: employeeName, department,
// leaveType, status, startDate, endDate, category.
// Used by the "View Leave Data" modal on HR dashboard.
// ───────────────────────────────────────────────────────────────────────────
getAllLeavesHR = async (req, res) => {
  try {
    const { leaveType, status, startDate, endDate, category, page = 1, limit = 200 } = req.query;

    const query = { status: { $ne: 'left' } };
    if (leaveType) query.leaveType = leaveType;
    if (status && status !== 'all') query.status = status;
    if (category) query.category = category;

    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Leave.countDocuments(query);

    const leaves = await Leave.find(query)
      .populate({ path: 'employee', select: 'firstName lastName email department designation employeeId periodType status' })
      .populate({ path: 'approvedBy', select: 'firstName lastName' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return res.json({ leaves, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('getAllLeavesHR error:', error);
    return res.status(500).json({ message: error.message });
  }
};

module.exports = new LeaveController();