const Regularization = require('../models/Regularization');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

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

  // ── HR/Admin/Manager: approve → regularizes the attendance record ──────
  approveRequest = async (req, res) => {
    try {
      const { id } = req.params;
      const { hrId } = req.body;

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

      const checkInTime = new Date(regDate);
      checkInTime.setUTCHours(4, 0, 0, 0);

      const checkOutTime = new Date(regDate);
      checkOutTime.setUTCHours(13, 0, 0, 0);

      const attendance = await Attendance.findOneAndUpdate(
        { employee: regularization.employee, date: regDate },
        {
          $set: {
            username: regularization.username,
            checkInTime,
            checkOutTime,
            workingHours: 9,
            status: 'present',
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
      await regularization.save();

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