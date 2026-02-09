const User = require('../models/User');
const Employee = require('../models/Employee'); 
const Leave = require('../models/Leave');
const Defaults = require('../models/LeaveDefaults');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');

class EmployeeController {

  getAllEmployees = async (req, res) => {
    try {
      const employees = await Employee.find().select('-password');
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  getEmployeeById = catchAsync(async (req, res) => {
    try {
      let employee = await Employee.findById(req.params.id);
      if (!employee) {
          employee = await User.findById(req.params.id).select('-password');
      }
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      res.json(employee);
    } catch (error) {
      throw new ApiError(500, error.message);
    }
  });

  // --- CREATE EMPLOYEE (FIXED) ---
  createEmployee = catchAsync(async (req, res) => {
    let user = null;
    let employee = null;
    let leave = null;

    try {
      const { 
        firstName, lastName, email, password, department, designation, 
        dateOfJoining, baseSalary, employeeId, contact, address, status 
      } = req.body;

      // 1. Check Duplicates in USER (Login system)
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ message: 'Email already exists in System' });

      // 2. Helper for File Paths
      const getFilePath = (fieldName) => {
        return req.files && req.files[fieldName] ? req.files[fieldName][0].path : null;
      };

      // 3. Create USER (Auth)
      user = new User({
        employeeId: employeeId, // Use the ID from the form
        firstName, lastName, email, password, role: 'employee',
        department, designation, dateOfJoining, baseSalary, isActive: true
      });
      await user.save();

      // 4. Create EMPLOYEE (Details & Docs)
      // We use the same _id as User to link them easily
      employee = new Employee({
        _id: user._id, 
        employeeId, firstName, lastName, email, password,
        contact, address, department, designation, dateOfJoining, baseSalary,
        status: status || 'Full Time',
        // Map Files
        profilePhoto: getFilePath('profilePhoto'),
        documents: {
          adharCard: getFilePath('adharCard'),
          panCard: getFilePath('panCard'),
          salarySlip: getFilePath('salarySlip'),
          relievingLetter: getFilePath('relievingLetter'),
          experienceLetter: getFilePath('experienceLetter'),
          offerLetter: getFilePath('offerLetter')
        }
      });
      await employee.save();

      // 5. Create Leave
      const defaultLeave = await Defaults.findOne({});
      const defaultCasual = defaultLeave ? defaultLeave.casualDefault : 12;
      const defaultSick = defaultLeave ? defaultLeave.sickDefault : 10;

      // Validate dateOfJoining and calculate prorated leaves
      let casualLeave = defaultCasual;
      let sickLeave = defaultSick;

      if (dateOfJoining) {
        const joinDate = new Date(dateOfJoining);
        if (!isNaN(joinDate.getTime())) {
          const joinMonth = joinDate.getMonth(); // 0-11
          const remainingMonths = 12 - joinMonth;
          casualLeave = Math.ceil(defaultCasual * remainingMonths / 12);
          sickLeave = Math.ceil(defaultSick * remainingMonths / 12);
        }
      }

      // Ensure we have valid numbers
      casualLeave = isNaN(casualLeave) ? defaultCasual : Math.max(0, casualLeave);
      sickLeave = isNaN(sickLeave) ? defaultSick : Math.max(0, sickLeave);

      leave = new Leave({
        employee: user._id,
        leaveType: 'Initial Allocation',
        numberOfDays: 0,
        status: 'approved',
        casualLeave,
        sickLeave,
        earnedLeave: 0
      });
      await leave.save();

      res.status(201).json({ message: 'Employee created successfully', data: employee });

    } catch (error) {
      console.error("Create Failed:", error);
      // ROLLBACK: Delete partially created data to prevent "Email exists" errors next time
      if(user) await User.deleteOne({ _id: user._id });
      if(employee) await Employee.deleteOne({ _id: employee._id });
      if(leave) await Leave.deleteOne({ _id: leave._id });
      
      res.status(500).json({ message: error.message });
    }
  });

  // ... (Keep updateEmployee, deleteEmployee, getEmployeePayrolls as they were) ...
  updateEmployee = async (req, res) => {
    try {
        const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if(employee) await User.findOneAndUpdate({ email: employee.email }, req.body);
        if (!employee) return res.status(404).json({ message: 'Employee not found' });
        res.json({ message: 'Updated', employee });
    } catch (err) { res.status(500).json({ message: err.message }); }
  };

  deleteEmployee = async (req, res) => {
    try {
        const emp = await Employee.findById(req.params.id);
        if (!emp) return res.status(404).json({ message: 'Not found' });
        await User.findOneAndDelete({ email: emp.email });
        await Employee.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) { res.status(500).json({ message: err.message }); }
  };

  getEmployeePayrolls = catchAsync(async (req, res) => {
    try {
        const employeesWithPayroll = await User.aggregate([
            { $match: { role: "employee" } },
            // ... (rest of your existing aggregation logic)
        ]);
        res.status(200).json({ success: true, data: employeesWithPayroll });
    } catch(err) { throw new ApiError(500, "Server Error"); }
  });
}

module.exports = new EmployeeController();