const Offboarding  = require('../models/Offboarding');
const Employee     = require('../models/Employee');
const User         = require('../models/User');
const ApiError     = require('../utils/ApiError');
const catchAsync   = require('../utils/catchAsync');

class OffboardingController {

  // ─── GET ALL OFFBOARDING RECORDS ──────────────────────────────────────────
  // GET /offboarding?status=pending|completed
  getAll = catchAsync(async (req, res) => {
    try {
      const filter = {};
      if (req.query.status) filter.status = req.query.status;

      const records = await Offboarding.find(filter)
        .populate('employee', 'firstName lastName email employeeId department designation profilePhoto')
        .populate('initiatedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({ success: true, data: records });
    } catch (err) {
      throw new ApiError(500, err.message);
    }
  });

  // ─── GET BY EMPLOYEE ID ───────────────────────────────────────────────────
  // GET /offboarding/employee/:employeeId
  getByEmployee = catchAsync(async (req, res) => {
    try {
      const record = await Offboarding.findOne({ employee: req.params.employeeId })
        .populate('employee', 'firstName lastName email employeeId department designation profilePhoto')
        .populate('initiatedBy', 'firstName lastName email')
        .lean();

      if (!record) return res.status(404).json({ message: 'No offboarding record found for this employee' });

      res.status(200).json({ success: true, data: record });
    } catch (err) {
      throw new ApiError(500, err.message);
    }
  });

  // ─── GET BY ID ────────────────────────────────────────────────────────────
  // GET /offboarding/:id
  getById = catchAsync(async (req, res) => {
    try {
      const record = await Offboarding.findById(req.params.id)
        .populate('employee', 'firstName lastName email employeeId department designation profilePhoto')
        .populate('initiatedBy', 'firstName lastName email')
        .lean();

      if (!record) return res.status(404).json({ message: 'Offboarding record not found' });

      res.status(200).json({ success: true, data: record });
    } catch (err) {
      throw new ApiError(500, err.message);
    }
  });

  // ─── CREATE OFFBOARDING RECORD ────────────────────────────────────────────
  // POST /offboarding
  create = catchAsync(async (req, res) => {
    try {
      const b = req.body;

      if (!b.employeeId) return res.status(400).json({ message: 'Employee ID is required' });
      if (!b.actionType) return res.status(400).json({ message: 'Action type (voluntary/involuntary) is required' });

      // Verify employee exists
      const employee = await Employee.findById(b.employeeId);
      if (!employee) return res.status(404).json({ message: 'Employee not found' });

      // Deactivate employee in Employee and User tables
      await Employee.findByIdAndUpdate(b.employeeId, { isActive: false });
      await User.findByIdAndUpdate(b.employeeId, { isActive: false });

      // Parse assets.others (sent as JSON string from multipart or as JSON body)
      let assetsOthers = [];
      if (b['assets.others']) {
        try {
          assetsOthers = typeof b['assets.others'] === 'string'
            ? JSON.parse(b['assets.others'])
            : b['assets.others'];
        } catch { assetsOthers = []; }
      }

      // Parse fnf (sent as JSON string or as flat keys)
      let fnf = {
        ral:     b['fnf.ral']     || b.fnfRal     || 'Not Applicable',
        rl:      b['fnf.rl']      || b.fnfRl      || 'Not Applicable',
        payslip: b['fnf.payslip'] || b.fnfPayslip || 'Not Applicable',
      };

      // Parse assets (flat keys or nested)
      const assets = {
        laptop:  b['assets.laptop']  === 'true' || b['assets.laptop']  === true  || b.assetsLaptop  === 'true',
        mouse:   b['assets.mouse']   === 'true' || b['assets.mouse']   === true  || b.assetsMouse   === 'true',
        charger: b['assets.charger'] === 'true' || b['assets.charger'] === true  || b.assetsCharger === 'true',
        others:  assetsOthers,
      };

      // Check if record already exists for employee — update instead of duplicate
      const existing = await Offboarding.findOne({ employee: b.employeeId });
      if (existing) {
        const updated = await Offboarding.findByIdAndUpdate(
          existing._id,
          {
            actionType:              b.actionType,
            involuntaryReason:       b.involuntaryReason       || '',
            involuntaryReasonOther:  b.involuntaryReasonOther  || '',
            assets,
            noticePeriod:            b.noticePeriod            || 'Not Applicable',
            fnf,
            remarks:                 b.remarks                 || '',
            status:                  b.status                  || 'pending',
            initiatedBy:             req.user?._id             || null,
          },
          { new: true }
        ).populate('employee', 'firstName lastName email employeeId department designation');

        return res.status(200).json({ message: 'Offboarding record updated', data: updated });
      }

      const record = new Offboarding({
        employee:               b.employeeId,
        actionType:             b.actionType,
        involuntaryReason:      b.involuntaryReason      || '',
        involuntaryReasonOther: b.involuntaryReasonOther || '',
        assets,
        noticePeriod:           b.noticePeriod           || 'Not Applicable',
        fnf,
        remarks:                b.remarks                || '',
        status:                 b.status                 || 'pending',
        initiatedBy:            req.user?._id            || null,
      });

      await record.save();
      await record.populate('employee', 'firstName lastName email employeeId department designation');

      res.status(201).json({ message: 'Offboarding record created successfully', data: record });
    } catch (err) {
      console.error('Offboarding create error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // ─── UPDATE OFFBOARDING RECORD ────────────────────────────────────────────
  // PUT /offboarding/:id
  update = catchAsync(async (req, res) => {
    try {
      const b = req.body;

      const existing = await Offboarding.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Offboarding record not found' });

      let assetsOthers = existing.assets.others;
      if (b['assets.others'] !== undefined) {
        try {
          assetsOthers = typeof b['assets.others'] === 'string'
            ? JSON.parse(b['assets.others'])
            : b['assets.others'];
        } catch { assetsOthers = []; }
      }

      const fnf = {
        ral:     b['fnf.ral']     || b.fnfRal     || existing.fnf.ral,
        rl:      b['fnf.rl']      || b.fnfRl      || existing.fnf.rl,
        payslip: b['fnf.payslip'] || b.fnfPayslip || existing.fnf.payslip,
      };

      const assets = {
        laptop:  b['assets.laptop']  !== undefined ? (b['assets.laptop']  === 'true' || b['assets.laptop']  === true)  : existing.assets.laptop,
        mouse:   b['assets.mouse']   !== undefined ? (b['assets.mouse']   === 'true' || b['assets.mouse']   === true)  : existing.assets.mouse,
        charger: b['assets.charger'] !== undefined ? (b['assets.charger'] === 'true' || b['assets.charger'] === true)  : existing.assets.charger,
        others:  assetsOthers,
      };

      const updateData = {
        actionType:              b.actionType              || existing.actionType,
        involuntaryReason:       b.involuntaryReason       !== undefined ? b.involuntaryReason       : existing.involuntaryReason,
        involuntaryReasonOther:  b.involuntaryReasonOther  !== undefined ? b.involuntaryReasonOther  : existing.involuntaryReasonOther,
        assets,
        noticePeriod:            b.noticePeriod            || existing.noticePeriod,
        fnf,
        remarks:                 b.remarks                 !== undefined ? b.remarks                 : existing.remarks,
        status:                  b.status                  || existing.status,
      };

      const updated = await Offboarding.findByIdAndUpdate(req.params.id, updateData, { new: true })
        .populate('employee', 'firstName lastName email employeeId department designation');

      res.status(200).json({ message: 'Offboarding record updated', data: updated });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── DELETE OFFBOARDING RECORD ────────────────────────────────────────────
  // DELETE /offboarding/:id
  delete = catchAsync(async (req, res) => {
    try {
      const record = await Offboarding.findById(req.params.id);
      if (!record) return res.status(404).json({ message: 'Offboarding record not found' });

      await Offboarding.findByIdAndDelete(req.params.id);
      res.status(200).json({ message: 'Offboarding record deleted' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── MARK AS COMPLETED ────────────────────────────────────────────────────
  // PATCH /offboarding/:id/complete
  markComplete = catchAsync(async (req, res) => {
    try {
      const record = await Offboarding.findByIdAndUpdate(
        req.params.id,
        { status: 'completed' },
        { new: true }
      ).populate('employee', 'firstName lastName email employeeId department designation');

      if (!record) return res.status(404).json({ message: 'Offboarding record not found' });

      res.status(200).json({ message: 'Marked as completed', data: record });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
}

module.exports = new OffboardingController();