const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const apiResponse = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const Leave = require('../models/Leave');
const Defaults = require('../models/LeaveDefaults');
const mongoose = require('mongoose');
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


createEmployee = catchAsync(async (req, res) => {
  let user = null;
  let leave = null;

  try {
    const { firstName, lastName, email, password, department, designation, dateOfJoining } = req.body;

    // Check if the email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already exists' });

    // Find the latest employeeId, extract the number, and increment it
    const lastEmployee = await User.findOne().sort({ createdAt: -1 });
    const nextEmployeeId = lastEmployee ? parseInt(lastEmployee.employeeId, 10) + 1 : 1; // Increment by 1 or start from 1
    const employeeId = nextEmployeeId; // New employee ID purely as a number

    // Create the new employee
    user = new User({
      firstName,
      lastName,
      email,
      password,
      role: 'employee',
      department,
      designation,
      dateOfJoining,
      employeeId, // The new employee ID
    });
    await user.save(); // Save employee record
    // Employee created successfully, proceed to create leave record

    // Default leave allocation (casual & sick)
    const defaultLeave = await Defaults.findOne({});
    const casualLeave = Math.ceil((defaultLeave ? defaultLeave.casualDefault : 8) * (12 - new Date(dateOfJoining).getMonth()) / 12);
    const sickLeave = Math.ceil((defaultLeave ? defaultLeave.sickDefault : 6) * (12 - new Date(dateOfJoining).getMonth()) / 12);

    // Create initial leave record
    leave = new Leave({
      employee: user._id,
      leaveType: 'Initial Allocation',
      numberOfDays: 0,
      reason: 'Initial leave allocation based on joining date',
      status: 'left',
      casualLeave,
      sickLeave,
      earnedLeave: 0,
      maternityLeave: 0,
      paternityLeave: 0
    });

    await leave.save(); // Save leave record
    // Leave record created successfully, return success message

    res.status(201).json({ message: 'Employee created successfully', user });

  } catch (error) {
    // Manual rollback in case of failure at any point

    if (user) {
      // If user creation is successful but leave creation fails, rollback user record
      await User.deleteOne({ _id: user._id });
    }
    if (leave) {
      // If leave creation is successful but another operation fails, rollback leave record
      await Leave.deleteOne({ _id: leave._id });
    }

    // Return error response with the error message
    res.status(500).json({ message: error.message });
  }
});


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
