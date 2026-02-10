const User = require('../models/User');
const Employee = require('../models/Employee');
const Leave = require('../models/Leave');
const Defaults = require('../models/LeaveDefaults');
const Documents = require('../models/Documents');
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
        return req.files && req.files[fieldName] ? req.files[fieldName][0].path.replace('uploads\\', '').replace('uploads/', '') : null;
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
      // Also delete any documents that were created
      if(employee) await Documents.deleteMany({ employee: employee._id });

      res.status(500).json({ message: error.message });
    }
  });

  // ... (Keep updateEmployee, deleteEmployee, getEmployeePayrolls as they were) ...
  updateEmployee = async (req, res) => {
    try {
        // Get existing employee data
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

        // Check for duplicate employeeId in Employee
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
            return req.files && req.files[fieldName] ? req.files[fieldName][0].path.replace('uploads\\', '').replace('uploads/', '') : null;
        };

        // Prepare update data
        const updateData = {
            employeeId: req.body.employeeId || existingEmployee.employeeId,
            firstName: req.body.firstName || existingEmployee.firstName,
            lastName: req.body.lastName || existingEmployee.lastName,
            email: req.body.email || existingEmployee.email,
            contact: req.body.contact || existingEmployee.contact,
            address: req.body.address || existingEmployee.address,
            department: req.body.department || existingEmployee.department,
            designation: req.body.designation || existingEmployee.designation,
            dateOfJoining: req.body.dateOfJoining || existingEmployee.dateOfJoining,
            baseSalary: req.body.baseSalary ? parseFloat(req.body.baseSalary) : existingEmployee.baseSalary,
            status: req.body.status || existingEmployee.status,
            isActive: req.body.isActive !== undefined ? (req.body.isActive === 'true' || req.body.isActive === true) : existingEmployee.isActive,
            // Update file paths only if new files are uploaded
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

        // Update employee
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

        // Also update User table if email changed
        if (req.body.email && req.body.email !== existingEmployee.email) {
            await User.findByIdAndUpdate(req.params.id, {
                email: req.body.email,
                firstName: req.body.firstName || existingEmployee.firstName,
                lastName: req.body.lastName || existingEmployee.lastName,
                department: req.body.department || existingEmployee.department,
                designation: req.body.designation || existingEmployee.designation,
                dateOfJoining: req.body.dateOfJoining || existingEmployee.dateOfJoining,
                baseSalary: req.body.baseSalary ? parseFloat(req.body.baseSalary) : existingEmployee.baseSalary
            });
        }

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
  }

  deleteEmployee = async (req, res) => {
    try {
        const emp = await Employee.findById(req.params.id);
        if (!emp) return res.status(404).json({ message: 'Not found' });
        await User.findOneAndDelete({ email: emp.email });
        await Employee.findByIdAndDelete(req.params.id);
        // Also delete all documents for this employee
        await Documents.deleteMany({ employee: req.params.id });
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