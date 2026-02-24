const User = require('../models/User');
const Employee = require('../models/Employee');
const Leave = require('../models/Leave');
const Defaults = require('../models/LeaveDefaults');
const Documents = require('../models/Documents');
const Payroll = require('../models/Payroll');
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
      let employee = await Employee.findById(req.params.id).select('-password');
      if (!employee) {
        employee = await User.findById(req.params.id).select('-password');
      }
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      res.json(employee);
    } catch (error) {
      throw new ApiError(500, error.message);
    }
  });

  // --- CREATE EMPLOYEE ---
  createEmployee = catchAsync(async (req, res) => {
    let user = null;
    let employee = null;
    let leave = null;
    let payroll = null;

    try {
      const {
        firstName, lastName, email, password, department, designation,
        dateOfJoining, baseSalary, employeeId, contact, address, status,
        workMode,
        bankName, bankAccountNumber, ifscCode,
        emergencyContactName, emergencyContactPhone, emergencyContactRelation
      } = req.body;

      // 1. Check Duplicates in USER
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ message: 'Email already exists in System' });

      // 2. Helper for File Paths
      const getFilePath = (fieldName) => {
        return req.files && req.files[fieldName]
          ? req.files[fieldName][0].path.replace('uploads\\', '').replace('uploads/', '')
          : null;
      };

      // 3. Create USER (Auth)
      user = new User({
        employeeId,
        firstName, lastName, email, password, role: 'employee',
        department, designation, dateOfJoining, baseSalary, isActive: true
      });
      await user.save();

      // 4. Create EMPLOYEE (Details & Docs)
      employee = new Employee({
        _id: user._id,
        employeeId, firstName, lastName, email, password,
        contact, address, department, designation, dateOfJoining, baseSalary,
        status: status || 'Full Time',
        workMode: workMode || 'Work From Office',
        // Bank Details
        bankName: bankName || '',
        bankAccountNumber: bankAccountNumber || '',
        ifscCode: ifscCode || '',
        // Emergency Contact
        emergencyContactName: emergencyContactName || '',
        emergencyContactPhone: emergencyContactPhone || '',
        emergencyContactRelation: emergencyContactRelation || '',
        // Files
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

      // 5. Save Documents to Documents table
      const documentTypes = ['profilePhoto', 'adharCard', 'panCard', 'salarySlip', 'relievingLetter', 'experienceLetter', 'offerLetter'];
      for (const docType of documentTypes) {
        if (req.files && req.files[docType]) {
          const file = req.files[docType][0];
          const document = new Documents({
            employee: employee._id,
            documentType: docType,
            filePath: getFilePath(docType),
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size
          });
          await document.save();
        }
      }

      // 6. Create Leave Balance
      const defaultLeave = await Defaults.findOne({});
      const defaultCasual = defaultLeave ? defaultLeave.casualDefault : 12;
      const defaultSick = defaultLeave ? defaultLeave.sickDefault : 10;

      let casualLeave = defaultCasual;
      let sickLeave = defaultSick;

      if (dateOfJoining) {
        const joinDate = new Date(dateOfJoining);
        if (!isNaN(joinDate.getTime())) {
          const joinMonth = joinDate.getMonth();
          const remainingMonths = 12 - joinMonth;
          casualLeave = Math.ceil(defaultCasual * remainingMonths / 12);
          sickLeave = Math.ceil(defaultSick * remainingMonths / 12);
        }
      }

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

      // 7. Create Payroll record for the new employee
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      payroll = new Payroll({
        employee: user._id,
        month: currentMonth,
        year: currentYear,
        baseSalary: baseSalary || 0,
        workedDays: 0,
        deductions: 0,
        workingDays: 24, // Default working days
        netSalary: baseSalary || 0,
        status: 'draft'
      });
      await payroll.save();

      res.status(201).json({ message: 'Employee created successfully', data: employee });

    } catch (error) {
      console.error("Create Failed:", error);
      // Rollback: Delete partially created data
      if (user) await User.deleteOne({ _id: user._id });
      if (employee) await Employee.deleteOne({ _id: employee._id });
      if (leave) await Leave.deleteOne({ _id: leave._id });
      if (payroll) await Payroll.deleteOne({ _id: payroll._id });
      if (employee) await Documents.deleteMany({ employee: employee._id });
      res.status(500).json({ message: error.message });
    }
  });

  // --- UPDATE EMPLOYEE ---
  updateEmployee = async (req, res) => {
    try {
      const existingEmployee = await Employee.findById(req.params.id);
      if (!existingEmployee) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      // Check for duplicate email in Employee
      if (req.body.email && req.body.email !== existingEmployee.email) {
        const existingEmail = await Employee.findOne({ email: req.body.email });
        if (existingEmail) {
          return res.status(400).json({ message: 'Email already exists' });
        }
      }

      // Check for duplicate employeeId
      if (req.body.employeeId && req.body.employeeId !== existingEmployee.employeeId) {
        const existingEmpId = await Employee.findOne({ employeeId: req.body.employeeId });
        if (existingEmpId) {
          return res.status(400).json({ message: 'Employee ID already exists' });
        }
      }

      // Check for duplicate email in User
      if (req.body.email && req.body.email !== existingEmployee.email) {
        const existingUserEmail = await User.findOne({ email: req.body.email });
        if (existingUserEmail) {
          return res.status(400).json({ message: 'Email already exists in system' });
        }
      }

      // Helper for File Paths
      const getFilePath = (fieldName) => {
        return req.files && req.files[fieldName]
          ? req.files[fieldName][0].path.replace('uploads\\', '').replace('uploads/', '')
          : null;
      };

      const updateData = {
        employeeId: req.body.employeeId || existingEmployee.employeeId,
        firstName: req.body.firstName || existingEmployee.firstName,
        lastName: req.body.lastName || existingEmployee.lastName,
        email: req.body.email || existingEmployee.email,
        contact: req.body.contact || existingEmployee.contact,
        address: req.body.address !== undefined ? req.body.address : existingEmployee.address,
        department: req.body.department || existingEmployee.department,
        designation: req.body.designation || existingEmployee.designation,
        dateOfJoining: req.body.dateOfJoining || existingEmployee.dateOfJoining,
        baseSalary: req.body.baseSalary ? parseFloat(req.body.baseSalary) : existingEmployee.baseSalary,
        status: req.body.status || existingEmployee.status,
        isActive: req.body.isActive !== undefined
          ? (req.body.isActive === 'true' || req.body.isActive === true)
          : existingEmployee.isActive,

        // Work Mode
        workMode: req.body.workMode || existingEmployee.workMode || 'Work From Office',

        // Bank Details
        bankName: req.body.bankName !== undefined ? req.body.bankName : existingEmployee.bankName,
        bankAccountNumber: req.body.bankAccountNumber !== undefined ? req.body.bankAccountNumber : existingEmployee.bankAccountNumber,
        ifscCode: req.body.ifscCode !== undefined ? req.body.ifscCode : existingEmployee.ifscCode,

        // Emergency Contact
        emergencyContactName: req.body.emergencyContactName !== undefined ? req.body.emergencyContactName : existingEmployee.emergencyContactName,
        emergencyContactPhone: req.body.emergencyContactPhone !== undefined ? req.body.emergencyContactPhone : existingEmployee.emergencyContactPhone,
        emergencyContactRelation: req.body.emergencyContactRelation !== undefined ? req.body.emergencyContactRelation : existingEmployee.emergencyContactRelation,

        // Files
        profilePhoto: getFilePath('profilePhoto') || existingEmployee.profilePhoto,
        documents: {
          adharCard: getFilePath('adharCard') || existingEmployee.documents?.adharCard,
          panCard: getFilePath('panCard') || existingEmployee.documents?.panCard,
          salarySlip: getFilePath('salarySlip') || existingEmployee.documents?.salarySlip,
          relievingLetter: getFilePath('relievingLetter') || existingEmployee.documents?.relievingLetter,
          experienceLetter: getFilePath('experienceLetter') || existingEmployee.documents?.experienceLetter,
          offerLetter: getFilePath('offerLetter') || existingEmployee.documents?.offerLetter
        }
      };

      const employee = await Employee.findByIdAndUpdate(req.params.id, updateData, { new: true });

      // Save new documents to Documents table if uploaded
      const documentTypes = ['profilePhoto', 'adharCard', 'panCard', 'salarySlip', 'relievingLetter', 'experienceLetter', 'offerLetter'];
      for (const docType of documentTypes) {
        if (req.files && req.files[docType]) {
          const file = req.files[docType][0];
          const document = new Documents({
            employee: req.params.id,
            documentType: docType,
            filePath: getFilePath(docType),
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size
          });
          await document.save();
        }
      }

      // Also update User table
      await User.findByIdAndUpdate(req.params.id, {
        email: req.body.email || existingEmployee.email,
        firstName: req.body.firstName || existingEmployee.firstName,
        lastName: req.body.lastName || existingEmployee.lastName,
        department: req.body.department || existingEmployee.department,
        designation: req.body.designation || existingEmployee.designation,
        dateOfJoining: req.body.dateOfJoining || existingEmployee.dateOfJoining,
        baseSalary: req.body.baseSalary ? parseFloat(req.body.baseSalary) : existingEmployee.baseSalary
      });

      // Update User password if provided
      if (req.body.password) {
        const user = await User.findById(req.params.id);
        if (user) {
          user.password = req.body.password;
          await user.save();
        }
      }

      res.json({ message: 'Updated successfully', employee });
    } catch (err) {
      console.error('Update error:', err);
      res.status(500).json({ message: err.message });
    }
  };

  deleteEmployee = async (req, res) => {
    try {
      const emp = await Employee.findById(req.params.id);
      if (!emp) return res.status(404).json({ message: 'Not found' });
      await User.findOneAndDelete({ email: emp.email });
      await Employee.findByIdAndDelete(req.params.id);
      await Documents.deleteMany({ employee: req.params.id });
      await Payroll.deleteMany({ employee: req.params.id });
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };

  getEmployeePayrolls = catchAsync(async (req, res) => {
    try {
      const employeesWithPayroll = await User.aggregate([
        { $match: { role: "employee" } },
      ]);
      res.status(200).json({ success: true, data: employeesWithPayroll });
    } catch (err) {
      throw new ApiError(500, "Server Error");
    }
  });
}

module.exports = new EmployeeController();
