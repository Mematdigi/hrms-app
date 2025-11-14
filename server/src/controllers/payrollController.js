const Payroll = require('../models/Payroll');
const Attendance = require('../models/Attendance');

exports.generatePayroll = async (req, res) => {
  try {
    const { employee, month, year, baseSalary, deductions, workingDays, WorkedDays } = req.body;

    // Combine month + year to form period (optional)
    const period = `${month}-${year}`;  // You can optionally use this as a unique identifier if needed

    // Use findOneAndUpdate to find and update the existing payroll or create a new one
    const updatedPayroll = await Payroll.findOneAndUpdate(
      { employee: employee, month, year }, // search for the existing payroll by employee, month, and year
      {
        $set: {  // Use $set to update the fields
          baseSalary,
          Deductions: deductions,
          workingDays,
          WorkedDays,
          netSalary: baseSalary - deductions,
          status: 'draft',  // Optionally, change the status
        },
      },
      { new: true, upsert: true }  // new: true returns the updated document, upsert: true creates a new document if it doesn't exist
    );

    // Return a response based on whether it was updated or created
    res.status(200).json({
      message: updatedPayroll.isNew ? 'Payroll created successfully' : 'Payroll updated successfully',
      payroll: updatedPayroll,
    });
    
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
