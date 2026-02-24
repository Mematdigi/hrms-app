const Leave = require('../models/Leave');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const Payroll = require('../models/Payroll');
const LeaveDefaults = require('../models/LeaveDefaults');

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  }
});

class LeaveController {

  // ─────────────────────────────────────────────
  // APPLY LEAVE
  // ─────────────────────────────────────────────
  applyLeave = async (req, res) => {
    try {
      const { employeeId, leaveType, startDate, endDate, reason, category, fromTime, toTime } = req.body;

      const start = new Date(startDate);
      const end   = new Date(endDate);
      const numberOfDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      // ✅ FIX: Fetch the most recent Leave record to check remaining balance
      const lastLeaveRecord = await Leave.findOne({ employee: employeeId }).sort({ createdAt: -1 });

      if (lastLeaveRecord) {
        if (leaveType === 'casual' && lastLeaveRecord.casualLeave < numberOfDays) {
          return res.status(400).json({ message: 'Insufficient casual leave balance.' });
        }
        if (leaveType === 'sick' && lastLeaveRecord.sickLeave < numberOfDays) {
          return res.status(400).json({ message: 'Insufficient sick leave balance.' });
        }
      }

      // Create leave request
      const leave = new Leave({
        employee:     employeeId,
        leaveType,
        startDate:    start,
        endDate:      end,
        numberOfDays,
        reason,
        status:       'pending',
        category:     category || 'Full',
        fromTime:     fromTime || null,
        toTime:       toTime   || null,
      });

      await leave.save();
      await leave.populate('employee', 'firstName lastName email department');

      // Notify all HR managers
      const hrManagers = await User.find({ role: 'hr' });
      if (hrManagers.length > 0) {
        const emp       = leave.employee;
        const emailList = hrManagers.map(hr => hr.email).join(', ');
        const mailOptions = {
          from:    process.env.EMAIL_USER || 'your-email@gmail.com',
          to:      emailList,
          subject: `New Leave Request – ${emp.firstName} ${emp.lastName}`,
          html: `
            <h2>New Leave Request for Approval</h2>
            <p><strong>Employee:</strong> ${emp.firstName} ${emp.lastName}</p>
            <p><strong>Department:</strong> ${emp.department || 'N/A'}</p>
            <p><strong>Leave Type:</strong> ${leaveType}</p>
            <p><strong>Start Date:</strong> ${start.toLocaleDateString()}</p>
            <p><strong>End Date:</strong> ${end.toLocaleDateString()}</p>
            <p><strong>Number of Days:</strong> ${numberOfDays}</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p><strong>Status:</strong> <span style="color:orange;font-weight:bold;">PENDING APPROVAL</span></p>
            <p>Please log in to the HRMS to approve or reject this request.</p>
          `
        };
        transporter.sendMail(mailOptions, (err, info) => {
          if (err) console.log('Email notification error:', err);
          else     console.log('Email sent to HR:', info.response);
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

  // ─────────────────────────────────────────────
  // GET LEAVE REQUESTS
  // ─────────────────────────────────────────────
  getLeaveRequests = async (req, res) => {
    try {
      const { employeeId, status, role } = req.query;
      const query = {};

      if (role === 'employee' && employeeId) {
        query.employee = employeeId;
      } else if (role === 'hr' || role === 'manager' || role === 'admin') {
        if (status) {
          query.status = status;
        } else {
          query.status = { $ne: 'left' };
        }
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

      const allLeavesForEmployees = await Leave.find({ employee: { $in: employeeIds } })
        .sort({ createdAt: -1 })
        .lean();

      const historyMap = {};
      allLeavesForEmployees.forEach(lv => {
        const empId = lv.employee.toString();
        if (!historyMap[empId]) historyMap[empId] = [];
        historyMap[empId].push(lv);
      });

      const enrichedLeaves = leaves.map(l => {
        const empId = l.employee?._id?.toString();
        return { ...l, employeeLeaveHistory: empId ? historyMap[empId] || [] : [] };
      });

      return res.json(enrichedLeaves);
    } catch (error) {
      console.error('getLeaveRequests error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ─────────────────────────────────────────────
  // GET PENDING LEAVE REQUESTS
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // APPROVE LEAVE
  // ─────────────────────────────────────────────
  approveLeave = async (req, res) => {
    try {
      const { leaveId, approverId, leaveType, numberOfDays } = req.body;

      // ✅ FIX: Correct populate syntax
      const leave = await Leave.findById(leaveId).populate('employee', 'firstName lastName email employeeId');

      if (!leave) return res.status(404).json({ message: 'Leave not found' });
      if (leave.status === 'approved') return res.status(400).json({ message: 'Leave already approved' });

      // ✅ FIX: Deduct from the Leave balance fields on the Leave document
      if (leaveType === 'casual') {
        leave.casualLeave = (leave.casualLeave || 0) - (numberOfDays || leave.numberOfDays);
      } else if (leaveType === 'sick') {
        leave.sickLeave = (leave.sickLeave || 0) - (numberOfDays || leave.numberOfDays);
      }

      leave.status      = 'approved';
      leave.approvedBy  = approverId;
      leave.approvalDate = new Date();
      leave.numberOfDays = numberOfDays || leave.numberOfDays;
      leave.updatedAt   = new Date();

      await leave.save();

      // Send approval email
      if (leave.employee?.email) {
        const approver = await User.findById(approverId).select('firstName lastName');
        const mailOptions = {
          from:    process.env.EMAIL_USER || 'your-email@gmail.com',
          to:      leave.employee.email,
          subject: 'Leave Request Approved',
          html: `
            <h2>Your Leave Request Has Been Approved</h2>
            <p>Dear ${leave.employee.firstName} ${leave.employee.lastName},</p>
            <p>Your leave request has been approved${approver ? ' by ' + approver.firstName + ' ' + approver.lastName : ''}.</p>
            <ul>
              <li>Leave Type: ${leave.leaveType}</li>
              <li>Start Date: ${new Date(leave.startDate).toLocaleDateString()}</li>
              <li>End Date: ${new Date(leave.endDate).toLocaleDateString()}</li>
              <li>Number of Days: ${leave.numberOfDays}</li>
            </ul>
          `
        };
        transporter.sendMail(mailOptions, (err) => {
          if (err) console.log('Approval email error:', err);
        });
      }

      // Update payroll deduction
      const payroll = await Payroll.findOne({
        employee: leave.employee._id,
        month:    new Date().getMonth() + 1,
        year:     new Date().getFullYear()
      });
      if (payroll) {
        const perDayDeduction = payroll.baseSalary / (payroll.workingDays || 26);
        payroll.deductions += perDayDeduction * leave.numberOfDays;
        payroll.netSalary   = payroll.baseSalary - payroll.deductions;
        await payroll.save();
      }

      return res.json({ message: 'Leave approved successfully', leave });
    } catch (error) {
      console.error('approveLeave error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ─────────────────────────────────────────────
  // REJECT LEAVE
  // ─────────────────────────────────────────────
  rejectLeave = async (req, res) => {
    try {
      const { leaveId, leaveType, numberOfDays, rejectionReason, approverId } = req.body;

      // ✅ FIX: Correct populate syntax
      const leave = await Leave.findById(leaveId).populate('employee', 'firstName lastName email employeeId');

      if (!leave) return res.status(404).json({ message: 'Leave not found' });

      // Restore balance only if not already rejected
      if (leave.status !== 'rejected') {
        if (leaveType === 'casual') {
          leave.casualLeave = (leave.casualLeave || 0) + (numberOfDays || leave.numberOfDays);
        } else if (leaveType === 'sick') {
          leave.sickLeave = (leave.sickLeave || 0) + (numberOfDays || leave.numberOfDays);
        }
      }

      leave.status          = 'rejected';
      leave.approvedBy      = approverId;
      leave.approvalDate    = new Date();
      leave.rejectionReason = rejectionReason || '';
      leave.updatedAt       = new Date();

      await leave.save();

      // Send rejection email
      if (leave.employee?.email) {
        const approver = await User.findById(approverId).select('firstName lastName');
        const mailOptions = {
          from:    process.env.EMAIL_USER || 'your-email@gmail.com',
          to:      leave.employee.email,
          subject: 'Leave Request Rejected',
          html: `
            <h2>Your Leave Request Has Been Rejected</h2>
            <p>Dear ${leave.employee.firstName} ${leave.employee.lastName},</p>
            <p>Your leave request has been rejected${approver ? ' by ' + approver.firstName + ' ' + approver.lastName : ''}.</p>
            <p><strong>Reason:</strong> ${rejectionReason || 'No reason provided'}</p>
            <ul>
              <li>Leave Type: ${leave.leaveType}</li>
              <li>Start Date: ${new Date(leave.startDate).toLocaleDateString()}</li>
              <li>End Date: ${new Date(leave.endDate).toLocaleDateString()}</li>
              <li>Number of Days: ${leave.numberOfDays}</li>
            </ul>
            <p>Please contact HR for more information.</p>
          `
        };
        transporter.sendMail(mailOptions, (err) => {
          if (err) console.log('Rejection email error:', err);
        });
      }

      return res.json({ message: 'Leave rejected successfully', leave });
    } catch (error) {
      console.error('rejectLeave error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ─────────────────────────────────────────────
  // GET LEAVE STATS
  // ─────────────────────────────────────────────
  getLeaveStats = async (req, res) => {
    try {
      const stats = {
        pending:  await Leave.countDocuments({ status: 'pending' }),
        approved: await Leave.countDocuments({ status: 'approved' }),
        rejected: await Leave.countDocuments({ status: 'rejected' })
      };
      return res.json(stats);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // ─────────────────────────────────────────────
  // GET LEAVE DEFAULTS
  // ─────────────────────────────────────────────
  getDefaults = async (req, res) => {
    try {
      let defaults = await LeaveDefaults.findOne();
      // ✅ Auto-create defaults if none exist
      if (!defaults) {
        defaults = await LeaveDefaults.create({ casualDefault: 8, sickDefault: 6 });
      }
      return res.json(defaults);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // ─────────────────────────────────────────────
  // UPDATE LEAVE DEFAULTS (HR only)
  // ─────────────────────────────────────────────
  updateDefaults = async (req, res) => {
    try {
      const { casualDefault, sickDefault } = req.body;
      if (typeof casualDefault !== 'number' || typeof sickDefault !== 'number') {
        return res.status(400).json({ message: 'Casual and Sick leave must be numbers.' });
      }
      const updatedDefaults = await LeaveDefaults.findOneAndUpdate(
        {},
        { casualDefault, sickDefault },
        { new: true, upsert: true }
      );
      return res.json(updatedDefaults);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // ─────────────────────────────────────────────
  // ✅ NEW: GET EMPLOYEE LEAVE BALANCES
  // Returns casualLeave, sickLeave, shortLeavesUsed etc. for a specific employee
  // Route: GET /employees/:employeeId/balances  (add in employeeRoutes OR leaveRoutes)
  // ─────────────────────────────────────────────
  getEmployeeBalances = async (req, res) => {
    try {
      const { employeeId } = req.params;

      // Get the most recent leave record for this employee (which holds running balance)
      const lastRecord = await Leave.findOne({ employee: employeeId }).sort({ createdAt: -1 });

      // Count short leaves this month
      const now        = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const shortLeavesThisMonth = await Leave.countDocuments({
        employee:  employeeId,
        leaveType: 'casual',
        category:  'Short',
        status:    { $in: ['pending', 'approved'] },
        startDate: { $gte: monthStart, $lte: monthEnd }
      });

      // Count approved earned/annual leaves
      const earnedLeavesUsed = await Leave.countDocuments({
        employee:  employeeId,
        leaveType: 'earned',
        status:    'approved'
      });

      const defaults = await LeaveDefaults.findOne();

      return res.json({
        casualLeave:      lastRecord?.casualLeave  ?? (defaults?.casualDefault ?? 8),
        sickLeave:        lastRecord?.sickLeave    ?? (defaults?.sickDefault   ?? 6),
        casualUsed:       (defaults?.casualDefault ?? 8)  - (lastRecord?.casualLeave ?? defaults?.casualDefault ?? 8),
        sickUsed:         (defaults?.sickDefault   ?? 6)  - (lastRecord?.sickLeave   ?? defaults?.sickDefault   ?? 6),
        annualUsed:       earnedLeavesUsed,
        annualTotal:      14,
        shortLeavesUsed:  shortLeavesThisMonth,
        shortLeavesLimit: 3,
        earnedUsed:       earnedLeavesUsed,
        earnedTotal:      14,
      });
    } catch (error) {
      console.error('getEmployeeBalances error:', error);
      return res.status(500).json({ message: error.message });
    }
  };
}

module.exports = new LeaveController();