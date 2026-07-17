// controllers/resignationController.js

const Resignation = require('../models/Resignation');
const Employee    = require('../models/Employee');
const catchAsync  = require('../utils/catchAsync');
const ApiError    = require('../utils/ApiError');
const { createNotification, notifyByRoles } = require('./Notificationcontroller');

// ─── Helper: resolve Employee doc from the authenticated User ─────────────────
// Auth middleware attaches a User doc to req.user.
// Employee is a separate collection — try _id, then email, then employeeId.
const resolveEmployee = async (user) => {
  // Try 1: Employee._id === User._id
  let emp = await Employee.findById(user._id).lean();
  if (emp) return emp;

  // Try 2: match by email (most reliable cross-collection join)
  if (user.email) {
    emp = await Employee.findOne({ email: user.email.toLowerCase() }).lean();
    if (emp) return emp;
  }

  // Try 3: match by employeeId string field
  if (user.employeeId) {
    emp = await Employee.findOne({ employeeId: user.employeeId }).lean();
    if (emp) return emp;
  }

  return null;
};

class ResignationController {

  // ─── POST /resignations — Employee submits ──────────────────────────────────
  submit = catchAsync(async (req, res) => {
    const { managerName, resignationReason } = req.body;

    if (!managerName || !resignationReason) {
      throw new ApiError(400, 'Manager name and resignation reason are required.');
    }

    const employee = await resolveEmployee(req.user);
    if (!employee) {
      throw new ApiError(404, 'Employee record not found. Please contact HR.');
    }

    // Prevent duplicate pending resignation
    const existing = await Resignation.findOne({
      employee: employee._id,
      status: 'pending',
    });
    if (existing) {
      throw new ApiError(409, 'You already have a pending resignation request.');
    }

    const resignation = await Resignation.create({
      employee:          employee._id,
      employeeName:      `${employee.firstName} ${employee.lastName}`.trim(),
      employeeId:        employee.employeeId,
      managerName:       managerName.trim(),
      resignationReason: resignationReason.trim(),
    });

    // 🔔 Notify HR/Admin (added — resignation flow had no notifications at all)
    await notifyByRoles(['hr', 'admin'], {
      sender:   req.user.id || req.user._id,
      type:     'resignation_submitted',
      title:    `Resignation Submitted — ${resignation.employeeName}`,
      message:  `${resignation.employeeName} (${resignation.employeeId}) submitted a resignation. Reason: ${resignation.resignationReason}`,
      refId:    resignation._id,
      refModel: 'Resignation',
    });

    res.status(201).json({
      message: 'Resignation submitted successfully.',
      data: resignation,
    });
  });

  // ─── GET /resignations/my — Employee views own latest ───────────────────────
  getMine = catchAsync(async (req, res) => {
    const employee = await resolveEmployee(req.user);

    if (!employee) {
      return res.json({ data: null });
    }

    const resignation = await Resignation.findOne({ employee: employee._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: resignation || null });
  });

  // ─── DELETE /resignations/my — Employee withdraws pending ───────────────────
  withdrawMine = catchAsync(async (req, res) => {
    const employee = await resolveEmployee(req.user);
    if (!employee) throw new ApiError(404, 'Employee record not found.');

    const resignation = await Resignation.findOne({
      employee: employee._id,
      status: 'pending',
    });

    if (!resignation) {
      throw new ApiError(404, 'No pending resignation found to withdraw.');
    }

    await resignation.deleteOne();
    res.json({ message: 'Resignation withdrawn successfully.' });
  });

  // ─── GET /resignations — HR/Admin lists all ─────────────────────────────────
  getAll = catchAsync(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const resignations = await Resignation.find(filter)
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'firstName lastName')
      .lean();

    res.json({ data: resignations });
  });

  // ─── GET /resignations/:id — HR/Admin single detail ─────────────────────────
  getById = catchAsync(async (req, res) => {
    const resignation = await Resignation.findById(req.params.id)
      .populate('reviewedBy', 'firstName lastName')
      .lean();

    if (!resignation) throw new ApiError(404, 'Resignation not found.');
    res.json({ data: resignation });
  });

  // ─── PUT /resignations/:id/accept — HR/Admin accepts ────────────────────────
  accept = catchAsync(async (req, res) => {
    const resignation = await Resignation.findById(req.params.id);
    if (!resignation) throw new ApiError(404, 'Resignation not found.');

    if (resignation.status !== 'pending') {
      throw new ApiError(400, `Resignation is already ${resignation.status}.`);
    }

    resignation.status     = 'accepted';
    resignation.reviewedBy = req.user.id || req.user._id; // 🐛 FIX: JWT payload uses `id`, not `_id`
    resignation.reviewedAt = new Date();
    resignation.canReapply = false;
    await resignation.save();

    // 🔔 Notify the employee (added)
    await createNotification({
      recipient: resignation.employee,
      sender:    req.user.id || req.user._id,
      type:      'resignation_accepted',
      title:     'Resignation Accepted',
      message:   'Your resignation has been accepted by HR. The offboarding process will begin shortly.',
      refId:     resignation._id,
      refModel:  'Resignation',
    });

    res.json({ message: 'Resignation accepted.', data: resignation });
  });

  // ─── PUT /resignations/:id/reject — HR/Admin rejects with reason ────────────
  reject = catchAsync(async (req, res) => {
    const { rejectionReason } = req.body;

    if (!rejectionReason || !rejectionReason.trim()) {
      throw new ApiError(400, 'A rejection reason is required.');
    }

    const resignation = await Resignation.findById(req.params.id);
    if (!resignation) throw new ApiError(404, 'Resignation not found.');

    if (resignation.status !== 'pending') {
      throw new ApiError(400, `Resignation is already ${resignation.status}.`);
    }

    resignation.status          = 'rejected';
    resignation.rejectionReason = rejectionReason.trim();
    resignation.reviewedBy      = req.user.id || req.user._id; // 🐛 FIX: JWT payload uses `id`, not `_id`
    resignation.reviewedAt      = new Date();
    resignation.canReapply      = true;
    await resignation.save();

    // 🔔 Notify the employee (added)
    await createNotification({
      recipient: resignation.employee,
      sender:    req.user.id || req.user._id,
      type:      'resignation_rejected',
      title:     'Resignation Rejected',
      message:   `Your resignation was rejected. Reason: ${rejectionReason.trim()}`,
      refId:     resignation._id,
      refModel:  'Resignation',
    });

    res.json({ message: 'Resignation rejected.', data: resignation });
  });

}

module.exports = new ResignationController();