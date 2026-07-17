const Payroll = require('../models/Payroll');
const PayslipRequest = require('../models/PayslipReq');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Employee = require('../models/Employee');           // ← FIX: salary lives here
const Leave = require('../models/Leave');
const catchAsync = require('../utils/catchAsync');
const Holiday = require('../models/Holiday.modal');
const { createNotification, notifyAllHR } = require('./Notificationcontroller');
const { decryptEmployee } = require('../utils/encryption'); // ← FIX: needed to read salary


// ─── Helper: get all date strings between two dates (inclusive) ───────────────
function getDatesBetween(start, end) {
  const dates = [];
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d).toISOString().split('T')[0]);
  }
  return dates;
}

// ─── Helper: safely extract numeric baseSalary from a decrypted Employee doc ──
// Handles both old plain-number records and newly decrypted string values
function extractBaseSalary(decrypted) {
  const raw = decrypted.baseSalary;
  if (raw === null || raw === undefined || raw === '') return 0;
  const num = typeof raw === 'number' ? raw : parseFloat(raw);
  return isNaN(num) ? 0 : num;
}

class PayrollController {

  // ───────────────────────────────────────────────────────────────────────────
  // GENERATE payroll for a SINGLE employee
  // ───────────────────────────────────────────────────────────────────────────
  generatePayroll = catchAsync(async (req, res) => {
    const { employee, month, year } = req.body;

    if (!employee || !month || !year) {
      return res.status(400).json({ success: false, message: 'employee, month, and year are required' });
    }

    const result = await PayrollController._computeAndSave(employee, Number(month), Number(year));

    res.status(200).json({
      success: true,
      message: 'Payroll auto-generated from attendance & leave records',
      payroll: result.payroll,
      breakdown: result.breakdown
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GENERATE payroll for ALL active employees — one click
  // ───────────────────────────────────────────────────────────────────────────
  generateAllPayrolls = catchAsync(async (req, res) => {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }

    const users = await User.find({ isActive: true, role: { $ne: 'admin' } })
      .select('_id firstName lastName');

    const generated  = [];
    const failed     = [];
    const skipped    = [];

    for (const u of users) {
      const empName = `${u.firstName} ${u.lastName}`;

      try {
        // ── Pre-check: decrypt Employee record and verify baseSalary before computing ──
        const empDoc = await Employee.findById(u._id).lean();
        if (!empDoc) {
          skipped.push({ name: empName, reason: 'No Employee profile found in employees collection' });
          continue;
        }

        const decrypted  = decryptEmployee(empDoc);
        const baseSalary = extractBaseSalary(decrypted);

        if (!baseSalary || baseSalary <= 0) {
          console.warn(`[Payroll] Skipped ${empName} — baseSalary not configured`);
          skipped.push({
            name:       empName,
            employeeId: u._id,
            reason:     'Base salary not configured. Please update the employee profile.'
          });
          continue;
        }

        const result = await PayrollController._computeAndSave(u._id, Number(month), Number(year));
        generated.push({ name: empName, netSalary: result.payroll.netSalary });

      } catch (err) {
        console.error(`[Payroll] Failed for ${empName}:`, err.message);
        failed.push({ name: empName, error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Payroll generated for ${generated.length} employee(s). ${skipped.length} skipped (no salary configured).`,
      generated:      generated.length,
      failed:         failed.length,
      skipped:        skipped.length,
      details:        generated,
      errors:         failed,
      skippedDetails: skipped
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CORE CALCULATION ENGINE
  // ───────────────────────────────────────────────────────────────────────────
  static async _computeAndSave(employeeId, month, year) {

    // 1. User record — for auth identity fields (name etc.)
    const userDoc = await User.findById(employeeId).select(
      'firstName lastName employeeId email profilePhoto'
    );
    if (!userDoc) throw new Error('Employee not found');

    // ── FIX: fetch all details (including encrypted salary) from Employee ─────
    const empDoc = await Employee.findById(employeeId).lean();
    if (!empDoc) {
      throw new Error(`Employee profile not found for ${userDoc.firstName} ${userDoc.lastName}`);
    }

    const decryptedEmp = decryptEmployee(empDoc);
    const baseSalary   = extractBaseSalary(decryptedEmp);

    if (!baseSalary || baseSalary <= 0) {
      throw new Error(`Base salary not configured for ${userDoc.firstName} ${userDoc.lastName}`);
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 0, 23, 59, 59);

    // 2. Public holidays for this month
    const holidayDocs = await Holiday.find({ year, month, isActive: true }).select('date');
    const holidaySet  = new Set(holidayDocs.map(h => {
      const d    = new Date(h.date);
      const yyyy = d.getFullYear();
      const mm   = String(d.getMonth() + 1).padStart(2, '0');
      const dd   = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }));

    // Sunday always off, 2nd & 4th Saturday off
    const isWeekOff = (date) => {
      const day = date.getDay();
      if (day === 0) return true;
      if (day === 6) {
        const saturdayIndex = Math.ceil(date.getDate() / 7);
        return saturdayIndex === 2 || saturdayIndex === 4;
      }
      return false;
    };

    const toDateKey = (date) => {
      const yyyy = date.getFullYear();
      const mm   = String(date.getMonth() + 1).padStart(2, '0');
      const dd   = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    // 3. Attendance records for the month
    const attendanceRecords = await Attendance.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    });

    // 4. Approved leaves for the month
    const approvedLeaves = await Leave.find({
      employee: employeeId,
      status: 'approved',
      $or: [
        { startDate: { $gte: startDate, $lte: endDate } },
        { endDate:   { $gte: startDate, $lte: endDate } },
        { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
      ]
    });

    // 5. Build date → leaveType map
    const leaveDateMap = new Map();
    approvedLeaves.forEach(leave => {
      const lStart = new Date(Math.max(new Date(leave.startDate), startDate));
      const lEnd   = new Date(Math.min(new Date(leave.endDate),   endDate));
      getDatesBetween(lStart, lEnd).forEach(ds => leaveDateMap.set(ds, leave.leaveType));
    });

    // 6. Build date → attendance status map
    const attendanceMap = new Map();
    attendanceRecords.forEach(r => {
      const key = toDateKey(new Date(r.date));
      attendanceMap.set(key, r.status);
    });

    // 7. Walk every calendar day of the month
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    let presentDays       = 0;
    let halfDays          = 0;
    let paidLeaveDays     = 0;
    let unpaidLeaveDays   = 0;
    let absentDays        = 0;
    let lateDays          = 0;
    let shortLeaveDays    = 0;
    let earlyGoDays       = 0;
    let casualLeavesTaken = 0;
    let sickLeavesTaken   = 0;
    let earnedLeavesTaken = 0;
    let holidayDays       = 0;
    let weekOffDays       = 0;

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const date    = new Date(year, month - 1, d);
      const dateKey = toDateKey(date);

      if (isWeekOff(date))          { weekOffDays++; continue; }
      if (holidaySet.has(dateKey))  { holidayDays++; continue; }

      const attStatus = attendanceMap.get(dateKey);
      const leaveType = leaveDateMap.get(dateKey);

      // ── No attendance record for this working day ──
      if (!attStatus) {
        if (leaveType) {
          if (leaveType === 'unpaid') {
            unpaidLeaveDays++;
          } else if (leaveType === 'short') {
            shortLeaveDays++;
            presentDays++;
          } else {
            // casual / sick / earned → paid leave, no salary deduction
            paidLeaveDays++;
            if (leaveType === 'casual')      casualLeavesTaken++;
            else if (leaveType === 'sick')   sickLeavesTaken++;
            else if (leaveType === 'earned') earnedLeavesTaken++;
          }
        } else {
          // No attendance + no approved leave → absent
          absentDays++;
        }
        continue;
      }

      // ── Attendance record exists ──
      switch (attStatus) {

        case 'present':
        case 'working':
          // Full present day — no deduction
          presentDays++;
          break;

        case 'late':
          // Came late — 25% penalty
          presentDays++;
          lateDays++;
          break;

        case 'short-leave':
          // Left for a short period — 25% penalty always
          presentDays++;
          shortLeaveDays++;
          break;

        case 'early-go':
          // Left early — 25% penalty
          presentDays++;
          earlyGoDays++;
          break;

        case 'half-day':
          // Half day worked — 50% deduction
          halfDays++;
          break;

        case 'leave':
          if (leaveType) {
            if (leaveType === 'unpaid') {
              // Marked leave + unpaid → full day deduction
              unpaidLeaveDays++;
            } else if (leaveType === 'short') {
              // Short leave approved → 25% deduction
              shortLeaveDays++;
              presentDays++;
            } else {
              // Paid leave (casual/sick/earned) → no deduction
              paidLeaveDays++;
              if (leaveType === 'casual')      casualLeavesTaken++;
              else if (leaveType === 'sick')   sickLeavesTaken++;
              else if (leaveType === 'earned') earnedLeavesTaken++;
            }
          } else {
            // Leave status but no approved leave record → treat as unpaid
            unpaidLeaveDays++;
          }
          break;

        case 'absent':
          if (leaveType) {
            if (leaveType === 'unpaid') {
              unpaidLeaveDays++;
            } else if (leaveType === 'short') {
              shortLeaveDays++;
              presentDays++;
            } else {
              // Has approved paid leave → no deduction
              paidLeaveDays++;
              if (leaveType === 'casual')      casualLeavesTaken++;
              else if (leaveType === 'sick')   sickLeavesTaken++;
              else if (leaveType === 'earned') earnedLeavesTaken++;
            }
          } else {
            // Absent with no leave record → full day deduction
            absentDays++;
          }
          break;

        default:
          presentDays++;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Per-day salary — always divided by 30 (standard month, not calendar days)
    //    actualWorkingDays tracked for display only (payslip "Total Working Days")
    // ─────────────────────────────────────────────────────────────────────────
    const STANDARD_MONTH_DAYS = 30;
    const actualWorkingDays   = totalDaysInMonth - weekOffDays - holidayDays;
    const perDaySalary        = baseSalary / STANDARD_MONTH_DAYS;  // always ÷ 30

    // Effective paid days (for display/record only — not used in deduction formula)
    const workedDays = presentDays + paidLeaveDays + (halfDays * 0.5);

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Deductions
    //    All calculated using perDaySalary = baseSalary / 30
    //
    //    Full day  (1.00x) : absent, unpaid leave
    //    Half day  (0.50x) : half-day attendance
    //    Quarter   (0.25x) : late, short-leave, early-go
    //    Excess leave      : casual/sick taken beyond balance → full day each
    // ─────────────────────────────────────────────────────────────────────────
    let deductions = 0;

    // Full-day deductions
    deductions += absentDays      * perDaySalary;          // full day cut
    deductions += unpaidLeaveDays * perDaySalary;          // full day cut

    // Half-day deduction
    deductions += halfDays        * (perDaySalary * 0.5);  // 50% cut per half-day

    // Quarter-day deductions
    deductions += lateDays        * (perDaySalary * 0.25); // 25% cut per late day
    deductions += shortLeaveDays  * (perDaySalary * 0.25); // 25% cut per short-leave
    deductions += earlyGoDays     * (perDaySalary * 0.25); // 25% cut per early-go

    // Excess leave deductions (taken beyond allocated balance → full day cut each)
    const leaveBalance = await Leave.findOne({ employee: employeeId, leaveType: 'Initial Allocation' });
    let excessCasualDeduction = 0;
    let excessSickDeduction   = 0;
    if (leaveBalance) {
      const availCasual = leaveBalance.casualLeave || 0;
      const availSick   = leaveBalance.sickLeave   || 0;
      if (casualLeavesTaken > availCasual) {
        excessCasualDeduction = (casualLeavesTaken - availCasual) * perDaySalary;
        deductions += excessCasualDeduction;
      }
      if (sickLeavesTaken > availSick) {
        excessSickDeduction = (sickLeavesTaken - availSick) * perDaySalary;
        deductions += excessSickDeduction;
      }
    }

    deductions = Math.round(deductions);
    const netSalary = Math.max(baseSalary - deductions, 0);

    // 10. Upsert payroll record
    const payrollDoc = await Payroll.findOneAndUpdate(
      { employee: employeeId, month, year },
      {
        $set: {
          baseSalary,
          workingDays:  actualWorkingDays,
          workedDays:   Math.round(workedDays * 100) / 100,
          deductions,
          netSalary,
          status:    'draft',
          updatedAt: new Date()
        }
      },
      { new: true, upsert: true }
    );

    const breakdown = {
      baseSalary,
      workingDays:  actualWorkingDays,
      workedDays:   Math.round(workedDays * 100) / 100,
      perDaySalary: Math.round(perDaySalary * 100) / 100,  // baseSalary / 30
      attendance: {
        presentDays,
        halfDays,
        lateDays,
        shortLeaveDays,
        earlyGoDays,
        paidLeaveDays,
        unpaidLeaveDays,
        absentDays,
        holidayDays,
        weekOffDays
      },
      leaves: {
        casualLeavesTaken,
        sickLeavesTaken,
        earnedLeavesTaken,
        totalApprovedLeaves: paidLeaveDays
      },
      deductions: {
        absentDeduction:       Math.round(absentDays * perDaySalary),
        unpaidLeaveDeduction:  Math.round(unpaidLeaveDays * perDaySalary),
        halfDayDeduction:      Math.round(halfDays * perDaySalary * 0.5),
        lateDeduction:         Math.round(lateDays * perDaySalary * 0.25),
        shortLeaveDeduction:   Math.round(shortLeaveDays * perDaySalary * 0.25),
        earlyGoDeduction:      Math.round(earlyGoDays * perDaySalary * 0.25),
        excessCasualDeduction: Math.round(excessCasualDeduction),
        excessSickDeduction:   Math.round(excessSickDeduction),
        totalDeductions:       deductions
      },
      netSalary
    };

    return { payroll: payrollDoc, breakdown };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GET payroll records
  // ───────────────────────────────────────────────────────────────────────────
  getPayroll = catchAsync(async (req, res) => {
    const { employeeId, month, year } = req.query;
    const query = {};

    if (employeeId) query.employee = employeeId;
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const payrolls = await Payroll.find(query)
      .populate('employee',
        'firstName lastName employeeId department designation baseSalary ' +
        'bankName bankAccountNumber ifscCode dateOfJoining panCard profilePhoto email contact'
      )
      .sort({ year: -1, month: -1 });

    res.json(payrolls);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET single payroll with full live breakdown (for payslip)
  // ───────────────────────────────────────────────────────────────────────────
  getPayrollBreakdown = catchAsync(async (req, res) => {
    const { payrollId } = req.params;

    const payroll = await Payroll.findById(payrollId).populate('employee',
      'firstName lastName employeeId department designation baseSalary ' +
      'bankName bankAccountNumber ifscCode dateOfJoining panCard profilePhoto email contact'
    );
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });

    const result = await PayrollController._computeAndSave(
      payroll.employee._id,
      payroll.month,
      payroll.year
    );

    res.json({
      success: true,
      payroll: result.payroll,
      breakdown: result.breakdown,
      employee: payroll.employee
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PROCESS (draft → processed)
  // ───────────────────────────────────────────────────────────────────────────
  processPayroll = catchAsync(async (req, res) => {
    const { payrollId } = req.body;
    if (!payrollId) return res.status(400).json({ success: false, message: 'payrollId required' });

    const payroll = await Payroll.findByIdAndUpdate(
      payrollId,
      { status: 'processed', updatedAt: new Date() },
      { new: true }
    ).populate('employee', 'firstName lastName');

    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });
    res.json({ success: true, message: 'Payroll processed', payroll });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PAY (processed → paid)
  // ───────────────────────────────────────────────────────────────────────────
  payPayroll = catchAsync(async (req, res) => {
    const { payrollId } = req.body;
    if (!payrollId) return res.status(400).json({ success: false, message: 'payrollId required' });

    const payroll = await Payroll.findByIdAndUpdate(
      payrollId,
      { status: 'paid', paidDate: new Date(), updatedAt: new Date() },
      { new: true }
    ).populate('employee', 'firstName lastName');

    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });
    res.json({ success: true, message: 'Payroll paid', payroll });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYSLIP DOWNLOAD REQUEST SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  requestDownload = catchAsync(async (req, res) => {
    const { payrollId, reason } = req.body;
    const employeeId = req.user._id || req.user.id;

    if (!payrollId || !reason?.trim()) {
      return res.status(400).json({ success: false, message: 'payrollId and reason are required' });
    }

    const payroll = await Payroll.findById(payrollId).populate('employee', 'firstName lastName');
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });

    const isHR = req.user.role === 'admin' || req.user.role === 'hr';
    if (!isHR && payroll.employee._id.toString() !== employeeId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const existing = await PayslipRequest.findOne({
      employee: employeeId,
      payroll:  payrollId,
      status:   { $in: ['pending', 'approved'] },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: existing.status === 'approved'
          ? 'You already have an approved download request for this payslip.'
          : 'A download request is already pending for this payslip.',
        request: existing,
      });
    }

    const newRequest = await PayslipRequest.create({
      employee: employeeId,
      payroll:  payrollId,
      reason:   reason.trim(),
    });

    const empUser  = await User.findById(employeeId).select('firstName lastName');
    const empName  = empUser ? `${empUser.firstName} ${empUser.lastName}` : 'An employee';
    const monthStr = new Date(payroll.year, payroll.month - 1, 1)
      .toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    await notifyAllHR({
      sender:   employeeId,
      type:     'payslip_requested',
      title:    'Payslip Download Request',
      message:  `${empName} has requested to download their payslip for ${monthStr}.`,
      refId:    newRequest._id,
      refModel: 'Payroll',
      meta:     { payrollId, month: payroll.month, year: payroll.year, reason: reason.trim() },
    });

    res.status(201).json({
      success: true,
      message: 'Download request submitted. HR will review it shortly.',
      request: newRequest,
    });
  });

  getMyDownloadRequests = catchAsync(async (req, res) => {
    const employeeId = req.user._id || req.user.id;
    const requests = await PayslipRequest.find({ employee: employeeId })
      .populate('payroll', 'month year baseSalary netSalary status')
      .populate('reviewedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json({ success: true, requests });
  });

  getPendingDownloadRequests = catchAsync(async (req, res) => {
    const { status = 'pending' } = req.query;
    const filter = status === 'all' ? {} : { status };
    const requests = await PayslipRequest.find(filter)
      .populate('employee', 'firstName lastName employeeId department designation email')
      .populate('payroll', 'month year baseSalary netSalary status')
      .populate('reviewedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json({ success: true, requests });
  });

  approveDownloadRequest = catchAsync(async (req, res) => {
    const { requestId } = req.body;
    const reviewerId = req.user._id || req.user.id;

    if (!requestId) return res.status(400).json({ success: false, message: 'requestId required' });

    const request = await PayslipRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already ${request.status}` });
    }

    request.status     = 'approved';
    request.reviewedBy = reviewerId;
    request.hrResponse = '';
    request.updatedAt  = new Date();
    await request.save();

    await request.populate([
      { path: 'employee',   select: 'firstName lastName employeeId email' },
      { path: 'payroll',    select: 'month year netSalary' },
      { path: 'reviewedBy', select: 'firstName lastName' },
    ]);

    const monthStr = new Date(request.payroll.year, request.payroll.month - 1, 1)
      .toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    await createNotification({
      recipient: request.employee._id,
      sender:    reviewerId,
      type:      'payslip_approved',
      title:     'Payslip Download Approved ✅',
      message:   `Your payslip download request for ${monthStr} has been approved. You can now download it.`,
      refId:     request.payroll._id,
      refModel:  'Payroll',
      meta:      { month: request.payroll.month, year: request.payroll.year },
    });

    res.json({ success: true, message: 'Download request approved', request });
  });

  rejectDownloadRequest = catchAsync(async (req, res) => {
    const { requestId, hrResponse } = req.body;
    const reviewerId = req.user._id || req.user.id;

    if (!requestId || !hrResponse?.trim()) {
      return res.status(400).json({ success: false, message: 'requestId and hrResponse are required' });
    }

    const request = await PayslipRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already ${request.status}` });
    }

    request.status     = 'rejected';
    request.reviewedBy = reviewerId;
    request.hrResponse = hrResponse.trim();
    request.updatedAt  = new Date();
    await request.save();

    await request.populate([
      { path: 'employee',   select: 'firstName lastName employeeId email' },
      { path: 'payroll',    select: 'month year netSalary' },
      { path: 'reviewedBy', select: 'firstName lastName' },
    ]);

    const monthStr = new Date(request.payroll.year, request.payroll.month - 1, 1)
      .toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    await createNotification({
      recipient: request.employee._id,
      sender:    reviewerId,
      type:      'payslip_rejected',
      title:     'Payslip Download Rejected ❌',
      message:   `Your payslip download request for ${monthStr} was rejected. Reason: ${hrResponse.trim()}`,
      refId:     request.payroll._id,
      refModel:  'Payroll',
      meta:      { month: request.payroll.month, year: request.payroll.year, reason: hrResponse.trim() },
    });

    res.json({ success: true, message: 'Download request rejected', request });
  });

  checkDownloadPermission = catchAsync(async (req, res) => {
    const { payrollId } = req.params;
    const employeeId = req.user._id || req.user.id;

    const request = await PayslipRequest.findOne({ employee: employeeId, payroll: payrollId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      canDownload: request?.status === 'approved',
      request: request || null
    });
  });
}

module.exports = new PayrollController();