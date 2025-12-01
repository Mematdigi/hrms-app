const Payroll = require('../models/Payroll');
const Attendance = require('../models/Attendance');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/User');
const Leave = require('../models/Leave')
class PayrollController
{

generatePayroll = catchAsync(async (req, res) => {
  try {
    let { employee, month, year, baseSalary, deductions, workingDays, workedDays } = req.body;
    
    // Validate required fields
    if (!employee || !month || !year) {
      return res.status(400).json({ message: 'Employee, month, and year are required' });
    }

    // Get employee details
    const user = await User.findById(employee);
    if (!user) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Set base salary from user if not provided
    if (!baseSalary && (baseSalary != user.baseSalary) && (baseSalary == 0) ) {
      baseSalary = user.baseSalary || 0;
    }

    // Set default working days if not provided
    if (!workingDays) {
      workingDays = 24; // Default working days in a month
    }

    // Calculate start and end date for the month
    const startDate = new Date(year, month - 1, 1); // First day of month
    const endDate = new Date(year, month, 0, 23, 59, 59); // Last day of month

    // ========== FETCH ATTENDANCE DATA ==========
    const attendanceRecords = await Attendance.find({
      employee: employee,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // ========== FETCH APPROVED LEAVES ==========
    const approvedLeaves = await Leave.find({
      employee: employee,
      status: 'approved',
      $or: [
        // Leave starts within the month
        { startDate: { $gte: startDate, $lte: endDate } },
        // Leave ends within the month
        { endDate: { $gte: startDate, $lte: endDate } },
        // Leave spans the entire month
        { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
      ]
    });

    // Create a map of leave dates with leave type
    const leaveDatesMap = new Map();
    approvedLeaves.forEach(leave => {
      const leaveStart = new Date(Math.max(leave.startDate, startDate));
      const leaveEnd = new Date(Math.min(leave.endDate, endDate));
      
      // Add all dates in the leave period to the map
      for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        leaveDatesMap.set(dateKey, leave.leaveType);
      }
    });

    // ========== CALCULATE WORKED DAYS AND DEDUCTIONS ==========
    let presentDays = 0;
    let halfDays = 0;
    let paidLeaveDays = 0; // sick or casual leave
    let unpaidLeaveDays = 0;
    let absentDays = 0;
    let casualLeavesTaken = 0;
    let sickLeavesTaken = 0;

    attendanceRecords.forEach(record => {
      const recordDateKey = new Date(record.date).toISOString().split('T')[0];
      const leaveType = leaveDatesMap.get(recordDateKey);

      switch (record.status) {
        case 'present':
        case 'working':
          presentDays++;
          break;
          
        case 'half-day':
          halfDays++;
          break;
          
        case 'leave':
          // Check if this leave is in approved leaves
          if (leaveType) {
            if (leaveType === 'casual') {
              casualLeavesTaken++;
              paidLeaveDays++;
            } else if (leaveType === 'sick') {
              sickLeavesTaken++;
              paidLeaveDays++;
            } else if (leaveType === 'unpaid') {
              unpaidLeaveDays++;
            } else {
              // Other leave types (earned, maternity, paternity, holidays)
              paidLeaveDays++;
            }
          } else {
            // Leave marked but not approved - treat as unpaid
            unpaidLeaveDays++;
          }
          break;
          
        case 'absent':
          // Check if absence is covered by approved leave
          if (leaveType) {
            if (leaveType === 'casual') {
              casualLeavesTaken++;
              paidLeaveDays++;
            } else if (leaveType === 'sick') {
              sickLeavesTaken++;
              paidLeaveDays++;
            } else if (leaveType === 'unpaid') {
              unpaidLeaveDays++;
            } else {
              paidLeaveDays++;
            }
          } else {
            // Absent without approved leave
            absentDays++;
          }
          break;
      }
    });

    // Calculate total worked days
    
    // Use provided workedDays or calculated value
    if (!workedDays && workedDays == 0) {
      workedDays = workingDays - (absentDays + halfDays*0.5)
    }

    // ========== CALCULATE DEDUCTIONS ==========
    const perDaySalary = baseSalary / workingDays;
    
    let calculatedDeductions = 0;
    
    // Deduct for unpaid leaves (full day deduction)
    calculatedDeductions += unpaidLeaveDays * perDaySalary;
    
    // Deduct for absences without approved leave (full day deduction)
    calculatedDeductions += absentDays * perDaySalary;
    
    // Deduct for half days (half day deduction)
    calculatedDeductions += halfDays * (perDaySalary * 0.5);

    // Optional: Deduct for excess casual/sick leaves if policy requires
    // Get employee's leave balance
    const leaveBalance = await Leave.findOne({
      employee: employee,
      leaveType: 'Initial Allocation'
    });

    if (leaveBalance) {
      // Check if casual leaves exceed balance
      const availableCasualLeaves = leaveBalance.casualLeave || 0;
      if (casualLeavesTaken > availableCasualLeaves) {
        const excessCasualLeaves = casualLeavesTaken - availableCasualLeaves;
        calculatedDeductions += excessCasualLeaves * perDaySalary;
      }

      // Check if sick leaves exceed balance
      const availableSickLeaves = leaveBalance.sickLeave || 0;
      if (sickLeavesTaken > availableSickLeaves) {
        const excessSickLeaves = sickLeavesTaken - availableSickLeaves;
        calculatedDeductions += excessSickLeaves * perDaySalary;
      }
    }

    // Use provided deductions or calculated value
    if (!deductions && deductions == 0) {
      deductions = Math.round(calculatedDeductions);
    }

    // ========== CALCULATE NET SALARY ==========
    const netSalary = baseSalary - deductions;

    // ========== UPDATE OR CREATE PAYROLL ==========
    
    const updatedPayroll = await Payroll.findOneAndUpdate(
      { employee: employee, month, year }, 
      {
        $set: {
          baseSalary,
          deductions,
          workingDays,
          workedDays: Math.round(workedDays * 100) / 100, // Round to 2 decimal places
          netSalary,
          status: 'draft',
        },
      },
      { new: true, upsert: true }
    );

    // ========== PREPARE DETAILED RESPONSE ==========
    res.status(200).json({
      success: true,
      message: updatedPayroll.isNew ? 'Payroll created successfully' : 'Payroll updated successfully',
      payroll: updatedPayroll,
      breakdown: {
        baseSalary,
        workingDays,
        workedDays: Math.round(workedDays * 100) / 100,
        perDaySalary: Math.round(perDaySalary * 100) / 100,
        attendance: {
          presentDays,
          halfDays,
          paidLeaveDays,
          unpaidLeaveDays,
          absentDays
        },
        leaves: {
          casualLeavesTaken,
          sickLeavesTaken,
          totalApprovedLeaves: paidLeaveDays
        },
        deductions: {
          unpaidLeaveDeduction: Math.round(unpaidLeaveDays * perDaySalary),
          absentDeduction: Math.round(absentDays * perDaySalary),
          halfDayDeduction: Math.round(halfDays * (perDaySalary * 0.5)),
          totalDeductions: deductions
        },
        netSalary
      }
    });
    
  } catch (error) {
    console.error('Error generating payroll:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

getPayroll = catchAsync(async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;
    const query = {};

    if (employeeId) query.employee = employeeId;
    if (month) query.month = month;
    if (year) query.year = year;

    const payroll = await Payroll.find(query).populate('employee', 'firstName lastName');
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
})

processPayroll = catchAsync(async (req, res) => {
  try {
    const { payrollId } = req.body;
    
    const payroll = await Payroll.findByIdAndUpdate(
      payrollId,
      { status: 'processed' },
      { new: true }
    );

    res.json({ message: 'Payroll processed', payroll });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
})

payPayroll = catchAsync( async (req, res) => {
  try {
    const { payrollId } = req.body;
    
    const payroll = await Payroll.findByIdAndUpdate(
      payrollId,
      { status: 'paid', paidDate: new Date() },
      { new: true }
    );

    res.json({ message: 'Payroll paid', payroll });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
})

}

module.exports = new PayrollController();