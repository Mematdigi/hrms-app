const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const apiResponse = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');

class EmployeeController {
getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' }).select('-password');
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

getEmployeeById = catchAsync(
async (req, res) => {
  try {
    const employee = await User.findById(req.params.id).select('-password');
    if (!employee) {  
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
  throw new ApiError(500, error.message);
  }
});

createEmployee = async (req, res) => {
  try {
    const { firstName, lastName, email, password, department, designation, dateOfJoining} = req.body;    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const user = new User({
      firstName,
      lastName,
      email,
      password,
      role : 'employee',
      department,
      designation,
      dateOfJoining,
      employeeId: `EMP${(await User.findOne().sort({ employeeId: -1 }))?.employeeId?.slice(3) * 1 + 1 || 1}`.padStart(4, '0')
    });

    await user.save();
    res.status(201).json({ message: 'Employee created successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

updateEmployee = async (req, res) => {
  try {
    const employee = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json({ message: 'Employee updated successfully', employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

deleteEmployee = async (req, res) => {
  try {
    const employee = await User.findByIdAndDelete(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
    
// API to get employee and payroll data
getEmployeePayrolls = catchAsync(async (req, res) => {
    // Fetch employee data with populated payroll data

    console.log("Fetching employee payroll data");
    try{
    const employeesWithPayroll = await User.aggregate([
        {
    $match: { role: "employee" } 
  },
      {
        $lookup: {
          from: 'payrolls', // 'payrolls' is the collection name for payroll
          localField: '_id',
          foreignField: 'employee', // this matches employee's ObjectId in the payroll collection
          as: 'payrolls',
        }
      },
      {
        $unwind: {
          path: '$payroll',
          preserveNullAndEmptyArrays: true, // Allows for employees without payroll data
        }
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          department: 1,
          designation: 1,
          dateOfJoining: 1,
          employeeId: 1,
          payroll: {
            employeeUniqueId: '$payrolls.employee',
            month: '$payrolls.month',
            year: '$payrolls.year',
            baseSalary: '$payrolls.baseSalary',
            workingDays: '$payrolls.workingDays',
            deductions: '$payrolls.deductions',
            workedDays: '$payrolls.workedDays',
            netSalary: '$payrolls.netSalary',
            status: '$payrolls.status',
          },
        }
      }
    ]);
      console.log(employeesWithPayroll);
      if(!employeesWithPayroll){
 throw  new ApiError(404, "No employees found");
      }
    return res.status(200).json({
      success: true,
      data: employeesWithPayroll
    });} catch (error) {
      console.error(error);
  throw new ApiError(500, "Server Error");
    }
})


}

module.exports = new EmployeeController();
