const Payroll    = require('../models/Payroll');
const Attendance = require('../models/Attendance');
const User       = require('../models/User');
const Leave      = require('../models/Leave');
const catchAsync = require('../utils/catchAsync');
const Holiday    = require('../models/Holiday.modal');

// ─── Helper: count working days in a month (Mon–Sat, skip Sundays) ────────────
function getWorkingDaysInMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay(); // 0=Sun
    if (day !== 0) count++;
  }
  return count;
}

// ─── Helper: get all date strings between two dates (inclusive) ───────────────
function getDatesBetween(start, end) {
  const dates = [];
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d).toISOString().split('T')[0]);
  }
  return dates;
}

class PayrollController {

  // ───────────────────────────────────────────────────────────────────────────
  // GENERATE payroll for a SINGLE employee — fully automatic from DB data
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

    const employees = await User.find({ isActive: true, role: { $ne: 'admin' } }).select('_id firstName lastName');

    const generated = [];
    const failed    = [];

    for (const emp of employees) {
      try {
        const result = await PayrollController._computeAndSave(emp._id, Number(month), Number(year));
        generated.push({ name: `${emp.firstName} ${emp.lastName}`, netSalary: result.payroll.netSalary });
      } catch (err) {
        failed.push({ name: `${emp.firstName} ${emp.lastName}`, error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Payroll generated for ${generated.length} employee(s)`,
      generated: generated.length,
      failed: failed.length,
      details: generated,
      errors: failed
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CORE CALCULATION ENGINE
  // ───────────────────────────────────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  // CORE CALCULATION ENGINE
  // ───────────────────────────────────────────────────────────────────────────
static async _computeAndSave(employeeId, month, year) {

  // 1. Employee record (source of baseSalary)
  const employee = await User.findById(employeeId).select(
    'firstName lastName baseSalary department designation employeeId ' +
    'bankName bankAccountNumber ifscCode dateOfJoining panCard profilePhoto email contact'
  );
  if (!employee) throw new Error('Employee not found');
  if (!employee.baseSalary || employee.baseSalary <= 0) {
    throw new Error(`Base salary not configured for ${employee.firstName} ${employee.lastName}`);
  }

  const baseSalary = employee.baseSalary;

  // ── Use UTC-based start/end to avoid local-timezone date drift ────────────
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate   = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  // ── Fetch public holidays for this month from DB ──────────────────────────
  const holidayDocs = await Holiday.find({
    year,
    month,
    isActive: true
  }).select('date');
  // Normalize holiday dates to UTC date strings (YYYY-MM-DD)
  const holidaySet = new Set(
    holidayDocs.map(h => new Date(h.date).toISOString().split('T')[0])
  );

  // ── Helper: is this date a weekly off (Sunday or 2nd/4th Saturday)? ───────
  // Uses UTC day/date to avoid timezone-shift issues
  const isWeekOff = (utcDate) => {
    const day = utcDate.getUTCDay();
    if (day === 0) return true; // Sunday — always off
    if (day === 6) {
      const saturdayIndex = Math.ceil(utcDate.getUTCDate() / 7);
      return saturdayIndex === 2 || saturdayIndex === 4; // 2nd & 4th Saturday off
    }
    return false;
  };

  // ── Count actual working days in the month (UTC-safe) ─────────────────────
  const totalDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let workingDays = 0;
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const date    = new Date(Date.UTC(year, month - 1, d));
    const dateKey = date.toISOString().split('T')[0]; // always YYYY-MM-DD in UTC
    if (!isWeekOff(date) && !holidaySet.has(dateKey)) workingDays++;
  }

  // 2. Attendance records for the month
  const attendanceRecords = await Attendance.find({
    employee: employeeId,
    date: { $gte: startDate, $lte: endDate }
  });

  // 3. Approved leaves for the month
  const approvedLeaves = await Leave.find({
    employee: employeeId,
    status: 'approved',
    $or: [
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate:   { $gte: startDate, $lte: endDate } },
      { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
    ]
  });

  // 4. Build date → leaveType map (clipped to this month, UTC-safe)
  const leaveDateMap = new Map();
  approvedLeaves.forEach(leave => {
    const lStart = new Date(Math.max(new Date(leave.startDate).getTime(), startDate.getTime()));
    const lEnd   = new Date(Math.min(new Date(leave.endDate).getTime(),   endDate.getTime()));
    getDatesBetween(lStart, lEnd).forEach(ds => leaveDateMap.set(ds, leave.leaveType));
  });

  // 5. Build date → attendance status map (UTC date key)
  const attendanceMap = new Map();
  attendanceRecords.forEach(r => {
    // Use UTC date string so it matches dateKey below
    attendanceMap.set(new Date(r.date).toISOString().split('T')[0], r.status);
  });

  // 6. Walk every calendar day of the month (UTC-safe)
  let presentDays       = 0;
  let halfDays          = 0;
  let paidLeaveDays     = 0;
  let unpaidLeaveDays   = 0;
  let absentDays        = 0;
  let lateDays          = 0;
  let shortLeaveDays    = 0;
  let holidayDays       = 0; // NEW: track paid holidays
  let casualLeavesTaken = 0;
  let sickLeavesTaken   = 0;
  let earnedLeavesTaken = 0;

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const date    = new Date(Date.UTC(year, month - 1, d)); // UTC — no timezone drift
    const dateKey = date.toISOString().split('T')[0];

    // ── SKIP: Sunday, 2nd/4th Saturday ──────────────────────────────────────
    if (isWeekOff(date)) {
      console.log(`Skipping ${dateKey} (${date.getUTCDay() === 0 ? 'Sunday' : '2nd/4th Saturday'})`);
      continue;
    }

    // ── Public Holiday: counts as a paid day, no deduction ──────────────────
    if (holidaySet.has(dateKey)) {
      console.log(`Skipping ${dateKey} (Public Holiday)`);
      holidayDays++;
      continue;
    }

    const attStatus = attendanceMap.get(dateKey);
    const leaveType = leaveDateMap.get(dateKey);

    if (!attStatus) {
      // No attendance record for this working day
      if (leaveType) {
        if (leaveType === 'unpaid') {
          unpaidLeaveDays++;
        } else {
          paidLeaveDays++;
          if (leaveType === 'casual')      casualLeavesTaken++;
          else if (leaveType === 'sick')   sickLeavesTaken++;
          else if (leaveType === 'earned') earnedLeavesTaken++;
        }
      } else {
        absentDays++;
      }
      continue;
    }

    switch (attStatus) {
      case 'present':
      case 'working':
        presentDays++;
        break;

      case 'late':
        presentDays++;
        lateDays++;
        break;

      case 'short-leave':
        presentDays++;
        shortLeaveDays++;
        break;

      case 'half-day':
        halfDays++;
        break;

      case 'leave':
        if (leaveType) {
          if (leaveType === 'unpaid') { unpaidLeaveDays++; }
          else {
            paidLeaveDays++;
            if (leaveType === 'casual')      casualLeavesTaken++;
            else if (leaveType === 'sick')   sickLeavesTaken++;
            else if (leaveType === 'earned') earnedLeavesTaken++;
          }
        } else {
          unpaidLeaveDays++; // leave without approval = unpaid
        }
        break;

      case 'absent':
        if (leaveType) {
          if (leaveType === 'unpaid') { unpaidLeaveDays++; }
          else {
            paidLeaveDays++;
            if (leaveType === 'casual')      casualLeavesTaken++;
            else if (leaveType === 'sick')   sickLeavesTaken++;
            else if (leaveType === 'earned') earnedLeavesTaken++;
          }
        } else {
          absentDays++;
        }
        break;

      default:
        presentDays++;
    }
  }

  // 7. Worked days (present + paid leaves + half days × 0.5)
  const workedDays = presentDays + paidLeaveDays + (halfDays * 0.5);

  // 8. Per-day salary
  const perDaySalary = baseSalary / workingDays;

  // 9. Calculate all deductions
  let deductions = 0;

  // Absent without leave — full day deduction
  deductions += (workingDays - workedDays) * perDaySalary;

  // Unpaid leave — full day deduction per unpaid leave day
  deductions += unpaidLeaveDays * perDaySalary;

  // Half day — half day deduction
  deductions += halfDays * (perDaySalary * 0.5);

  // Late arrival — 0.25 day per late instance
  deductions += lateDays * (perDaySalary * 0.25);

  // Holiday deduction: public holidays are PAID — no deduction (tracked for breakdown only)

  // Excess casual/sick leaves beyond employee balance
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

  // 10. Net salary (floor at 0)
  const netSalary = Math.max(baseSalary - deductions, 0);

  // 11. Upsert payroll record
  const payrollDoc = await Payroll.findOneAndUpdate(
    { employee: employeeId, month, year },
    {
      $set: {
        baseSalary,
        workingDays,
        workedDays:  Math.round(workedDays * 100) / 100,
        deductions,
        netSalary,
        status: 'draft',
        updatedAt: new Date()
      }
    },
    { new: true, upsert: true }
  );

  const breakdown = {
    baseSalary,
    workingDays,
    workedDays:   Math.round(workedDays * 100) / 100,
    perDaySalary: Math.round(perDaySalary * 100) / 100,
    attendance: {
      presentDays,
      halfDays,
      lateDays,
      shortLeaveDays,
      paidLeaveDays,
      unpaidLeaveDays,
      absentDays,
      holidayDays       // NEW: public holidays shown in breakdown
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
    if (month)      query.month    = Number(month);
    if (year)       query.year     = Number(year);

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

    // Re-compute live breakdown
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
}

module.exports = new PayrollController();