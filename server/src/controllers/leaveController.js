const Leave         = require('../models/Leave');
const LeaveBalance  = require('../models/LeaveBalance');
const LeaveDefaults = require('../models/LeaveDefaults');
const User          = require('../models/User');
const Payroll       = require('../models/Payroll');
const Employee      = require('../models/Employee');
const nodemailer    = require('nodemailer');
const xlsx          = require('xlsx');
const { createNotification, notifyAllHR } = require('./Notificationcontroller');
const { decryptEmployee } = require('../utils/encryption');

// ─── Helper: safely decrypt a populated employee sub-doc ─────────────────────
const safeDecryptEmployee = (emp) => {
  if (!emp) return emp;
  try {
    return decryptEmployee(emp);
  } catch (e) {
    console.warn('safeDecryptEmployee failed for _id=' + emp._id + ':', e.message);
    return emp;
  }
};

// ─── Helper: bulk-fetch department + designation from Employee table ───────────
// Returns a Map: employeeId (string) → { department, designation }
// department and designation are plain-text (not encrypted) in the Employee
// model, so we read them directly without any decryption step.
const fetchEmpDeptDesig = async (employeeIds) => {
  if (!employeeIds || employeeIds.length === 0) return new Map();

  const records = await Employee.find(
    { _id: { $in: employeeIds } },
    'department designation'
  ).lean();

  const map = new Map();
  records.forEach(r => {
    map.set(r._id.toString(), {
      department:  r.department  || '',
      designation: r.designation || '',
    });
  });
  return map;
};

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
      employee:        employeeId,
      year,
      casualTotal:     defaults?.casualDefault    ?? 8,
      sickTotal:       defaults?.sickDefault      ?? 6,
      earnedTotal:     defaults?.earnedDefault    ?? 14,
      maternityTotal:  defaults?.maternityDefault ?? 90,
      paternityTotal:  defaults?.paternityDefault ?? 15,
      shortLeaveTotal: defaults?.shortLeaveDefault ?? 3,
      halfDayTotal:    defaults?.halfDayDefault   ?? 12,
    });
  }
  return balance;
};

