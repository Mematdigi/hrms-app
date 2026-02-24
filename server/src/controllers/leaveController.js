const Leave        = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveDefaults= require('../models/LeaveDefaults');
const User         = require('../models/User');
const Payroll      = require('../models/Payroll');
const nodemailer   = require('nodemailer');

// ─── Email Transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER     || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  }
});

const sendMail = (options) => {
  transporter.sendMail(options, (err, info) => {
    if (err) console.error('Email error:', err.message);
    else     console.log('Email sent:', info.response);
  });
};

// ─── Helper: get or create LeaveBalance for employee+year ────────────────────
const getOrCreateLeaveBalance = async (employeeId, year) => {
  const defaults = await LeaveDefaults.findOne();
  let balance = await LeaveBalance.findOne({ employee: employeeId, year });

  if (!balance) {
    balance = await LeaveBalance.create({
      employee:       employeeId,
      year,
      casualTotal:    defaults?.casualDefault   ?? 8,
      sickTotal:      defaults?.sickDefault     ?? 6,
      earnedTotal:    defaults?.earnedDefault   ?? 14,
      maternityTotal: defaults?.maternityDefault?? 90,
      paternityTotal: defaults?.paternityDefault?? 15,
      shortLeaveTotal:defaults?.shortLeaveTotal ?? 3,
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
  const yearStart = new Date(year,  0,  1, 0,  0,  0);
  const yearEnd   = new Date(year, 11, 31, 23, 59, 59);

  // Aggregate approved leaves for this year
  const agg = await Leave.aggregate([
    {
      $match: {
        employee:  require('mongoose').Types.ObjectId.createFromHexString
          ? require('mongoose').Types.ObjectId.createFromHexString(String(employeeId))
          : new (require('mongoose').Types.ObjectId)(String(employeeId)),
        status:    'approved',
        startDate: { $gte: yearStart, $lte: yearEnd }
      }
    },
    {
      $group: {
        _id:      '$leaveType',
        totalDays:{ $sum: '$numberOfDays' },
        count:    { $sum: 1 }
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
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  return await Leave.countDocuments({
    employee:  employeeId,
    leaveType: 'short',
    status:    { $in: ['pending', 'approved'] },
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
      const end   = endDate ? new Date(endDate) : new Date(startDate);

      // Clamp: end cannot be before start
      if (end < start) {
        return res.status(400).json({ message: 'End date cannot be before start date.' });
      }

      // numberOfDays: for Short leave always 0 (hour-based), for Full Day ≥ 1
      const isShort      = leaveType === 'Short';
      const numberOfDays = isShort
        ? 0
        : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      const year = start.getFullYear();

      // ── BALANCE CHECK ──────────────────────────────────────────────────────
      if (isShort) {
        // Short leave: check monthly limit
        const shortUsed  = await computeShortLeavesThisMonth(employeeId);
        const balance    = await getOrCreateLeaveBalance(employeeId, year);
        if (shortUsed >= balance.shortLeaveLimit) {
          return res.status(400).json({
            message: `Short leave limit reached (${balance.shortLeaveLimit}/month). Please apply for a Full Day leave.`
          });
        }
      } else {
        // Full day: check yearly balance per leave type
        const balance = await getOrCreateLeaveBalance(employeeId, year);
        const used    = await computeUsedLeaves(employeeId, year);

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
        employee:     employeeId,
        leaveType,
        startDate:    start,
        endDate:      end,
        numberOfDays,
        reason:       reason || '',
        status:       'pending',
        category:     category || 'Full',
        fromTime:     fromTime || null,
        toTime:       toTime   || null,
      });

      await leave.save();
      await leave.populate('employee', 'firstName lastName email department');

      // ── NOTIFY HR ─────────────────────────────────────────────────────────
      const hrManagers = await User.find({ role: 'hr' }, 'email firstName lastName');
      if (hrManagers.length > 0) {
        const emp       = leave.employee;
        const emailList = hrManagers.map(h => h.email).filter(Boolean).join(', ');
        sendMail({
          from:    process.env.EMAIL_USER || 'your-email@gmail.com',
          to:      emailList,
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
        else        query.status = { $ne: 'left' };
      } else if (status) {
        query.status = status;
      }

      const leaves = await Leave.find(query)
        .populate({ path: 'employee',   select: 'firstName lastName email department designation dateOfJoining employeeId' })
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
        status:   { $ne: 'left' }
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

      if (!leave)                        return res.status(404).json({ message: 'Leave not found.' });
      if (leave.status === 'approved')   return res.status(400).json({ message: 'Leave is already approved.' });
      if (leave.status === 'rejected')   return res.status(400).json({ message: 'Cannot approve a rejected leave. Ask employee to re-apply.' });

      // ── Update status ──────────────────────────────────────────────────────
      // NOTE: No balance deduction here — balances are computed dynamically
      // by aggregating approved records in getEmployeeBalances.
      leave.status       = 'approved';
      leave.approvedBy   = approverId;
      leave.approvalDate = new Date();
      leave.updatedAt    = new Date();
      await leave.save();

      // ── Send approval email ────────────────────────────────────────────────
      const approver = await User.findById(approverId).select('firstName lastName');
      if (leave.employee?.email) {
        sendMail({
          from:    process.env.EMAIL_USER || 'your-email@gmail.com',
          to:      leave.employee.email,
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
          month:    new Date().getMonth() + 1,
          year:     new Date().getFullYear()
        });
        if (payroll && leave.numberOfDays > 0) {
          const perDay = payroll.baseSalary / (payroll.workingDays || 26);
          payroll.deductions = (payroll.deductions || 0) + (perDay * leave.numberOfDays);
          payroll.netSalary  = payroll.baseSalary - payroll.deductions;
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

      if (!leave)                       return res.status(404).json({ message: 'Leave not found.' });
      if (leave.status === 'rejected')  return res.status(400).json({ message: 'Leave is already rejected.' });

      // ── Update status ──────────────────────────────────────────────────────
      // NOTE: No balance restoration needed — balances are computed dynamically.
      // Rejected records simply won't be counted in the approved aggregation.
      leave.status          = 'rejected';
      leave.approvedBy      = approverId;
      leave.approvalDate    = new Date();
      leave.rejectionReason = rejectionReason || '';
      leave.updatedAt       = new Date();
      await leave.save();

      // ── Send rejection email ───────────────────────────────────────────────
      const approver = await User.findById(approverId).select('firstName lastName');
      if (leave.employee?.email) {
        sendMail({
          from:    process.env.EMAIL_USER || 'your-email@gmail.com',
          to:      leave.employee.email,
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
        Leave.countDocuments({ status: 'pending'  }),
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
          casualDefault:    8,
          sickDefault:      6,
          earnedDefault:    14,
          shortLeaveLimit:  3
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
      if (casualDefault   !== undefined) update.casualDefault   = casualDefault;
      if (sickDefault     !== undefined) update.sickDefault     = sickDefault;
      if (earnedDefault   !== undefined) update.earnedDefault   = earnedDefault;
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
      const shortLeavesUsed  = await computeShortLeavesThisMonth(employeeId);
      const shortLeavesLimit = balance.shortLeaveTotal;

      // 4. Compute REMAINING = total - used  (clamp to 0)
      const clamp = (val) => Math.max(val, 0);

      const casualRemaining    = clamp(balance.casualTotal    - used.casual);
      const sickRemaining      = clamp(balance.sickTotal      - used.sick);
      const earnedRemaining    = clamp(balance.earnedTotal     - used.earned);
      const maternityRemaining = clamp(balance.maternityTotal  - used.maternity);
      const paternityRemaining = clamp(balance.paternityTotal  - used.paternity);

      return res.json({
        year,
        employee: employeeId,

        // ── Casual Leave ────────────────────────────────────────────────────
        casualTotal:     balance.casualTotal,
        casualUsed:      used.casual,
        casualRemaining,

        // ── Sick Leave ──────────────────────────────────────────────────────
        sickTotal:       balance.sickTotal,
        sickUsed:        used.sick,         // ✅ This now correctly reflects approved sick leaves
        sickRemaining,

        // ── Earned / Annual Leave ───────────────────────────────────────────
        earnedTotal:     balance.earnedTotal,
        earnedUsed:      used.earned,        // ✅ Only earned-type leaves counted
        earnedRemaining,
        // Aliases for frontend compatibility
        annualTotal:     balance.earnedTotal,
        annualUsed:      used.earned,        // ✅ annualUsed = earned leave only, not casual/sick

        // ── Maternity Leave ─────────────────────────────────────────────────
        maternityTotal:     balance.maternityTotal,
        maternityUsed:      used.maternity,
        maternityRemaining,

        // ── Paternity Leave ─────────────────────────────────────────────────
        paternityTotal:     balance.paternityTotal,
        paternityUsed:      used.paternity,
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
      const balance    = await getOrCreateLeaveBalance(employeeId, targetYear);

      if (casualTotal    !== undefined) balance.casualTotal    = casualTotal;
      if (sickTotal      !== undefined) balance.sickTotal      = sickTotal;
      if (earnedTotal    !== undefined) balance.earnedTotal    = earnedTotal;
      if (maternityTotal !== undefined) balance.maternityTotal = maternityTotal;
      if (paternityTotal !== undefined) balance.paternityTotal = paternityTotal;
      if (shortLeaveLimit!== undefined) balance.shortLeaveLimit= shortLeaveLimit;
      balance.updatedAt = new Date();

      await balance.save();
      return res.json({ message: 'Leave allocation updated.', balance });
    } catch (error) {
      console.error('updateEmployeeBalances error:', error);
      return res.status(500).json({ message: error.message });
    }
  };
}

module.exports = new LeaveController();