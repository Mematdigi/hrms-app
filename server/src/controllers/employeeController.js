const User = require('../models/User');
const Employee = require('../models/Employee');
const Leave = require('../models/Leave');
const Defaults = require('../models/LeaveDefaults');
const Documents = require('../models/Documents');
const Payroll = require('../models/Payroll');
const PreviousEmployment = require('../models/PreviousEmployment');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { encryptEmployee, decryptEmployee } = require('../utils/encryption');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// ── Store uploaded excel files reference in memory (or use DB if needed)
const UPLOADED_EXCEL_DIR = path.join(__dirname, '../../uploads/bulk-excels/');

// Helper: safely parse a date string — returns null if invalid/empty
const safeDate = (val) => {
  if (!val || val === '') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

// Helper: return value or fallback
const safe = (val, fallback = '') =>
  (val !== undefined && val !== null && val !== '') ? val : fallback;

// Helper: parse excel date values
const parseExcelDate = (value) => {
    if (!value && value !== 0) return null;

    // ── Already a JS Date (from cellDates: true) ──
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }

    const str = String(value).trim();
    if (!str || str === '' || str === 'undefined' || str === 'null') return null;

    // ── Excel serial number ──
    if (/^\d{4,5}$/.test(str)) {
        const serial = parseInt(str);
        const date = new Date((serial - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? null : date;
    }

    // ── Month name map (handles typos like "Janurary", "Febuary", etc.) ──
    const monthMap = {
        'january': 0,  'janurary': 0, 'jan': 0,
        'february': 1, 'febuary': 1,  'feb': 1,
        'march': 2,    'mar': 2,
        'april': 3,    'apr': 3,
        'may': 4,
        'june': 5,     'jun': 5,
        'july': 6,     'jul': 6,
        'august': 7,   'aug': 7,
        'september': 8,'sep': 8, 'sept': 8,
        'october': 9,  'oct': 9,
        'november': 10,'nov': 10,
        'december': 11,'dec': 11,
    };

    // ── Remove ordinal suffixes: 1st, 2nd, 3rd, 23rd, 4th etc. ──
    const cleanStr = str.replace(/(\d+)(st|nd|rd|th)/gi, '$1').trim();

    // ── Format: "1 January 2026" or "January 1 2026" or "1st January 2026" ──
    const wordDateMatch = cleanStr.match(
        /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$|^([a-zA-Z]+)\s+(\d{1,2})\s+(\d{4})$/
    );
    if (wordDateMatch) {
        let day, monthStr, year;
        if (wordDateMatch[1]) {
            day      = parseInt(wordDateMatch[1]);
            monthStr = wordDateMatch[2].toLowerCase();
            year     = parseInt(wordDateMatch[3]);
        } else {
            monthStr = wordDateMatch[4].toLowerCase();
            day      = parseInt(wordDateMatch[5]);
            year     = parseInt(wordDateMatch[6]);
        }
        const month = monthMap[monthStr];
        if (month !== undefined && day >= 1 && day <= 31 && year >= 1900) {
            const date = new Date(year, month, day);
            return isNaN(date.getTime()) ? null : date;
        }
    }

    // ── Format: "January 2026" (no day — default to 1st) ──
    const monthYearMatch = cleanStr.match(/^([a-zA-Z]+)\s+(\d{4})$/);
    if (monthYearMatch) {
        const monthStr = monthYearMatch[1].toLowerCase();
        const year     = parseInt(monthYearMatch[2]);
        const month    = monthMap[monthStr];
        if (month !== undefined && year >= 1900) {
            return new Date(year, month, 1);
        }
    }

    // ── Format: DD/MM/YYYY or D/M/YYYY ──
    const dmySlash = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmySlash) {
        const date = new Date(
            parseInt(dmySlash[3]),
            parseInt(dmySlash[2]) - 1,
            parseInt(dmySlash[1])
        );
        return isNaN(date.getTime()) ? null : date;
    }

    // ── Format: DD-MM-YYYY or D-M-YYYY ──
    const dmyDash = cleanStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmyDash) {
        const date = new Date(
            parseInt(dmyDash[3]),
            parseInt(dmyDash[2]) - 1,
            parseInt(dmyDash[1])
        );
        return isNaN(date.getTime()) ? null : date;
    }

    // ── Format: YYYY-MM-DD (ISO) ──
    const iso = cleanStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
        const date = new Date(
            parseInt(iso[1]),
            parseInt(iso[2]) - 1,
            parseInt(iso[3])
        );
        return isNaN(date.getTime()) ? null : date;
    }

    // ── Format: MM/DD/YYYY (US format) ──
    const mdySlash = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdySlash) {
        const date = new Date(
            parseInt(mdySlash[3]),
            parseInt(mdySlash[1]) - 1,
            parseInt(mdySlash[2])
        );
        return isNaN(date.getTime()) ? null : date;
    }

    // ── Format: DD.MM.YYYY ──
    const dmyDot = cleanStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dmyDot) {
        const date = new Date(
            parseInt(dmyDot[3]),
            parseInt(dmyDot[2]) - 1,
            parseInt(dmyDot[1])
        );
        return isNaN(date.getTime()) ? null : date;
    }

    // ── Fallback: let JS try to parse it ──
    const fallback = new Date(cleanStr);
    return isNaN(fallback.getTime()) ? null : fallback;
};

class EmployeeController {