// ─── Helper: compute used days per leave type for an employee ─────────────────
const computeUsedLeaves = async (employeeId, year) => {
  const yearStart = new Date(year,  0,  1,  0,  0,  0);
  const yearEnd   = new Date(year, 11, 31, 23, 59, 59);

  const agg = await Leave.aggregate([
    {
      $match: {
        employee: require('mongoose').Types.ObjectId.createFromHexString
          ? require('mongoose').Types.ObjectId.createFromHexString(String(employeeId))
          : new (require('mongoose').Types.ObjectId)(String(employeeId)),
        status:    'approved',
        startDate: { $gte: yearStart, $lte: yearEnd }
      }
    },
    {
      $group: {
        _id:       '$leaveType',
        totalDays: { $sum: '$numberOfDays' },
        count:     { $sum: 1 }
      }
    }
  ]);

  const usedMap = {
    casual: 0, sick: 0, earned: 0, maternity: 0,
    paternity: 0, unpaid: 0, short: 0, half: 0
  };
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
      const {
        employeeId, leaveType, startDate, endDate,
        reason, category, fromTime, toTime, halfDayPeriod
      } = req.body;

      if (!employeeId || !leaveType || !startDate) {
        return res.status(400).json({ message: 'employeeId, leaveType and startDate are required.' });
      }

      const start = new Date(startDate);
      const end   = endDate ? new Date(endDate) : new Date(startDate);

      if (end < start) {
        return res.status(400).json({ message: 'End date cannot be before start date.' });
      }

      const isShort   = leaveType === 'short';
      const isHalfDay = leaveType === 'half';

      // Half day always occupies the same single date (start === end)
      if (isHalfDay && startDate !== (endDate || startDate)) {
        const s = new Date(startDate).toDateString();
        const e = new Date(endDate || startDate).toDateString();
        if (s !== e) {
          return res.status(400).json({ message: 'Half day leave must be on a single date.' });
        }
      }

      // Validate halfDayPeriod
      if (isHalfDay && halfDayPeriod && !['first', 'second'].includes(halfDayPeriod)) {
        return res.status(400).json({ message: 'halfDayPeriod must be "first" or "second".' });
      }

      // numberOfDays: 0 for short, 0.5 for half day, whole numbers for full-day leaves
      const numberOfDays = isShort
        ? 0
        : isHalfDay
          ? 0.5
          : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      const year = start.getFullYear();

      // ── BALANCE CHECK ──────────────────────────────────────────────────────
      if (isShort) {
        const shortUsed = await computeShortLeavesThisMonth(employeeId);
        const balance   = await getOrCreateLeaveBalance(employeeId, year);
        if (shortUsed >= balance.shortLeaveTotal) {
          return res.status(400).json({
            message: `Short leave limit reached (${balance.shortLeaveTotal}/month). Please apply for a Full Day leave.`
          });
        }
      } else if (isHalfDay) {
        const balance = await getOrCreateLeaveBalance(employeeId, year);
        const used    = await computeUsedLeaves(employeeId, year);
        // used.half stores cumulative numberOfDays (each half day = 0.5)
        const halfDayUsedCount = used.half / 0.5;         // number of half-day instances used
        const halfDayLimit     = balance.halfDayTotal;     // number of half-day instances allowed
        if (halfDayUsedCount >= halfDayLimit) {
          return res.status(400).json({
            message: `Half day leave limit reached (${halfDayLimit} per year). You have used all your half day allowance.`
          });
        }
      } else {
        const balance = await getOrCreateLeaveBalance(employeeId, year);
        const used    = await computeUsedLeaves(employeeId, year);

        if (leaveType === 'casual') {
          const remaining = balance.casualTotal - used.casual;
          if (numberOfDays > remaining)
            return res.status(400).json({ message: `Insufficient casual leave. Remaining: ${remaining} day(s), Requested: ${numberOfDays}.` });
        }
        if (leaveType === 'sick') {
          const remaining = balance.sickTotal - used.sick;
          if (numberOfDays > remaining)
            return res.status(400).json({ message: `Insufficient sick leave. Remaining: ${remaining} day(s), Requested: ${numberOfDays}.` });
        }
        if (leaveType === 'earned') {
          const remaining = balance.earnedTotal - used.earned;
          if (numberOfDays > remaining)
            return res.status(400).json({ message: `Insufficient earned leave. Remaining: ${remaining} day(s), Requested: ${numberOfDays}.` });
        }
        if (leaveType === 'maternity') {
          const remaining = balance.maternityTotal - used.maternity;
          if (numberOfDays > remaining)
            return res.status(400).json({ message: `Insufficient maternity leave. Remaining: ${remaining} day(s), Requested: ${numberOfDays}.` });
        }
        if (leaveType === 'paternity') {
          const remaining = balance.paternityTotal - used.paternity;
          if (numberOfDays > remaining)
            return res.status(400).json({ message: `Insufficient paternity leave. Remaining: ${remaining} day(s), Requested: ${numberOfDays}.` });
        }
      }

      // ── CREATE LEAVE REQUEST ───────────────────────────────────────────────
      const leave = new Leave({
        employee:      employeeId,
        leaveType,
        startDate:     start,
        endDate:       end,
        numberOfDays,
        reason:        reason || '',
        status:        'pending',
        category:      category || 'Full',
        fromTime:      fromTime      || null,
        toTime:        toTime        || null,
        halfDayPeriod: isHalfDay ? (halfDayPeriod || null) : null,
      });

      await leave.save();
      await leave.populate('employee', 'firstName lastName email department');

      // ── NOTIFY HR (in-app) ────────────────────────────────────────────────
      const empName    = `${leave.employee.firstName} ${leave.employee.lastName}`;
      const dayLabel   = isHalfDay
        ? '0.5 day (Half Day)'
        : `${numberOfDays} day${numberOfDays !== 1 ? 's' : ''}`;

      await notifyAllHR({
        sender:   leave.employee._id,
        type:     'leave_applied',
        title:    'New Leave Request',
        message:  `${empName} has applied for ${leaveType} leave (${dayLabel}).`,
        refId:    leave._id,
        refModel: 'Leave',
        meta:     { leaveType, numberOfDays, startDate, endDate },
      });

      // ── NOTIFY HR (email) ─────────────────────────────────────────────────
      const hrManagers = await User.find({ role: 'hr' }, 'email firstName lastName');
      if (hrManagers.length > 0) {
        const emp       = leave.employee;
        const emailList = hrManagers.map(h => h.email).filter(Boolean).join(', ');
        const halfDayPeriodLabel = isHalfDay && halfDayPeriod
          ? ` (${halfDayPeriod === 'first' ? 'First Half / Morning' : 'Second Half / Afternoon'})`
          : '';
        sendMail({
          from:    process.env.EMAIL_USER || 'your-email@gmail.com',
          to:      emailList,
          subject: `New Leave Request – ${emp.firstName} ${emp.lastName}`,
          html: `
            <h2>New Leave Request for Approval</h2>
            <p><strong>Employee:</strong> ${emp.firstName} ${emp.lastName}</p>
            <p><strong>Department:</strong> ${emp.department || 'N/A'}</p>
            <p><strong>Leave Type:</strong> ${leaveType}${halfDayPeriodLabel}</p>
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
  // ── department & designation fetched directly from Employee table so they
  //    are always accurate regardless of encryption / populate issues.
  // ───────────────────────────────────────────────────────────────────────────
  getLeaveRequests = async (req, res) => {
    try {
      const { employeeId, status, role } = req.query;
      const query = {};

      if (role === 'employee' && employeeId) {
        query.employee = employeeId;
        query.status   = { $ne: 'left' };
      } else if (role === 'hr' || role === 'manager' || role === 'admin') {
        if (status) query.status = status;
        else        query.status = { $ne: 'left' };
      } else if (status) {
        query.status = status;
      }

      const leaves = await Leave.find(query)
        .populate({ path: 'employee',   select: 'firstName lastName email department designation dateOfJoining employeeId contact' })
        .populate({ path: 'approvedBy', select: 'firstName lastName' })
        .sort({ createdAt: -1 })
        .lean();

      if (!leaves || leaves.length === 0) return res.json([]);

      // ── Collect unique employee IDs ────────────────────────────────────────
      const employeeIds = [...new Set(
        leaves.map(l => l.employee?._id?.toString()).filter(Boolean)
      )];

      // ── Fetch department + designation directly from Employee table ─────────
      const deptDesigMap = await fetchEmpDeptDesig(employeeIds);

      // ── Leave history map ──────────────────────────────────────────────────
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

      // ── Decrypt + inject department/designation + attach history ───────────
      const enriched = leaves.map(l => {
        const id          = l.employee?._id?.toString();
        const empDecrypted = safeDecryptEmployee(l.employee);
        const deptDesig   = id ? (deptDesigMap.get(id) || {}) : {};

        return {
          ...l,
          employee: {
            ...empDecrypted,
            department:  deptDesig.department  || empDecrypted?.department  || '',
            designation: deptDesig.designation || empDecrypted?.designation || '',
          },
          employeeLeaveHistory: id ? historyMap[id] || [] : [],
        };
      });

      return res.json(enriched);
    } catch (error) {
      console.error('getLeaveRequests error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // GET PENDING LEAVE REQUESTS
  // ── department & designation fetched directly from Employee table
  // ───────────────────────────────────────────────────────────────────────────
  getPendingLeaveRequests = async (req, res) => {
    try {
      const leaves = await Leave.find({ status: 'pending' })
        .populate('employee', 'firstName lastName email department designation contact')
        .sort({ createdAt: -1 })
        .lean();

      // ── Fetch department + designation directly from Employee table ─────────
      const employeeIds  = [...new Set(leaves.map(l => l.employee?._id?.toString()).filter(Boolean))];
      const deptDesigMap = await fetchEmpDeptDesig(employeeIds);

      const result = leaves.map(l => {
        const id          = l.employee?._id?.toString();
        const empDecrypted = safeDecryptEmployee(l.employee);
        const deptDesig   = id ? (deptDesigMap.get(id) || {}) : {};

        return {
          ...l,
          employee: {
            ...empDecrypted,
            department:  deptDesig.department  || empDecrypted?.department  || '',
            designation: deptDesig.designation || empDecrypted?.designation || '',
          },
        };
      });

      return res.json(result);
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

      if (!leave)                      return res.status(404).json({ message: 'Leave not found.' });
      if (leave.status === 'approved') return res.status(400).json({ message: 'Leave is already approved.' });
      if (leave.status === 'rejected') return res.status(400).json({ message: 'Cannot approve a rejected leave. Ask employee to re-apply.' });

      leave.status       = 'approved';
      leave.approvedBy   = approverId;
      leave.approvalDate = new Date();
      leave.updatedAt    = new Date();
      await leave.save();

      const daysLabel = leave.leaveType === 'half'
        ? '0.5 day (Half Day)'
        : `${leave.numberOfDays} day${leave.numberOfDays !== 1 ? 's' : ''}`;

      await createNotification({
        recipient: leave.employee._id,
        sender:    approverId,
        type:      'leave_approved',
        title:     'Leave Request Approved ✅',
        message:   `Your ${leave.leaveType} leave request (${daysLabel}) has been approved.`,
        refId:     leave._id,
        refModel:  'Leave',
        meta:      { leaveType: leave.leaveType, numberOfDays: leave.numberOfDays },
      });

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

      try {
        const payroll = await Payroll.findOne({
          employee: leave.employee._id,
          month:    new Date().getMonth() + 1,
          year:     new Date().getFullYear()
        });
        // Half day deducts 0.5 day from payroll (numberOfDays is already 0.5)
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

      if (!leave)                      return res.status(404).json({ message: 'Leave not found.' });
      if (leave.status === 'rejected') return res.status(400).json({ message: 'Leave is already rejected.' });

      leave.status          = 'rejected';
      leave.approvedBy      = approverId;
      leave.approvalDate    = new Date();
      leave.rejectionReason = rejectionReason || '';
      leave.updatedAt       = new Date();
      await leave.save();

      await createNotification({
        recipient: leave.employee._id,
        sender:    approverId,
        type:      'leave_rejected',
        title:     'Leave Request Rejected ❌',
        message:   `Your ${leave.leaveType} leave request has been rejected. Reason: ${rejectionReason || 'No reason provided'}.`,
        refId:     leave._id,
        refModel:  'Leave',
        meta:      { leaveType: leave.leaveType, rejectionReason },
      });

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
  // REVOKE LEAVE (Employee self-service — cancel own pending/approved request)
  // Route: PUT /leave/revoke
  // Body: { leaveId, employeeId, revokeReason }
  // ───────────────────────────────────────────────────────────────────────────
  revokeLeave = async (req, res) => {
    try {
      const { leaveId, employeeId, revokeReason } = req.body;

      if (!leaveId || !employeeId) {
        return res.status(400).json({ message: 'leaveId and employeeId are required.' });
      }

      const leave = await Leave.findById(leaveId)
        .populate('employee', 'firstName lastName email employeeId _id');

      if (!leave) return res.status(404).json({ message: 'Leave not found.' });

      // ── Ownership check: only the employee who applied can revoke it ────────
      if (leave.employee._id.toString() !== String(employeeId)) {
        return res.status(403).json({ message: 'You can only revoke your own leave requests.' });
      }

      if (leave.status === 'rejected') {
        return res.status(400).json({ message: 'A rejected leave cannot be revoked.' });
      }
      if (leave.status === 'revoked') {
        return res.status(400).json({ message: 'This leave has already been revoked.' });
      }
      if (leave.status === 'left') {
        return res.status(400).json({ message: 'This leave record cannot be revoked.' });
      }

      // Prevent revoking a leave whose period has already fully passed
      const today  = new Date();
      today.setHours(0, 0, 0, 0);
      const endDay = new Date(leave.endDate);
      endDay.setHours(23, 59, 59, 999);
      if (endDay < today) {
        return res.status(400).json({ message: 'This leave period has already ended and cannot be revoked.' });
      }

      const wasApproved = leave.status === 'approved';

      leave.status       = 'revoked';
      leave.revokedAt    = new Date();
      leave.revokeReason = revokeReason || '';
      leave.updatedAt    = new Date();
      await leave.save();

      // ── If it was already approved, reverse the payroll deduction made at approval time ──
      if (wasApproved && leave.numberOfDays > 0) {
        try {
          const payroll = await Payroll.findOne({
            employee: leave.employee._id,
            month:    new Date().getMonth() + 1,
            year:     new Date().getFullYear()
          });
          if (payroll) {
            const perDay = payroll.baseSalary / (payroll.workingDays || 26);
            payroll.deductions = Math.max((payroll.deductions || 0) - (perDay * leave.numberOfDays), 0);
            payroll.netSalary  = payroll.baseSalary - payroll.deductions;
            await payroll.save();
          }
        } catch (payrollErr) {
          console.error('Payroll reversal failed (non-critical):', payrollErr.message);
        }
      }

      // ── Notify HR (in-app) ────────────────────────────────────────────────
      const empName = `${leave.employee.firstName || ''} ${leave.employee.lastName || ''}`.trim();
      await notifyAllHR({
        sender:   leave.employee._id,
        type:     'leave_revoked',
        title:    'Leave Request Revoked',
        message:  `${empName} has revoked their ${leave.leaveType} leave request${wasApproved ? ' (was already approved)' : ''}.`,
        refId:    leave._id,
        refModel: 'Leave',
        meta:     { leaveType: leave.leaveType, numberOfDays: leave.numberOfDays, revokeReason },
      });

      // ── Notify HR (email) ─────────────────────────────────────────────────
      const hrManagers = await User.find({ role: 'hr' }, 'email firstName lastName');
      if (hrManagers.length > 0) {
        const emailList = hrManagers.map(h => h.email).filter(Boolean).join(', ');
        sendMail({
          from:    process.env.EMAIL_USER || 'your-email@gmail.com',
          to:      emailList,
          subject: `Leave Request Revoked – ${empName}`,
          html: `
            <h2>Leave Request Revoked by Employee</h2>
            <p><strong>Employee:</strong> ${empName}</p>
            <p><strong>Leave Type:</strong> ${leave.leaveType}</p>
            <p><strong>Start Date:</strong> ${new Date(leave.startDate).toLocaleDateString()}</p>
            <p><strong>End Date:</strong> ${new Date(leave.endDate).toLocaleDateString()}</p>
            <p><strong>Days:</strong> ${leave.numberOfDays}</p>
            ${wasApproved ? '<p style="color:#B54708;font-weight:bold">Note: This leave was already approved — any payroll deduction has been reversed.</p>' : ''}
            <p><strong>Reason for Revoke:</strong> ${revokeReason || 'No reason provided'}</p>
            <p style="color:#6b7280;font-weight:bold">Status: REVOKED</p>
          `
        });
      }

      return res.json({ message: 'Leave revoked successfully.', leave });
    } catch (error) {
      console.error('revokeLeave error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // GET LEAVE STATS
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
  // GET LEAVE DEFAULTS
  // ───────────────────────────────────────────────────────────────────────────
  getDefaults = async (req, res) => {
    try {
      let defaults = await LeaveDefaults.findOne();
      if (!defaults) {
        defaults = await LeaveDefaults.create({
          casualDefault:    8,
          sickDefault:      6,
          earnedDefault:    14,
          shortLeaveDefault: 3,
          halfDayDefault:   12,
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
      const { casualDefault, sickDefault, earnedDefault, shortLeaveLimit, halfDayDefault } = req.body;

      if (casualDefault !== undefined && typeof casualDefault !== 'number')
        return res.status(400).json({ message: 'casualDefault must be a number.' });
      if (sickDefault !== undefined && typeof sickDefault !== 'number')
        return res.status(400).json({ message: 'sickDefault must be a number.' });

      const update = {};
      if (casualDefault   !== undefined) update.casualDefault   = casualDefault;
      if (sickDefault     !== undefined) update.sickDefault     = sickDefault;
      if (earnedDefault   !== undefined) update.earnedDefault   = earnedDefault;
      if (shortLeaveLimit !== undefined) update.shortLeaveDefault = shortLeaveLimit;
      if (halfDayDefault  !== undefined) update.halfDayDefault  = halfDayDefault;

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
  // GET EMPLOYEE LEAVE BALANCES
  // Route: GET /leave/balances/:employeeId
  // ───────────────────────────────────────────────────────────────────────────
  getEmployeeBalances = async (req, res) => {
    try {
      const { employeeId } = req.params;
      const year = new Date().getFullYear();

      if (!employeeId) return res.status(400).json({ message: 'employeeId is required.' });

      const balance = await getOrCreateLeaveBalance(employeeId, year);
      const used    = await computeUsedLeaves(employeeId, year);

      const shortLeavesUsed  = await computeShortLeavesThisMonth(employeeId);
      const shortLeavesLimit = balance.shortLeaveTotal;

      // Half day: used.half is cumulative numberOfDays (e.g. 3 uses = 1.5 days stored)
      // We expose both the "count" (instances) and "days" (0.5 × count)
      const halfDayUsedInstances  = used.half / 0.5;   // number of half-day leaves taken
      const halfDayLimit          = balance.halfDayTotal; // number of half-day leaves allowed
      const halfDayRemaining      = Math.max(halfDayLimit - halfDayUsedInstances, 0);

      const clamp = (val) => Math.max(val, 0);

      return res.json({
        year,
        employee: employeeId,

        casualTotal:     balance.casualTotal,
        casualUsed:      used.casual,
        casualRemaining: clamp(balance.casualTotal - used.casual),

        sickTotal:       balance.sickTotal,
        sickUsed:        used.sick,
        sickRemaining:   clamp(balance.sickTotal - used.sick),

        earnedTotal:     balance.earnedTotal,
        earnedUsed:      used.earned,
        earnedRemaining: clamp(balance.earnedTotal - used.earned),
        annualTotal:     balance.earnedTotal,
        annualUsed:      used.earned,

        maternityTotal:     balance.maternityTotal,
        maternityUsed:      used.maternity,
        maternityRemaining: clamp(balance.maternityTotal - used.maternity),

        paternityTotal:     balance.paternityTotal,
        paternityUsed:      used.paternity,
        paternityRemaining: clamp(balance.paternityTotal - used.paternity),

        shortLeavesUsed,
        shortLeavesLimit,
        shortLeavesRemaining: clamp(shortLeavesLimit - shortLeavesUsed),

        // Half day leave stats (unit = number of half-day instances, not days)
        halfDayTotal:     halfDayLimit,
        halfDayUsed:      halfDayUsedInstances,
        halfDayRemaining,
        halfDayDaysUsed:  used.half,  // in days (0.5 per instance), useful for payroll display

        totalUsedThisYear: used.casual + used.sick + used.earned + used.maternity + used.paternity + used.unpaid + used.half,
      });
    } catch (error) {
      console.error('getEmployeeBalances error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // UPDATE EMPLOYEE LEAVE ALLOCATION
  // Route: PUT /leave/balances/:employeeId
  // ───────────────────────────────────────────────────────────────────────────
  updateEmployeeBalances = async (req, res) => {
    try {
      const { employeeId } = req.params;
      const {
        casualTotal, sickTotal, earnedTotal,
        maternityTotal, paternityTotal, shortLeaveLimit,
        halfDayTotal, year
      } = req.body;

      const targetYear = year || new Date().getFullYear();
      const balance    = await getOrCreateLeaveBalance(employeeId, targetYear);

      if (casualTotal     !== undefined) balance.casualTotal     = casualTotal;
      if (sickTotal       !== undefined) balance.sickTotal       = sickTotal;
      if (earnedTotal     !== undefined) balance.earnedTotal     = earnedTotal;
      if (maternityTotal  !== undefined) balance.maternityTotal  = maternityTotal;
      if (paternityTotal  !== undefined) balance.paternityTotal  = paternityTotal;
      if (shortLeaveLimit !== undefined) balance.shortLeaveTotal = shortLeaveLimit;
      if (halfDayTotal    !== undefined) balance.halfDayTotal    = halfDayTotal;
      balance.updatedAt = new Date();

      await balance.save();
      return res.json({ message: 'Leave allocation updated.', balance });
    } catch (error) {
      console.error('updateEmployeeBalances error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // DOWNLOAD LEAVE TEMPLATE
  // Route: GET /leave/bulk/template
  // ───────────────────────────────────────────────────────────────────────────
  downloadLeaveTemplate = async (req, res) => {
    try {
      const headers = [
        'Employee Name',
        'Employee Phone',             // PRIMARY KEY — plain-text phone, matched against decrypted employee.contact
        'Department',
        'Designation',
        'Intern/Probation',           // Full | Prob | Intern
        'Leave Type',                 // sick | casual | earned | maternity | paternity | unpaid | short | half | holidays
        'Leave Start Date',           // DD/MM/YYYY
        'Leave End Date',             // DD/MM/YYYY
        'Total Days',
        'Leave Status',               // pending | approved | rejected
        'Medical Document Submitted', // Yes | No
        'Applied On',                 // DD/MM/YYYY
        'Remarks',
      ];

      const sample = [
        'Jane Smith', '9876543210', 'Marketing', 'Manager', 'Full',
        'sick', '01/06/2025', '02/06/2025', '2', 'approved', 'Yes', '31/05/2025', 'Fever and cold',
      ];

      const ws  = xlsx.utils.aoa_to_sheet([headers, sample]);
      const wb  = xlsx.utils.book_new();
      ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 20) }));
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
  // BULK UPLOAD LEAVES
  // Route: POST /leave/bulk/upload
  // PRIMARY KEY → Employee Phone (matched against DECRYPTED employee.contact)
  // ───────────────────────────────────────────────────────────────────────────
  bulkUploadLeaves = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded. Please attach an .xlsx file.' });
      }

      const workbook  = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet     = workbook.Sheets[sheetName];
      const rows      = xlsx.utils.sheet_to_json(sheet, { defval: '' });

      if (!rows || rows.length === 0) {
        return res.status(400).json({ message: 'Excel file is empty or unreadable.' });
      }

      const parseDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) return val;
        const s   = String(val).trim();
        const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
      };

      const LEAVE_TYPE_MAP = {
        sick: 'sick', casual: 'casual', short: 'short', half: 'half',
        'half day': 'half', halfday: 'half',
        earned: 'earned', maternity: 'maternity', paternity: 'paternity',
        unpaid: 'unpaid', holidays: 'holidays',
        'initial allocation': 'Initial Allocation',
      };
      const STATUS_MAP   = { pending: 'pending', approved: 'approved', rejected: 'rejected', left: 'left' };
      const CATEGORY_MAP = { full: 'Full', prob: 'Prob', probation: 'Prob', intern: 'Intern' };

      // ── Build phoneMap: fetch → decrypt → index by plain-text phone ────────
      const allEmployeesRaw = await Employee.find(
        {},
        'firstName lastName _id contact department designation'
      ).lean();

      const phoneMap = {};
      allEmployeesRaw.forEach(empRaw => {
        try {
          const empDecrypted = decryptEmployee(empRaw);
          const plainPhone   = String(empDecrypted.contact || '').trim();
          if (plainPhone) phoneMap[plainPhone] = empDecrypted;
        } catch (err) {
          console.warn(`Decrypt failed for employee _id=${empRaw._id}: ${err.message}`);
        }
      });

      const results   = { inserted: 0, skipped: 0, errors: [] };
      const leaveDocs = [];

      for (let i = 0; i < rows.length; i++) {
        const row    = rows[i];
        const rowNum = i + 2;

        try {
          const phone   = String(row['Employee Phone'] || '').trim();
          const empName = String(row['Employee Name']  || '').trim();

          const emp = phone ? phoneMap[phone] : null;
          if (!emp) {
            results.skipped++;
            results.errors.push({
              row:     rowNum,
              message: `No employee found for phone "${phone || 'N/A'}"${empName ? ` (Name: "${empName}")` : ''} — skipped.`
            });
            continue;
          }

          const startDate = parseDate(row['Leave Start Date']);
          if (!startDate) {
            results.skipped++;
            results.errors.push({ row: rowNum, message: `Invalid or missing "Leave Start Date" for phone "${phone}" — skipped.` });
            continue;
          }

          const endDate  = parseDate(row['Leave End Date']) || startDate;
          const leaveType = LEAVE_TYPE_MAP[String(row['Leave Type'] || 'casual').toLowerCase().trim()] || 'casual';

          // For half day: always 0.5 days regardless of what Excel says
          const isHalf    = leaveType === 'half';
          const totalDays = isHalf
            ? 0.5
            : parseInt(row['Total Days']) || Math.ceil((endDate - startDate) / 86400000) + 1;

          const status      = STATUS_MAP[String(row['Leave Status']             || 'pending').toLowerCase().trim()] || 'pending';
          const category    = CATEGORY_MAP[String(row['Intern/Probation']      || 'Full').toLowerCase().trim()] || 'Full';
          const remarks     = String(row['Remarks']                             || '').trim();
          const appliedOn   = parseDate(row['Applied On'])                      || new Date();
          const medDoc      = String(row['Medical Document Submitted']          || '').toLowerCase().trim() === 'yes';

          // Department & designation: Excel value → fallback to Employee table value
          const department  = String(row['Department']  || emp.department  || '').trim();
          const designation = String(row['Designation'] || emp.designation || '').trim();

          leaveDocs.push({
            employee:                 emp._id,
            employeePhone:            phone,
            leaveType,
            startDate,
            endDate,
            numberOfDays:             totalDays,
            reason:                   remarks,
            status,
            category,
            department,
            designation,
            medicalDocumentSubmitted: medDoc,
            createdAt:                appliedOn,
            updatedAt:                new Date(),
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
        message:  `Bulk upload complete. Inserted: ${results.inserted}, Skipped: ${results.skipped}.`,
        inserted: results.inserted,
        skipped:  results.skipped,
        errors:   results.errors,
      });
    } catch (error) {
      console.error('bulkUploadLeaves error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // GET ALL LEAVES FOR HR
  // Route: GET /leave/hr/all
  // ── department & designation fetched directly from Employee table so they
  //    are always accurate regardless of encryption / populate issues.
  // ───────────────────────────────────────────────────────────────────────────
  getAllLeavesHR = async (req, res) => {
    try {
      const {
        leaveType, status, category,
        startDate, endDate,
        page  = 1,
        limit = 200
      } = req.query;

      const query = { status: { $ne: 'left' } };
      if (leaveType)                  query.leaveType = leaveType;
      if (status && status !== 'all') query.status    = status;
      if (category)                   query.category  = category;

      if (startDate || endDate) {
        query.startDate = {};
        if (startDate) query.startDate.$gte = new Date(startDate);
        if (endDate)   query.startDate.$lte = new Date(endDate);
      }

      const skip  = (parseInt(page) - 1) * parseInt(limit);
      const total = await Leave.countDocuments(query);

      const leaves = await Leave.find(query)
        .populate({
          path:   'employee',
          select: 'firstName lastName email department designation employeeId periodType status contact'
        })
        .populate({ path: 'approvedBy', select: 'firstName lastName' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // ── Fetch department + designation directly from Employee table ─────────
      const employeeIds  = [...new Set(leaves.map(l => l.employee?._id?.toString()).filter(Boolean))];
      const deptDesigMap = await fetchEmpDeptDesig(employeeIds);

      // ── Decrypt contact + inject department/designation from Employee table ─
      const decryptedLeaves = leaves.map(l => {
        const id          = l.employee?._id?.toString();
        const empDecrypted = safeDecryptEmployee(l.employee);
        const deptDesig   = id ? (deptDesigMap.get(id) || {}) : {};

        return {
          ...l,
          employee: {
            ...empDecrypted,
            department:  deptDesig.department  || empDecrypted?.department  || '',
            designation: deptDesig.designation || empDecrypted?.designation || '',
          },
        };
      });

      return res.json({ leaves: decryptedLeaves, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
      console.error('getAllLeavesHR error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

}

module.exports = new LeaveController();