const Regularization = require('../models/Regularization');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { createNotification, notifyByRoles, notifyUsers } = require('./Notificationcontroller');

// Statuses HR is allowed to set on the attendance record while approving
const ALLOWED_APPROVAL_STATUSES = ['present', 'late', 'half-day', 'short-leave', 'absent'];

// ── Convert an "HH:mm" wall-clock time (assumed IST, UTC+5:30) into the
// correct UTC Date object anchored on baseDate's calendar day. Handles the
// early-morning edge case where the IST time rolls back into the previous
// UTC calendar day. ──────────────────────────────────────────────────────
function istTimeToUtcDate(baseDate, hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const parts = hhmm.split(':').map(Number);
  const h = parts[0];
  const m = parts[1] || 0;
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;

  let totalMin = (h * 60 + m) - 330; // IST is UTC+5:30
  const d = new Date(baseDate);
  if (totalMin < 0) {
    totalMin += 24 * 60;
    d.setUTCDate(d.getUTCDate() - 1);
  } else if (totalMin >= 24 * 60) {
    totalMin -= 24 * 60;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  d.setUTCHours(Math.floor(totalMin / 60), totalMin % 60, 0, 0);
  return d;
}

class RegularizationController {

  // ── Employee: submit a new regularization request ──────────────────────
  submitRequest = async (req, res) => {
    try {
      const { employeeId, date, reason } = req.body;

      if (!employeeId || !date || !reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'employeeId, date, and reason are required'
        });
      }

      const user = await User.findById(employeeId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }

      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date' });
      }
      targetDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (targetDate > today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot request regularization for a future date'
        });
      }

      // Block duplicate pending requests for the same date
      const existingPending = await Regularization.findOne({
        employee: employeeId,
        date: targetDate,
        status: 'pending'
      });
      if (existingPending) {
        return res.status(400).json({
          success: false,
          message: 'A pending regularization request already exists for this date'
        });
      }

      const regularization = new Regularization({
        employee: employeeId,
        username: `${user.firstName} ${user.lastName}`,
        date: targetDate,
        reason: reason.trim(),
        status: 'pending'
      });

      await regularization.save();

      // 🔔 Notify HR/Admin/Manager + the employee's TL
      const dateStr = targetDate.toDateString();
      await notifyByRoles(['hr', 'admin', 'manager'], {
        sender:   employeeId,
        type:     'regularization_applied',
        title:    `Regularization Request — ${user.firstName} ${user.lastName}`,
        message:  `${user.firstName} ${user.lastName} requested attendance regularization for ${dateStr}. Reason: ${reason.trim()}`,
        refId:    regularization._id,
        refModel: 'Regularization',
        meta:     { date: dateStr },
      });
      if (user.teamLead_id) {
        await notifyUsers([user.teamLead_id], {
          sender:   employeeId,
          type:     'regularization_applied',
          title:    `Regularization Request — ${user.firstName} ${user.lastName}`,
          message:  `Your team member ${user.firstName} requested attendance regularization for ${dateStr}.`,
          refId:    regularization._id,
          refModel: 'Regularization',
        });
      }

      res.status(201).json({
        success: true,
        message: 'Regularization request submitted successfully',
        data: regularization
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── Employee: view own requests ─────────────────────────────────────────
  getMyRequests = async (req, res) => {
    try {
      const { employeeId } = req.query;
      if (!employeeId) {
        return res.status(400).json({ success: false, message: 'employeeId is required' });
      }

      const requests = await Regularization.find({ employee: employeeId })
        .sort({ createdAt: -1 });

      res.json({ success: true, data: requests });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── HR/Admin/Manager: view all requests, optional ?status= filter ──────
  getAllRequests = async (req, res) => {
    try {
      const { status } = req.query;
      const filter = {};
      if (status) filter.status = status;

      const requests = await Regularization.find(filter)
        .populate('employee', 'employeeId firstName lastName email department designation')
        .populate('reviewedBy', 'firstName lastName')
        .sort({ createdAt: -1 });

      res.json({ success: true, count: requests.length, data: requests });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── HR/Admin/Manager: approve → HR sets punch-in/punch-out/status, working
  // hours are auto-calculated, and the previous attendance state (if any) is
  // snapshotted for audit before being overwritten. ───────────────────────
  approveRequest = async (req, res) => {
    try {
      const { id } = req.params;
      const { hrId, checkInTime, checkOutTime, status } = req.body;

      if (!checkInTime || !checkOutTime) {
        return res.status(400).json({
          success: false,
          message: 'checkInTime and checkOutTime (HH:mm, 24-hour) are required to approve a regularization request'
        });
      }

      const finalStatus = ALLOWED_APPROVAL_STATUSES.includes(status) ? status : 'present';

      const regularization = await Regularization.findById(id);
      if (!regularization) {
        return res.status(404).json({ success: false, message: 'Regularization request not found' });
      }
      if (regularization.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Request already ${regularization.status}`
        });
      }

      const regDate = new Date(regularization.date);

      const newCheckInTime = istTimeToUtcDate(regDate, checkInTime);
      const newCheckOutTime = istTimeToUtcDate(regDate, checkOutTime);

      if (!newCheckInTime || !newCheckOutTime) {
        return res.status(400).json({ success: false, message: 'Invalid time format. Use HH:mm (24-hour).' });
      }

      const workingHoursRaw = (newCheckOutTime.getTime() - newCheckInTime.getTime()) / (1000 * 60 * 60);
      if (workingHoursRaw <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Punch-out time must be after punch-in time'
        });
      }
      const newWorkingHours = parseFloat(workingHoursRaw.toFixed(2));

      // ── Snapshot whatever attendance existed BEFORE this change ──
      const existingAttendance = await Attendance.findOne({
        employee: regularization.employee,
        date: regDate
      });

      const previousAttendance = existingAttendance
        ? {
            existed:      true,
            checkInTime:  existingAttendance.checkInTime || null,
            checkOutTime: existingAttendance.checkOutTime || null,
            status:       existingAttendance.status || null,
            workingHours: existingAttendance.workingHours || null
          }
        : { existed: false, checkInTime: null, checkOutTime: null, status: null, workingHours: null };

      const attendance = await Attendance.findOneAndUpdate(
        { employee: regularization.employee, date: regDate },
        {
          $set: {
            username: regularization.username,
            checkInTime: newCheckInTime,
            checkOutTime: newCheckOutTime,
            workingHours: newWorkingHours,
            status: finalStatus,
            isRegularized: true,
            regularizedFrom: regularization._id
          },
          $setOnInsert: {
            employee: regularization.employee,
            date: regDate
          }
        },
        { new: true, upsert: true }
      );

      regularization.status = 'approved';
      regularization.reviewedBy = hrId;
      regularization.reviewedAt = new Date();
      regularization.previousAttendance = previousAttendance;
      regularization.newAttendance = {
        checkInTime: newCheckInTime,
        checkOutTime: newCheckOutTime,
        status: finalStatus,
        workingHours: newWorkingHours
      };
      await regularization.save();

      // 🔔 Notify the employee their request was approved
      await createNotification({
        recipient: regularization.employee,
        sender:    hrId || req.user.id || req.user._id,
        type:      'regularization_approved',
        title:     'Regularization Approved ✅',
        message:   `Your attendance regularization for ${regDate.toDateString()} has been approved. Marked as ${finalStatus} (${checkInTime} – ${checkOutTime}, ${newWorkingHours} hrs).`,
        refId:     regularization._id,
        refModel:  'Regularization',
      });

      res.json({
        success: true,
        message: 'Regularization request approved and attendance updated',
        data: regularization,
        attendance
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── HR/Admin/Manager: reject, must include a reason ─────────────────────
  rejectRequest = async (req, res) => {
    try {
      const { id } = req.params;
      const { hrId, rejectionReason } = req.body;

      if (!rejectionReason || !rejectionReason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required'
        });
      }

      const regularization = await Regularization.findById(id);
      if (!regularization) {
        return res.status(404).json({ success: false, message: 'Regularization request not found' });
      }
      if (regularization.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Request already ${regularization.status}`
        });
      }

      regularization.status = 'rejected';
      regularization.rejectionReason = rejectionReason.trim();
      regularization.reviewedBy = hrId;
      regularization.reviewedAt = new Date();
      await regularization.save();

      // 🔔 Notify the employee their request was rejected
      await createNotification({
        recipient: regularization.employee,
        sender:    hrId || req.user.id || req.user._id,
        type:      'regularization_rejected',
        title:     'Regularization Rejected ❌',
        message:   `Your attendance regularization for ${new Date(regularization.date).toDateString()} was rejected. Reason: ${rejectionReason.trim()}`,
        refId:     regularization._id,
        refModel:  'Regularization',
      });

      res.json({
        success: true,
        message: 'Regularization request rejected',
        data: regularization
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
}

module.exports = new RegularizationController();