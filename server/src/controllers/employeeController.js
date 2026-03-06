const User = require('../models/User');
const Employee = require('../models/Employee');
const Leave = require('../models/Leave');
const Defaults = require('../models/LeaveDefaults');
const Documents = require('../models/Documents');
const Payroll = require('../models/Payroll');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const xlsx = require('xlsx');

// Helper: safely parse a date string — returns null if invalid/empty
const safeDate = (val) => {
  if (!val || val === '') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

// Helper: return value or fallback
const safe = (val, fallback = '') =>
  (val !== undefined && val !== null && val !== '') ? val : fallback;

// Helper: normalize gender to lowercase for User model enum
const normalizeGender = (val) => {
  if (!val || val === '') return undefined; // don't set if empty — avoids enum error
  const lower = val.toLowerCase();
  if (['male', 'female', 'other'].includes(lower)) return lower;
  return undefined;
};

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
      if (!employee) employee = await User.findById(req.params.id).select('-password');
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      res.json(employee);
    } catch (error) {
      throw new ApiError(500, error.message);
    }
  });

  // ─── CREATE EMPLOYEE ───────────────────────────────────────────────────────
  createEmployee = catchAsync(async (req, res) => {
    let user = null;
    let employee = null;
    let leave = null;
    let payroll = null;

    try {
      const b = req.body;

      // Check duplicate email
      const existingUser = await User.findOne({ email: b.email });
      if (existingUser) return res.status(400).json({ message: 'Email already exists in System' });

      // Check duplicate employeeId
      const existingEmpId = await Employee.findOne({ employeeId: b.employeeId });
      if (existingEmpId) return res.status(400).json({ message: 'Employee ID already exists' });

      // File path helper
      const fp = (fieldName) =>
        req.files && req.files[fieldName]
          ? req.files[fieldName][0].path.replace('uploads\\', '').replace('uploads/', '')
          : null;

      // ── Build User object (must match User.js schema strictly) ──
      const userPayload = {
        employeeId: b.employeeId,
        firstName: b.firstName,
        lastName: b.lastName,
        email: b.email,
        password: b.password,
        role: 'employee',
        department: safe(b.department) || undefined,
        designation: safe(b.designation) || undefined,
        dateOfJoining: safeDate(b.dateOfJoining),
        dateOfBirth: safeDate(b.dateOfBirth),
        baseSalary: b.baseSalary ? parseFloat(b.baseSalary) : 0,
        isActive: true,
      };

      // Only set gender on User if it's a valid enum value
      const userGender = normalizeGender(b.gender);
      if (userGender) userPayload.gender = userGender;

      user = new User(userPayload);
      await user.save();

      // ── Build Employee object (uses Employee.js schema — no strict gender enum) ──
      employee = new Employee({
        _id: user._id,         // same _id as User
        employeeId: b.employeeId,
        firstName: b.firstName,
        lastName: b.lastName,
        email: b.email,
        personalEmail: safe(b.personalEmail),
        password: b.password,       // Employee pre-save hook hashes this independently
        contact: b.contact,
        address: safe(b.address),
        currentAddress: safe(b.currentAddress),
        department: safe(b.department),
        designation: safe(b.designation),
        dateOfJoining: safeDate(b.dateOfJoining),
        dateOfBirth: safeDate(b.dateOfBirth),
        lastWorkingDay: safeDate(b.lastWorkingDay),
        baseSalary: b.baseSalary ? parseFloat(b.baseSalary) : 0,
        status: b.status || 'Full Time',
        periodType: b.periodType || 'Permanent',
        workMode: b.workMode || 'Work From Office',
        gender: safe(b.gender),
        maritalStatus: safe(b.maritalStatus),
        nationality: safe(b.nationality),
        panNumber: safe(b.panNumber),
        aadharNumber: safe(b.aadharNumber),
        bankName: safe(b.bankName),
        bankAccountNumber: safe(b.bankAccountNumber),
        ifscCode: safe(b.ifscCode),
        emergencyContactName: safe(b.emergencyContactName),
        emergencyContactPhone: safe(b.emergencyContactPhone),
        emergencyContactRelation: safe(b.emergencyContactRelation),
        profilePhoto: fp('profilePhoto'),
        documents: {
          adharCard: fp('adharCard'),
          panCard: fp('panCard'),
          salarySlip: fp('salarySlip'),
          relievingLetter: fp('relievingLetter'),
          experienceLetter: fp('experienceLetter'),
          offerLetter: fp('offerLetter')
        }
      });
      await employee.save();

      // ── Save Documents to Documents table ──
      const docTypes = ['profilePhoto', 'adharCard', 'panCard', 'salarySlip', 'relievingLetter', 'experienceLetter', 'offerLetter'];
      for (const docType of docTypes) {
        if (req.files && req.files[docType]) {
          const file = req.files[docType][0];
          await new Documents({
            employee: employee._id,
            documentType: docType,
            filePath: fp(docType),
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size
          }).save();
        }
      }

      // ── Create Leave Balance ──
      const defaultLeave = await Defaults.findOne({});
      const defaultCasual = defaultLeave ? defaultLeave.casualDefault : 12;
      const defaultSick = defaultLeave ? defaultLeave.sickDefault : 10;

      let casualLeave = defaultCasual;
      let sickLeave = defaultSick;

      const joinDate = safeDate(b.dateOfJoining);
      if (joinDate) {
        const remainingMonths = 12 - joinDate.getMonth();
        casualLeave = Math.max(0, Math.ceil(defaultCasual * remainingMonths / 12));
        sickLeave = Math.max(0, Math.ceil(defaultSick * remainingMonths / 12));
      }

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

      // ── Create Payroll record ──
      const now = new Date();
      payroll = new Payroll({
        employee: user._id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        baseSalary: b.baseSalary ? parseFloat(b.baseSalary) : 0,
        workedDays: 0,
        deductions: 0,
        workingDays: 24,
        netSalary: b.baseSalary ? parseFloat(b.baseSalary) : 0,
        status: 'draft'
      });
      await payroll.save();

      res.status(201).json({ message: 'Employee created successfully', data: employee });

    } catch (error) {
      console.error('Create Employee Failed:', error);
      // Rollback everything
      if (user) await User.deleteOne({ _id: user._id }).catch(() => { });
      if (employee) await Employee.deleteOne({ _id: employee._id }).catch(() => { });
      if (leave) await Leave.deleteOne({ _id: leave._id }).catch(() => { });
      if (payroll) await Payroll.deleteOne({ _id: payroll._id }).catch(() => { });
      if (employee) await Documents.deleteMany({ employee: employee._id }).catch(() => { });
      res.status(500).json({ message: error.message });
    }
  });

  // ─── BULK IMPORT EMPLOYEES FROM EXCEL ─────────────────────────────────────
  bulkImportEmployees = catchAsync(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No Excel file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty or has no data rows' });
    }

    const results = { success: [], failed: [] };

    const parseExcelDate = (val) => {
      if (!val || val === '') return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      if (typeof val === 'number') {
        try {
          const parsed = xlsx.SSF.parse_date_code(val);
          if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
        } catch { return null; }
      }
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    const defaultLeave = await Defaults.findOne({});
    const defaultCasual = defaultLeave ? defaultLeave.casualDefault : 12;
    const defaultSick = defaultLeave ? defaultLeave.sickDefault : 10;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Skip empty rows
      const vals = Object.values(row).filter(v => v !== '' && v !== null && v !== undefined);
      if (vals.length === 0) continue;

      let user = null, employee = null, leave = null, payroll = null;

      try {
        const employeeId = String(safe(row['Employee ID'])).trim();
        const fullName = String(safe(row['Name'])).trim();
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || ' ';
        const email = String(safe(row['Email'] )).trim().toLowerCase();
        const personalEmail = String(safe(row['Personal Email'|| row['Office mail id '] || row['Office mail id']])).trim().toLowerCase();
        const contact = String(safe(row['Contact Number'])).trim();
        const department = String(safe(row['Department'])).trim();
        const designation = String(safe(row['Designation'])).trim();
        const baseSalary = parseFloat(row['Salary']) || 0;
        const gender = String(safe(row['Gender'])).trim();

        const rawStatus = String(safe(row['Employee Type'])).trim().toLowerCase();
        let empStatus = 'Full Time';
        if (rawStatus.includes('intern')) empStatus = 'Internship';

        const rawPeriodType = String(safe(row['Employee period type'] || row['Period Type'])).trim().toLowerCase();
        let empPeriodType = 'Permanent';
        if (rawPeriodType.includes('probation')) empPeriodType = 'Probation';
        else if (rawPeriodType.includes('contract')) empPeriodType = 'Contractual';

        const panNumber = String(safe(row['PAN Number'])).trim();
        const aadharNumber = String(safe(row['Aadhar Number'])).trim();
        const bankAccountNumber = String(safe(row['Bank Account No'])).trim();
        const ifscCode = String(safe(row['IFSC Code'])).trim();
        const bankName = String(safe(row['Bank Name'])).trim();
        const permanentAddress = String(safe(row['Permanent Address'])).trim();
        const currentAddress = String(safe(row['Current Address'])).trim();
        const maritalStatus = String(safe(row['Marital Status'])).trim();
        const emergencyContactName = String(safe(row['Emergency contact Name '] || row['Emergency contact Name'])).trim();
        const emergencyContactPhone = String(safe(row['Emeregncy Contact Number '] || row['Emergency Contact Number'])).trim();
        const nationality = String(safe(row['Nationality'])).trim();

        const dateOfJoining = parseExcelDate(row['DATE OF JOINING']);
        const dateOfBirth = parseExcelDate(row['Date of Birth']);
        const lastWorkingDay = parseExcelDate(row['Last Working Day']);

        if (!employeeId) { results.failed.push({ row: rowNum, name: fullName, reason: 'Employee ID is required' }); continue; }
        if (!email) { results.failed.push({ row: rowNum, name: fullName, reason: 'Email is required' }); continue; }
        if (!firstName) { results.failed.push({ row: rowNum, name: fullName, reason: 'Name is required' }); continue; }

        const existingUser = await User.findOne({ email });
        if (existingUser) { results.failed.push({ row: rowNum, name: fullName, reason: `Email ${email} already exists` }); continue; }

        const existingEmp = await Employee.findOne({ employeeId });
        if (existingEmp) { results.failed.push({ row: rowNum, name: fullName, reason: `Employee ID ${employeeId} already exists` }); continue; }

        const defaultPassword = `${employeeId}@123`;

        const userPayload = {
          employeeId, firstName, lastName, email,
          password: defaultPassword,
          role: 'employee',
          department, designation,
          dateOfJoining,
          dateOfBirth,
          baseSalary,
          isActive: true
        };
        const userGender = normalizeGender(gender);
        if (userGender) userPayload.gender = userGender;

        user = new User(userPayload);
        await user.save();

        employee = new Employee({
          _id: user._id,
          employeeId, firstName, lastName, email,personalEmail,
          password: defaultPassword,
          contact,
          address: permanentAddress,
          currentAddress,
          department, designation,
          dateOfJoining, dateOfBirth, lastWorkingDay,
          baseSalary,
          status: empStatus,
          periodType: empPeriodType,
          workMode: 'Work From Office',
          gender, maritalStatus, nationality,
          panNumber, aadharNumber,
          bankName, bankAccountNumber, ifscCode,
          emergencyContactName, emergencyContactPhone,
          emergencyContactRelation: ''
        });
        await employee.save();

        let casualLeave = defaultCasual;
        let sickLeave = defaultSick;
        if (dateOfJoining) {
          const remainingMonths = 12 - dateOfJoining.getMonth();
          casualLeave = Math.max(0, Math.ceil(defaultCasual * remainingMonths / 12));
          sickLeave = Math.max(0, Math.ceil(defaultSick * remainingMonths / 12));
        }

        leave = new Leave({
          employee: user._id,
          leaveType: 'Initial Allocation',
          numberOfDays: 0,
          status: 'approved',
          casualLeave, sickLeave, earnedLeave: 0
        });
        await leave.save();

        const now = new Date();
        payroll = new Payroll({
          employee: user._id,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          baseSalary, workedDays: 0, deductions: 0,
          workingDays: 24, netSalary: baseSalary, status: 'draft'
        });
        await payroll.save();

        results.success.push({ row: rowNum, name: fullName, employeeId, email });

      } catch (error) {
        console.error(`Bulk import row ${rowNum} error:`, error.message);
        if (user) await User.deleteOne({ _id: user._id }).catch(() => { });
        if (employee) await Employee.deleteOne({ _id: employee._id }).catch(() => { });
        if (leave) await Leave.deleteOne({ _id: leave._id }).catch(() => { });
        if (payroll) await Payroll.deleteOne({ _id: payroll._id }).catch(() => { });
        results.failed.push({ row: rowNum, name: String(row['Name'] || ''), reason: error.message });
      }
    }

    res.status(200).json({
      message: `Bulk import completed. ${results.success.length} added, ${results.failed.length} failed.`,
      success: results.success,
      failed: results.failed,
      totalProcessed: results.success.length + results.failed.length
    });
  });

  // ─── UPDATE EMPLOYEE ───────────────────────────────────────────────────────
  updateEmployee = async (req, res) => {
    try {
      const existingEmployee = await Employee.findById(req.params.id);
      if (!existingEmployee) return res.status(404).json({ message: 'Employee not found' });

      const b = req.body;
      const e = existingEmployee;

      if (b.email && b.email !== e.email) {
        if (await Employee.findOne({ email: b.email })) return res.status(400).json({ message: 'Email already exists' });
        if (await User.findOne({ email: b.email })) return res.status(400).json({ message: 'Email already exists in system' });
      }

      if (b.employeeId && b.employeeId !== e.employeeId) {
        if (await Employee.findOne({ employeeId: b.employeeId })) return res.status(400).json({ message: 'Employee ID already exists' });
      }

      const fp = (fieldName) =>
        req.files && req.files[fieldName]
          ? req.files[fieldName][0].path.replace('uploads\\', '').replace('uploads/', '')
          : null;

      const updateData = {
        employeeId: b.employeeId || e.employeeId,
        firstName: b.firstName || e.firstName,
        lastName: b.lastName || e.lastName,
        email: b.email || e.email,
        personalEmail: b.personalEmail !== undefined ? b.personalEmail : e.personalEmail,
        contact: b.contact || e.contact,
        address: b.address !== undefined ? b.address : e.address,
        currentAddress: b.currentAddress !== undefined ? b.currentAddress : e.currentAddress,
        department: b.department || e.department,
        designation: b.designation || e.designation,
        dateOfJoining: safeDate(b.dateOfJoining) || e.dateOfJoining,
        dateOfBirth: safeDate(b.dateOfBirth) || e.dateOfBirth,
        lastWorkingDay: b.lastWorkingDay !== undefined ? safeDate(b.lastWorkingDay) : e.lastWorkingDay,
        baseSalary: b.baseSalary ? parseFloat(b.baseSalary) : e.baseSalary,
        status: b.status || e.status,
        periodType: b.periodType !== undefined ? b.periodType : e.periodType,
        isActive: b.isActive !== undefined
          ? (b.isActive === 'true' || b.isActive === true)
          : e.isActive,
        workMode: b.workMode || e.workMode || 'Work From Office',
        gender: b.gender !== undefined ? b.gender : e.gender,
        maritalStatus: b.maritalStatus !== undefined ? b.maritalStatus : e.maritalStatus,
        nationality: b.nationality !== undefined ? b.nationality : e.nationality,
        panNumber: b.panNumber !== undefined ? b.panNumber : e.panNumber,
        aadharNumber: b.aadharNumber !== undefined ? b.aadharNumber : e.aadharNumber,
        bankName: b.bankName !== undefined ? b.bankName : e.bankName,
        bankAccountNumber: b.bankAccountNumber !== undefined ? b.bankAccountNumber : e.bankAccountNumber,
        ifscCode: b.ifscCode !== undefined ? b.ifscCode : e.ifscCode,
        emergencyContactName: b.emergencyContactName !== undefined ? b.emergencyContactName : e.emergencyContactName,
        emergencyContactPhone: b.emergencyContactPhone !== undefined ? b.emergencyContactPhone : e.emergencyContactPhone,
        emergencyContactRelation: b.emergencyContactRelation !== undefined ? b.emergencyContactRelation : e.emergencyContactRelation,
        profilePhoto: fp('profilePhoto') || e.profilePhoto,
        documents: {
          adharCard: fp('adharCard') || e.documents?.adharCard,
          panCard: fp('panCard') || e.documents?.panCard,
          salarySlip: fp('salarySlip') || e.documents?.salarySlip,
          relievingLetter: fp('relievingLetter') || e.documents?.relievingLetter,
          experienceLetter: fp('experienceLetter') || e.documents?.experienceLetter,
          offerLetter: fp('offerLetter') || e.documents?.offerLetter
        }
      };

      const employee = await Employee.findByIdAndUpdate(req.params.id, updateData, { new: true });

      // Save new docs
      const docTypes = ['profilePhoto', 'adharCard', 'panCard', 'salarySlip', 'relievingLetter', 'experienceLetter', 'offerLetter'];
      for (const docType of docTypes) {
        if (req.files && req.files[docType]) {
          const file = req.files[docType][0];
          await new Documents({
            employee: req.params.id,
            documentType: docType,
            filePath: fp(docType),
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size
          }).save();
        }
      }

      // Sync User table — only fields User model has
      const userUpdate = {
        email: b.email || e.email,
        firstName: b.firstName || e.firstName,
        lastName: b.lastName || e.lastName,
        department: b.department || e.department,
        designation: b.designation || e.designation,
        dateOfJoining: safeDate(b.dateOfJoining) || e.dateOfJoining,
        baseSalary: b.baseSalary ? parseFloat(b.baseSalary) : e.baseSalary,
        dateOfBirth: safeDate(b.dateOfBirth) || e.dateOfBirth,
      };
      const updatedGender = normalizeGender(b.gender);
      if (updatedGender) userUpdate.gender = updatedGender;

      await User.findByIdAndUpdate(req.params.id, userUpdate);

      if (b.password) {
        const userDoc = await User.findById(req.params.id);
        if (userDoc) { userDoc.password = b.password; await userDoc.save(); }
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
        { $match: { role: 'employee' } }
      ]);
      res.status(200).json({ success: true, data: employeesWithPayroll });
    } catch (err) {
      throw new ApiError(500, 'Server Error');
    }
  });
}

module.exports = new EmployeeController();