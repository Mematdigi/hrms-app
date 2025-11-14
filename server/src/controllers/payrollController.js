const Payroll = require('../models/Payroll');
const Attendance = require('../models/Attendance');

exports.generatePayroll = async (req, res) => {
  try {
    const { employee, month, year, baseSalary, deductions, workingDays, WorkedDays } = req.body;
    
    const existingPayroll = await Payroll.findOne({ employee: employee, month, year });
    if (existingPayroll) {
      return res.status(400).json({ message: 'Payroll already exists for this month' });
    }

    const netSalary = baseSalary - deductions

    const payroll = new Payroll({
      employee,
      month,
      year,
      baseSalary,
      deductions,
      workingDays,
      netSalary,
      status: 'draft',
      WorkedDays
    });

    await payroll.save();
    res.status(201).json({ message: 'Payroll generated', payroll });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPayroll = async (req, res) => {
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
};

exports.processPayroll = async (req, res) => {
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
};

exports.payPayroll = async (req, res) => {
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
};