  // ─── GET ALL EMPLOYEES ─────────────────────────────────────────────────────
  getAllEmployees = async (req, res) => {
    try {
      const employees = await Employee.find().select('-password').lean();
      const decrypted = employees.map(decryptEmployee);
      res.json(decrypted);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  // ─── GET EMPLOYEE BY ID ────────────────────────────────────────────────────
  getEmployeeById = catchAsync(async (req, res) => {
    try {
      let employee = await Employee.findById(req.params.id).select('-password').lean();
      if (!employee) {
        const userDoc = await User.findById(req.params.id).select('-password').lean();
        if (!userDoc) return res.status(404).json({ message: 'Employee not found' });
        employee = userDoc;
      }

      const decrypted = decryptEmployee(employee);
      const previousEmployment = await PreviousEmployment.findOne({ employee: req.params.id }).lean();

      res.json({ ...decrypted, previousEmployment: previousEmployment || null });
    } catch (error) {
      throw new ApiError(500, error.message);
    }
  });

  // ─── CREATE EMPLOYEE ───────────────────────────────────────────────────────
  // User table stores ONLY: firstName, lastName, email, password, role, employeeId, isActive
  // Everything else goes to Employee table
  createEmployee = catchAsync(async (req, res) => {
    let user = null;
    let employee = null;
    let leave = null;
    let payroll = null;
    let prevEmp = null;

    try {
      const b = req.body;

      const existingUser = await User.findOne({ email: b.email });
      if (existingUser) return res.status(400).json({ message: 'Email already exists in System' });

      const existingEmpId = await Employee.findOne({ employeeId: b.employeeId });
      if (existingEmpId) return res.status(400).json({ message: 'Employee ID already exists' });

      const fp = (fieldName) =>
        req.files && req.files[fieldName]
          ? req.files[fieldName][0].path.replace('uploads\\', '').replace('uploads/', '')
          : null;

      // ── Encrypt all sensitive fields ──
      const rawPayload = {
        contact:                  b.contact,
        address:                  safe(b.address),
        currentAddress:           safe(b.currentAddress),
        personalEmail:            safe(b.personalEmail),
        gender:                   safe(b.gender),
        maritalStatus:            safe(b.maritalStatus),
        nationality:              safe(b.nationality),
        panNumber:                safe(b.panNumber),
        aadharNumber:             safe(b.aadharNumber),
        bankName:                 safe(b.bankName),
        bankAccountNumber:        safe(b.bankAccountNumber),
        ifscCode:                 safe(b.ifscCode),
        emergencyContactName:     safe(b.emergencyContactName),
        emergencyContactPhone:    safe(b.emergencyContactPhone),
        emergencyContactRelation: safe(b.emergencyContactRelation),
        baseSalary:               b.baseSalary ? parseFloat(b.baseSalary) : 0,
      };

      const enc = encryptEmployee(rawPayload);

      // ── User model: ONLY these 7 fields ──
      user = new User({
        firstName:  b.firstName,
        lastName:   b.lastName,
        email:      b.email,
        password:   b.password,
        role:       'employee',
        employeeId: b.employeeId,
        isActive:   true,
      });
      await user.save();

      // ── Employee model: all details including encrypted sensitive fields ──
      employee = new Employee({
        _id:          user._id,
        employeeId:   b.employeeId,
        firstName:    b.firstName,
        lastName:     b.lastName,
        email:        b.email,
        password:     b.password,
        department:   safe(b.department),
        designation:  safe(b.designation),
        dateOfJoining:  safeDate(b.dateOfJoining),
        dateOfBirth:    safeDate(b.dateOfBirth),
        lastWorkingDay: safeDate(b.lastWorkingDay),
        baseSalary:   enc.baseSalary,
        status:       b.status     || 'Full Time',
        periodType:   b.periodType || 'Permanent',
        workMode:     b.workMode   || 'Work From Office',

        // ── ENCRYPTED SENSITIVE FIELDS ──
        personalEmail:            enc.personalEmail,
        contact:                  enc.contact,
        address:                  enc.address,
        currentAddress:           enc.currentAddress,
        gender:                   enc.gender,
        maritalStatus:            enc.maritalStatus,
        nationality:              enc.nationality,
        panNumber:                enc.panNumber,
        aadharNumber:             enc.aadharNumber,
        bankName:                 enc.bankName,
        bankAccountNumber:        enc.bankAccountNumber,
        ifscCode:                 enc.ifscCode,
        emergencyContactName:     enc.emergencyContactName,
        emergencyContactPhone:    enc.emergencyContactPhone,
        emergencyContactRelation: enc.emergencyContactRelation,

        profilePhoto: fp('profilePhoto'),
        documents: {
          adharCard:        fp('adharCard'),
          panCard:          fp('panCard'),
          salarySlip:       fp('salarySlip'),
          relievingLetter:  fp('relievingLetter'),
          experienceLetter: fp('experienceLetter'),
          offerLetter:      fp('offerLetter'),
        },
      });
      await employee.save();

      // ── Save Previous Employment if provided ──
      const pe = b.prevEmp
        ? (typeof b.prevEmp === 'string' ? JSON.parse(b.prevEmp) : b.prevEmp)
        : null;
      if (pe && (pe.employeeName || pe.department || pe.designation || pe.lastWorkingDay)) {
        prevEmp = new PreviousEmployment({
          employee:              employee._id,
          employeeName:          safe(pe.employeeName),
          department:            safe(pe.department),
          designation:           safe(pe.designation),
          joiningDate:           safeDate(pe.joiningDate),
          lastWorkingDay:        safeDate(pe.lastWorkingDay),
          exitType:              safe(pe.exitType),
          reasonForExit:         safe(pe.reasonForExit),
          managerName:           safe(pe.managerName),
          noticePeriodServed:    safe(pe.noticePeriodServed),
          finalSettlementDone:   safe(pe.finalSettlementDone),
          fnfDate:               safeDate(pe.fnfDate),
          exitInterviewDate:     safeDate(pe.exitInterviewDate),
          companyAssetsReturned: safe(pe.companyAssetsReturned),
          hrRepresentative:      safe(pe.hrRepresentative),
          remarks:               safe(pe.remarks),
        });
        await prevEmp.save();
      }

      // ── Save Documents ──
      const docTypes = [
        'profilePhoto', 'adharCard', 'panCard', 'salarySlip',
        'relievingLetter', 'experienceLetter', 'offerLetter',
      ];
      for (const docType of docTypes) {
        if (req.files && req.files[docType]) {
          const file = req.files[docType][0];
          await new Documents({
            employee:     employee._id,
            documentType: docType,
            filePath:     fp(docType),
            originalName: file.originalname,
            mimeType:     file.mimetype,
            size:         file.size,
          }).save();
        }
      }

      /* DISABLED: ── Create Leave Balance ──
      const defaultLeave  = await Defaults.findOne({});
      const defaultCasual = defaultLeave ? defaultLeave.casualDefault : 12;
      const defaultSick   = defaultLeave ? defaultLeave.sickDefault   : 10;

      let casualLeave = defaultCasual;
      let sickLeave   = defaultSick;

      const joinDate = safeDate(b.dateOfJoining);
      if (joinDate) {
        const remainingMonths = 12 - joinDate.getMonth();
        casualLeave = Math.max(0, Math.ceil(defaultCasual * remainingMonths / 12));
        sickLeave   = Math.max(0, Math.ceil(defaultSick   * remainingMonths / 12));
      }

      leave = new Leave({
        employee:     user._id,
        leaveType:    'Initial Allocation',
        numberOfDays: 0,
        status:       'approved',
        casualLeave,
        sickLeave,
        earnedLeave:  0,
      });
      await leave.save(); */

      /* DISABLED: ── Create Payroll record ──
      const now = new Date();
      payroll = new Payroll({
        employee:    user._id,
        month:       now.getMonth() + 1,
        year:        now.getFullYear(),
        baseSalary:  b.baseSalary ? parseFloat(b.baseSalary) : 0,
        workedDays:  0,
        deductions:  0,
        workingDays: 24,
        netSalary:   b.baseSalary ? parseFloat(b.baseSalary) : 0,
        status:      'draft',
      });
      await payroll.save(); */

      res.status(201).json({ message: 'Employee created successfully', data: employee });

    } catch (error) {
      console.error('Create Employee Failed:', error);
      // ── Rollback all created records on failure ──
      if (user)     await User.deleteOne({ _id: user._id }).catch(() => {});
      if (employee) await Employee.deleteOne({ _id: employee._id }).catch(() => {});
      if (leave)    await Leave.deleteOne({ _id: leave._id }).catch(() => {});
      if (payroll)  await Payroll.deleteOne({ _id: payroll._id }).catch(() => {});
      if (prevEmp)  await PreviousEmployment.deleteOne({ _id: prevEmp._id }).catch(() => {});
      if (employee) await Documents.deleteMany({ employee: employee._id }).catch(() => {});
      res.status(500).json({ message: error.message });
    }
  });

  // ─── BULK IMPORT EMPLOYEES FROM EXCEL ─────────────────────────────────────
  bulkImportEmployees = catchAsync(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No Excel file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });

    // ── Sheet 1: Employee Details — auto-detect header row ──
    const sheet1Name = workbook.SheetNames[0];
    const sheet1     = workbook.Sheets[sheet1Name];

    const rawRows1 = xlsx.utils.sheet_to_json(sheet1, { defval: '', header: 1 });

    let headerRowIndex1 = 0;
    for (let i = 0; i < rawRows1.length; i++) {
        const rowVals = rawRows1[i].map(v => String(v).trim());
        if (rowVals.includes('Employee ID') || rowVals.includes('Name') || rowVals.includes('Email')) {
            headerRowIndex1 = i;
            break;
        }
    }

    const headers1 = rawRows1[headerRowIndex1].map(h => String(h).trim());
    const rows = rawRows1
        .slice(headerRowIndex1 + 1)
        .filter(row => row.some(v => v !== '' && v !== null && v !== undefined))
        .map(row => {
            const obj = {};
            headers1.forEach((h, i) => {
                obj[h] = row[i] !== undefined ? row[i] : '';
            });
            return obj;
        });

    // ── Sheet 2: Exit/Previous Employment Details — auto-detect header row ──
    let exitRows = [];
    if (workbook.SheetNames.length > 1) {
        const sheet2Name = workbook.SheetNames[1];
        const sheet2     = workbook.Sheets[sheet2Name];

        const rawRows2 = xlsx.utils.sheet_to_json(sheet2, { defval: '', header: 1 });

        let headerRowIndex2 = 0;
        for (let i = 0; i < rawRows2.length; i++) {
            const rowVals = rawRows2[i].map(v => String(v).trim());
            if (rowVals.includes('Employee Name') || rowVals.includes('S.No')) {
                headerRowIndex2 = i;
                break;
            }
        }

        const headers2 = rawRows2[headerRowIndex2].map(h => String(h).trim());
        exitRows = rawRows2
            .slice(headerRowIndex2 + 1)
            .filter(row => row.some(v => v !== '' && v !== null && v !== undefined))
            .map(row => {
                const obj = {};
                headers2.forEach((h, i) => {
                    obj[h] = row[i] !== undefined ? row[i] : '';
                });
                return obj;
            });
    }

    const exitDataMap = {};
    exitRows.forEach((row) => {
        const name = String(safe(row['Employee Name'])).trim();
        if (name) exitDataMap[name.toLowerCase()] = row;
    });

    if (!rows || rows.length === 0) {
        return res.status(400).json({ message: 'Excel file is empty or has no data rows in Sheet 1' });
    }

    // ── Save uploaded file to disk for re-download ──
    if (!fs.existsSync(UPLOADED_EXCEL_DIR)) {
        fs.mkdirSync(UPLOADED_EXCEL_DIR, { recursive: true });
    }
    const savedFileName = `bulk-import-${Date.now()}.xlsx`;
    const savedFilePath = path.join(UPLOADED_EXCEL_DIR, savedFileName);
    fs.writeFileSync(savedFilePath, req.file.buffer);

    const results = { success: [], failed: [] };

    const defaultLeave  = await Defaults.findOne({});
    const defaultCasual = defaultLeave ? defaultLeave.casualDefault : 12;
    const defaultSick   = defaultLeave ? defaultLeave.sickDefault   : 10;

    // ── Helper to build encrypted fields ──
    const buildEncFields = (f) => encryptEmployee({
        contact:                  f.contact,
        address:                  f.permanentAddress,
        currentAddress:           f.currentAddress,
        personalEmail:            f.personalEmail,
        gender:                   f.gender,
        maritalStatus:            f.maritalStatus,
        nationality:              f.nationality,
        panNumber:                f.panNumber,
        aadharNumber:             f.aadharNumber,
        bankName:                 f.bankName,
        bankAccountNumber:        f.bankAccountNumber,
        ifscCode:                 f.ifscCode,
        emergencyContactName:     f.emergencyContactName,
        emergencyContactPhone:    f.emergencyContactPhone,
        emergencyContactRelation: '',
        baseSalary:               f.baseSalary,
    });

    // ── Helper to update exit data ──
    const updateExitData = async (employeeObjId, fullName, fullNameLower) => {
        const exitRow = exitDataMap[fullNameLower];
        if (!exitRow) return;
        await PreviousEmployment.findOneAndUpdate(
            { employee: employeeObjId },
            {
                employee:              employeeObjId,
                employeeName:          fullName,
                department:            String(safe(exitRow['Department'])).trim(),
                designation:           String(safe(exitRow['Designation'] || exitRow['Designation '])).trim(),
                joiningDate:           parseExcelDate(exitRow['Joining Date']),
                lastWorkingDay:        parseExcelDate(exitRow['LWD']),
                exitType:              String(safe(exitRow['Exit Type'] || exitRow[' Exit Type'])).trim(),
                reasonForExit:         String(safe(exitRow['Reason for Exit'])).trim(),
                managerName:           String(safe(exitRow['Manager/Supervisor Name'] || exitRow[' Manager/Supervisor Name'])).trim(),
                noticePeriodServed:    String(safe(exitRow['Notice Period Served'])).trim(),
                finalSettlementDone:   String(safe(exitRow['Final Settlement Done'] || exitRow[' Final Settlement Done'])).trim(),
                fnfDate:               parseExcelDate(exitRow['Fnf date']),
                exitInterviewDate:     parseExcelDate(exitRow['Exit Interview Date']),
                companyAssetsReturned: String(safe(exitRow['Company Assets Returned'])).trim(),
                hrRepresentative:      String(safe(exitRow['HR Representative'] || exitRow[' HR Representative'])).trim(),
                remarks:               String(safe(exitRow['Remarks'])).trim(),
            },
            { upsert: true, new: true }
        );
    };

    for (let i = 0; i < rows.length; i++) {
        const row    = rows[i];
        const rowNum = i + headerRowIndex1 + 2;

        const vals = Object.values(row).filter(v => v !== '' && v !== null && v !== undefined);
        if (vals.length === 0) continue;

        let user = null, employee = null, leave = null, payroll = null;

        try {
            const employeeId     = String(safe(row['Employee ID'])).trim();
            const fullName       = String(safe(row['Name'])).trim();
            const nameParts      = fullName.split(' ');
            const firstName      = nameParts[0] || '';
            const lastName       = nameParts.slice(1).join(' ') || ' ';
            const email          = String(safe(row['Email'])).trim().toLowerCase();
            const officeMailRaw  = row['Office mail id'] || row['Office mail id '] || row['Office Mail Id'] || '';
            const personalEmail  = String(safe(officeMailRaw)).trim().toLowerCase();
            const contact        = String(safe(row['Contact Number'])).trim();
            const department     = String(safe(row['Department'])).trim();
            const designation    = String(safe(row['Designation'])).trim();
            const baseSalary     = parseFloat(row['Salary']) || 0;
            const gender         = String(safe(row['Gender'])).trim();

            const rawStatus = String(safe(row['Employee Type'])).trim().toLowerCase();
            let empStatus = 'Full Time';
            if (rawStatus.includes('intern')) empStatus = 'Internship';

            const rawPeriodType = String(safe(row['Employee period type'] || row['Period Type'])).trim().toLowerCase();
            let empPeriodType = 'Permanent';
            if (rawPeriodType.includes('probation')) empPeriodType = 'Probation';
            else if (rawPeriodType.includes('contract')) empPeriodType = 'Contractual';

            const panNumber             = String(safe(row['PAN Number'])).trim();
            const aadharNumber          = String(safe(row['Aadhar Number'])).trim();
            const bankAccountNumber     = String(safe(row['Bank Account No'])).trim();
            const ifscCode              = String(safe(row['IFSC Code'])).trim();
            const bankName              = String(safe(row['Bank Name'])).trim();
            const permanentAddress      = String(safe(row['Permanent Address'])).trim();
            const currentAddress        = String(safe(row['Current Address'])).trim();
            const maritalStatus         = String(safe(row['Marital Status'])).trim();
            const emergencyContactName  = String(safe(row['Emergency contact Name'] || row['Emergency contact Name '])).trim();
            const emergencyContactPhone = String(safe(row['Emeregncy Contact Number'] || row['Emeregncy Contact Number '] || row['Emergency Contact Number'])).trim();
            const nationality           = String(safe(row['Nationality'])).trim();

            const dateOfJoining  = parseExcelDate(row['DATE OF JOINING']);
            const dateOfBirth    = parseExcelDate(row['Date of Birth']);
            const lastWorkingDay = parseExcelDate(row['Last Working Day']);

            if (!employeeId) { results.failed.push({ row: rowNum, name: fullName, reason: 'Employee ID is required' }); continue; }
            if (!email)      { results.failed.push({ row: rowNum, name: fullName, reason: 'Email is required' });       continue; }
            if (!firstName)  { results.failed.push({ row: rowNum, name: fullName, reason: 'Name is required' });        continue; }

            const fullNameLower = fullName.toLowerCase().trim();
            const fields = {
                contact, permanentAddress, currentAddress, personalEmail, gender,
                maritalStatus, nationality, panNumber, aadharNumber, bankName,
                bankAccountNumber, ifscCode, emergencyContactName, emergencyContactPhone, baseSalary
            };

            // ✅ PRIORITY 1: Check by employeeId — if exists, UPDATE
            const existingEmp = await Employee.findOne({ employeeId });
            if (existingEmp) {
                try {
                    const enc = buildEncFields(fields);

                    await User.findByIdAndUpdate(existingEmp._id, {
                        firstName, lastName, employeeId, isActive: true,
                    });

                    await Employee.findByIdAndUpdate(existingEmp._id, {
                        employeeId, firstName, lastName,
                        department, designation,
                        dateOfJoining, dateOfBirth, lastWorkingDay,
                        baseSalary:               enc.baseSalary,
                        status:                   empStatus,
                        periodType:               empPeriodType,
                        contact:                  enc.contact,
                        personalEmail:            enc.personalEmail,
                        address:                  enc.address,
                        currentAddress:           enc.currentAddress,
                        gender:                   enc.gender,
                        maritalStatus:            enc.maritalStatus,
                        nationality:              enc.nationality,
                        panNumber:                enc.panNumber,
                        aadharNumber:             enc.aadharNumber,
                        bankName:                 enc.bankName,
                        bankAccountNumber:        enc.bankAccountNumber,
                        ifscCode:                 enc.ifscCode,
                        emergencyContactName:     enc.emergencyContactName,
                        emergencyContactPhone:    enc.emergencyContactPhone,
                        emergencyContactRelation: enc.emergencyContactRelation,
                    });

                    await updateExitData(existingEmp._id, fullName, fullNameLower);

                    results.success.push({ row: rowNum, name: fullName, employeeId, email, action: 'updated' });
                    continue;

                } catch (updateError) {
                    console.error(`Bulk update row ${rowNum} error:`, updateError.message);
                    results.failed.push({ row: rowNum, name: fullName, reason: 'Update failed: ' + updateError.message });
                    continue;
                }
            }

            // ✅ PRIORITY 2: Check by email — if exists and name matches, UPDATE
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                const existingFullName = `${existingUser.firstName} ${existingUser.lastName}`.toLowerCase().trim();

                if (existingFullName === fullNameLower) {
                    try {
                        const enc = buildEncFields(fields);

                        await User.findByIdAndUpdate(existingUser._id, {
                            firstName, lastName, employeeId, isActive: true,
                        });

                        await Employee.findByIdAndUpdate(existingUser._id, {
                            employeeId, firstName, lastName, email,
                            department, designation,
                            dateOfJoining, dateOfBirth, lastWorkingDay,
                            baseSalary:               enc.baseSalary,
                            status:                   empStatus,
                            periodType:               empPeriodType,
                            contact:                  enc.contact,
                            personalEmail:            enc.personalEmail,
                            address:                  enc.address,
                            currentAddress:           enc.currentAddress,
                            gender:                   enc.gender,
                            maritalStatus:            enc.maritalStatus,
                            nationality:              enc.nationality,
                            panNumber:                enc.panNumber,
                            aadharNumber:             enc.aadharNumber,
                            bankName:                 enc.bankName,
                            bankAccountNumber:        enc.bankAccountNumber,
                            ifscCode:                 enc.ifscCode,
                            emergencyContactName:     enc.emergencyContactName,
                            emergencyContactPhone:    enc.emergencyContactPhone,
                            emergencyContactRelation: enc.emergencyContactRelation,
                        });

                        await updateExitData(existingUser._id, fullName, fullNameLower);

                        results.success.push({ row: rowNum, name: fullName, employeeId, email, action: 'updated' });
                        continue;

                    } catch (updateError) {
                        console.error(`Bulk update row ${rowNum} error:`, updateError.message);
                        results.failed.push({ row: rowNum, name: fullName, reason: 'Update failed: ' + updateError.message });
                        continue;
                    }
                } else {
                    results.failed.push({
                        row: rowNum,
                        name: fullName,
                        reason: `Email ${email} already belongs to a different employee`
                    });
                    continue;
                }
            }

            // ✅ PRIORITY 3: CREATE new employee
            const defaultPassword = `${employeeId}@123`;
            const enc = buildEncFields(fields);

            user = new User({
                firstName, lastName, email,
                password:   defaultPassword,
                role:       'employee',
                employeeId,
                isActive:   true,
            });
            await user.save();

            employee = new Employee({
                _id: user._id,
                employeeId, firstName, lastName, email,
                password:   defaultPassword,
                department, designation,
                dateOfJoining, dateOfBirth, lastWorkingDay,
                baseSalary:   enc.baseSalary,
                status:       empStatus,
                periodType:   empPeriodType,
                workMode:     'Work From Office',
                contact:                  enc.contact,
                personalEmail:            enc.personalEmail,
                address:                  enc.address,
                currentAddress:           enc.currentAddress,
                gender:                   enc.gender,
                maritalStatus:            enc.maritalStatus,
                nationality:              enc.nationality,
                panNumber:                enc.panNumber,
                aadharNumber:             enc.aadharNumber,
                bankName:                 enc.bankName,
                bankAccountNumber:        enc.bankAccountNumber,
                ifscCode:                 enc.ifscCode,
                emergencyContactName:     enc.emergencyContactName,
                emergencyContactPhone:    enc.emergencyContactPhone,
                emergencyContactRelation: enc.emergencyContactRelation,
            });
            await employee.save();

            await updateExitData(employee._id, fullName, fullNameLower);

            let casualLeave = defaultCasual;
            let sickLeave   = defaultSick;
            if (dateOfJoining) {
              const remainingMonths = 12 - dateOfJoining.getMonth();
              casualLeave = Math.max(0, Math.ceil(defaultCasual * remainingMonths / 12));
              sickLeave   = Math.max(0, Math.ceil(defaultSick   * remainingMonths / 12));
            }

            /* DISABLED: ── Leave Balance & Payroll ──
            leave = new Leave({ ... });
            await leave.save();
            const payroll = new Payroll({ ... });
            await payroll.save(); */

            results.success.push({ row: rowNum, name: fullName, employeeId, email, action: 'created' });

        } catch (error) {
            console.error(`Bulk import row ${rowNum} error:`, error.message);
            if (user)     await User.deleteOne({ _id: user._id }).catch(() => {});
            if (employee) await Employee.deleteOne({ _id: employee._id }).catch(() => {});
            if (leave)    await Leave.deleteOne({ _id: leave._id }).catch(() => {});
            if (payroll)  await Payroll.deleteOne({ _id: payroll._id }).catch(() => {});
            results.failed.push({ row: rowNum, name: String(row['Name'] || ''), reason: error.message });
        }
    }

    res.status(200).json({
        message: `Bulk import completed. ${results.success.length} processed, ${results.failed.length} failed.`,
        success: results.success,
        failed:  results.failed,
        totalProcessed: results.success.length + results.failed.length,
        savedFile: savedFileName,
    });
  });

  // ─── DOWNLOAD UPLOADED BULK EXCEL ─────────────────────────────────────────
  downloadUploadedExcel = catchAsync(async (req, res) => {
    const { filename } = req.params;
    const sanitized = path.basename(filename);
    if (!sanitized.startsWith('bulk-import-') || !sanitized.endsWith('.xlsx')) {
      return res.status(400).json({ message: 'Invalid file name' });
    }
    const filePath = path.join(UPLOADED_EXCEL_DIR, sanitized);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found. It may have been cleaned up.' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${sanitized}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.sendFile(filePath);
  });

  // ─── UPDATE EMPLOYEE ───────────────────────────────────────────────────────
  // ✅ FIX: baseSalary is now included in encryptEmployee call so enc.baseSalary is always populated
  updateEmployee = async (req, res) => {
    try {
      let existingRecord = await Employee.findById(req.params.id);
      let isUserOnly = false;
      let fullUser = null;

      if (!existingRecord) {
        fullUser = await User.findById(req.params.id);
        if (!fullUser) return res.status(404).json({ message: 'User/Employee not found' });
        existingRecord = fullUser.toObject();
        isUserOnly = true;
      }

      const b = req.body;
      const e = existingRecord;

      if (b.email && b.email !== e.email) {
        if (await Employee.findOne({ email: b.email })) return res.status(400).json({ message: 'Email already exists' });
        if (await User.findOne({ email: b.email }))     return res.status(400).json({ message: 'Email already exists in system' });
      }

      if (b.employeeId && b.employeeId !== e.employeeId) {
        if (await Employee.findOne({ employeeId: b.employeeId })) return res.status(400).json({ message: 'Employee ID already exists' });
      }

      const fp = (fieldName) =>
        req.files && req.files[fieldName]
          ? req.files[fieldName][0].path.replace('uploads\\', '').replace('uploads/', '')
          : null;

      // ── ✅ FIX: baseSalary is now included in the encryptEmployee call ──
      const enc = encryptEmployee({
        contact:                  b.contact                  !== undefined ? b.contact                  : null,
        address:                  b.address                  !== undefined ? b.address                  : null,
        currentAddress:           b.currentAddress           !== undefined ? b.currentAddress           : null,
        personalEmail:            b.personalEmail            !== undefined ? b.personalEmail            : null,
        gender:                   b.gender                   !== undefined ? b.gender                   : null,
        maritalStatus:            b.maritalStatus            !== undefined ? b.maritalStatus            : null,
        nationality:              b.nationality              !== undefined ? b.nationality              : null,
        panNumber:                b.panNumber                !== undefined ? b.panNumber                : null,
        aadharNumber:             b.aadharNumber             !== undefined ? b.aadharNumber             : null,
        bankName:                 b.bankName                 !== undefined ? b.bankName                 : null,
        bankAccountNumber:        b.bankAccountNumber        !== undefined ? b.bankAccountNumber        : null,
        ifscCode:                 b.ifscCode                 !== undefined ? b.ifscCode                 : null,
        emergencyContactName:     b.emergencyContactName     !== undefined ? b.emergencyContactName     : null,
        emergencyContactPhone:    b.emergencyContactPhone    !== undefined ? b.emergencyContactPhone    : null,
        emergencyContactRelation: b.emergencyContactRelation !== undefined ? b.emergencyContactRelation : null,
        // ✅ FIX: baseSalary was missing from this call — enc.baseSalary was always undefined
        baseSalary:               b.baseSalary               !== undefined ? parseFloat(b.baseSalary)   : null,
      });

      const updateData = {
        employeeId:     b.employeeId    || e.employeeId,
        firstName:      b.firstName     || e.firstName,
        lastName:       b.lastName      || e.lastName,
        email:          b.email         || e.email,
        department:     b.department    || e.department,
        designation:    b.designation   || e.designation,
        dateOfJoining:  safeDate(b.dateOfJoining)  || e.dateOfJoining,
        dateOfBirth:    safeDate(b.dateOfBirth)     || e.dateOfBirth,
        lastWorkingDay: b.lastWorkingDay !== undefined ? safeDate(b.lastWorkingDay) : e.lastWorkingDay,
        // ✅ FIX: enc.baseSalary is now correctly populated from the fixed encryptEmployee call above
        baseSalary:     b.baseSalary    !== undefined ? enc.baseSalary : e.baseSalary,
        status:         b.status        || e.status,
        periodType:     b.periodType    !== undefined ? b.periodType : e.periodType,
        isActive:       b.isActive      !== undefined
                          ? (b.isActive === 'true' || b.isActive === true)
                          : e.isActive,
        workMode:       b.workMode || e.workMode || 'Work From Office',

        // ── ENCRYPTED: use new encrypted value if field provided, else keep existing ──
        personalEmail:            b.personalEmail            !== undefined ? enc.personalEmail            : e.personalEmail,
        contact:                  b.contact                  !== undefined ? enc.contact                  : e.contact,
        address:                  b.address                  !== undefined ? enc.address                  : e.address,
        currentAddress:           b.currentAddress           !== undefined ? enc.currentAddress           : e.currentAddress,
        gender:                   b.gender                   !== undefined ? enc.gender                   : e.gender,
        maritalStatus:            b.maritalStatus            !== undefined ? enc.maritalStatus            : e.maritalStatus,
        nationality:              b.nationality              !== undefined ? enc.nationality               : e.nationality,
        panNumber:                b.panNumber                !== undefined ? enc.panNumber                : e.panNumber,
        aadharNumber:             b.aadharNumber             !== undefined ? enc.aadharNumber             : e.aadharNumber,
        bankName:                 b.bankName                 !== undefined ? enc.bankName                 : e.bankName,
        bankAccountNumber:        b.bankAccountNumber        !== undefined ? enc.bankAccountNumber        : e.bankAccountNumber,
        ifscCode:                 b.ifscCode                 !== undefined ? enc.ifscCode                 : e.ifscCode,
        emergencyContactName:     b.emergencyContactName     !== undefined ? enc.emergencyContactName     : e.emergencyContactName,
        emergencyContactPhone:    b.emergencyContactPhone    !== undefined ? enc.emergencyContactPhone    : e.emergencyContactPhone,
        emergencyContactRelation: b.emergencyContactRelation !== undefined ? enc.emergencyContactRelation : e.emergencyContactRelation,

        profilePhoto: fp('profilePhoto') || e.profilePhoto,
        documents: {
          adharCard:        fp('adharCard')        || e.documents?.adharCard,
          panCard:          fp('panCard')          || e.documents?.panCard,
          salarySlip:       fp('salarySlip')       || e.documents?.salarySlip,
          relievingLetter:  fp('relievingLetter')  || e.documents?.relievingLetter,
          experienceLetter: fp('experienceLetter') || e.documents?.experienceLetter,
          offerLetter:      fp('offerLetter')      || e.documents?.offerLetter,
        },
      };

      let employee;
      if (isUserOnly) {
        // For User-only (admin/HR): Create Employee record + update User
        const employeeData = new Employee({
          _id: req.params.id,
          password: fullUser ? fullUser.password : '',
          employeeId: e.employeeId || `ADMIN-${req.params.id.slice(-6)}`,
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          email: updateData.email,
          department: updateData.department || 'Administration',
          designation: updateData.designation || e.role?.toUpperCase(),
          status: 'Full Time',
          periodType: 'Permanent',
          workMode: updateData.workMode || 'Work From Office',
          ...updateData,
        });
        employee = await employeeData.save();

        // Sync User basic fields
        await User.findByIdAndUpdate(req.params.id, {
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          email: updateData.email,
          department: updateData.department,
          designation: updateData.designation,
        });
      } else {
        employee = await Employee.findByIdAndUpdate(req.params.id, updateData, { new: true });
      }

      // ── Update Previous Employment data if provided ──
      const pe = b.prevEmp
        ? (typeof b.prevEmp === 'string' ? JSON.parse(b.prevEmp) : b.prevEmp)
        : null;
      if (pe) {
        await PreviousEmployment.findOneAndUpdate(
          { employee: req.params.id },
          {
            employee:              req.params.id,
            employeeName:          safe(pe.employeeName),
            department:            safe(pe.department),
            designation:           safe(pe.designation),
            joiningDate:           safeDate(pe.joiningDate),
            lastWorkingDay:        safeDate(pe.lastWorkingDay),
            exitType:              safe(pe.exitType),
            reasonForExit:         safe(pe.reasonForExit),
            managerName:           safe(pe.managerName),
            noticePeriodServed:    safe(pe.noticePeriodServed),
            finalSettlementDone:   safe(pe.finalSettlementDone),
            fnfDate:               safeDate(pe.fnfDate),
            exitInterviewDate:     safeDate(pe.exitInterviewDate),
            companyAssetsReturned: safe(pe.companyAssetsReturned),
            hrRepresentative:      safe(pe.hrRepresentative),
            remarks:               safe(pe.remarks),
          },
          { upsert: true, new: true }
        );
      }

      // ── Save new documents ──
      const docTypes = [
        'profilePhoto', 'adharCard', 'panCard', 'salarySlip',
        'relievingLetter', 'experienceLetter', 'offerLetter',
      ];
      for (const docType of docTypes) {
        if (req.files && req.files[docType]) {
          const file = req.files[docType][0];
          await new Documents({
            employee:     req.params.id,
            documentType: docType,
            filePath:     fp(docType),
            originalName: file.originalname,
            mimeType:     file.mimetype,
            size:         file.size,
          }).save();
        }
      }

      // ── Sync User table: ONLY firstName, lastName, email ──
      const userUpdate = {
        firstName: b.firstName || e.firstName,
        lastName:  b.lastName  || e.lastName,
        email:     b.email     || e.email,
      };
      await User.findByIdAndUpdate(req.params.id, userUpdate);

      // ── Update password separately (triggers pre-save hash) ──
      if (b.password) {
        const userDoc = await User.findById(req.params.id);
        if (userDoc) { userDoc.password = b.password; await userDoc.save(); }
      }

      const decryptedEmployee = decryptEmployee(employee.toObject());
      res.json({ message: 'Updated successfully', employee: decryptedEmployee });
    } catch (err) {
      console.error('Update error:', err);
      res.status(500).json({ message: err.message });
    }
  };

  // ─── DELETE EMPLOYEE ───────────────────────────────────────────────────────
  deleteEmployee = async (req, res) => {
    try {
      const emp = await Employee.findById(req.params.id);
      if (!emp) return res.status(404).json({ message: 'Not found' });
      await User.findOneAndDelete({ email: emp.email });
      await Employee.findByIdAndDelete(req.params.id);
      await Documents.deleteMany({ employee: req.params.id });
      await Payroll.deleteMany({ employee: req.params.id });
      await PreviousEmployment.deleteMany({ employee: req.params.id });
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };

  // ─── BULK DELETE EMPLOYEES (admin only) ───────────────────────────────────
  bulkDeleteEmployees = async (req, res) => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'No employee IDs provided' });
      }

      const employees = await Employee.find({ _id: { $in: ids } }).select('email').lean();

      if (employees.length === 0) {
        return res.status(404).json({ message: 'No matching employees found' });
      }

      const emails = employees.map((e) => e.email);

      await Promise.all([
        Employee.deleteMany({ _id: { $in: ids } }),
        User.deleteMany({ email: { $in: emails } }),
        Documents.deleteMany({ employee: { $in: ids } }),
        Payroll.deleteMany({ employee: { $in: ids } }),
        PreviousEmployment.deleteMany({ employee: { $in: ids } }),
      ]);

      res.json({
        message: `${employees.length} employee(s) deleted successfully`,
        deletedCount: employees.length,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };

  // ─── GET EMPLOYEE PAYROLLS ─────────────────────────────────────────────────
  getEmployeePayrolls = catchAsync(async (req, res) => {
    try {
      const employeesWithPayroll = await User.aggregate([
        { $match: { role: 'employee' } },
      ]);
      res.status(200).json({ success: true, data: employeesWithPayroll });
    } catch (err) {
      throw new ApiError(500, 'Server Error');
    }
  });
}

module.exports = new EmployeeController();