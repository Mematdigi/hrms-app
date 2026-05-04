const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { calculateDistance, isWithinRadius, validateCoordinates } = require('../utils/geolocation-helper');
const locationConfig = require('../config/locationConfig');

class AttendanceController {

  // Office coordinates configuration (can be moved to database later)
  OFFICE_LOCATION = {
    latitude: locationConfig.office.latitude,
    longitude: locationConfig.office.longitude,
    radiusInMeters: locationConfig.office.radiusInMeters
  };

  // Calculate distance between two coordinates using Haversine formula
  calculateDistance(lat1, lon1, lat2, lon2) {
    return calculateDistance(lat1, lon1, lat2, lon2);
  }

  // Verify if location is within office premises
  isWithinOffice(latitude, longitude) {
    if (!validateCoordinates(latitude, longitude)) {
      throw new Error('Invalid coordinates provided');
    }

    const result = isWithinRadius(
      latitude,
      longitude,
      this.OFFICE_LOCATION.latitude,
      this.OFFICE_LOCATION.longitude,
      this.OFFICE_LOCATION.radiusInMeters
    );

    console.log('Location check result:', result);
    return {
      isWithin: result.isWithinRadius,
      distance: result.distance.toFixed(2)
    };
  }

  checkIn = async (req, res) => {
    try {
      const { employeeId } = req.body;

      console.log('Check-in request received:', req.body);

      // Fetch user to get username
      const user = await User.findById(employeeId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      const username = `${user.firstName} ${user.lastName}`;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let attendance = await Attendance.findOne({ employee: employeeId, date: today });

      if (!attendance) {
        attendance = new Attendance({
          employee: employeeId,
          username: username,
          date: today,
          checkInTime: new Date(),
          status: 'working'
        });
      } else if (!attendance.checkInTime) {
        attendance.checkInTime = new Date();
        attendance.status = 'working';
        attendance.username = username; // Update name if not set
      } else {
        return res.status(400).json({
          success: false,
          message: 'Already checked in for today',
          attendance
        });
      }

      await attendance.save();
      res.json({
        success: true,
        message: 'Check-in successful',
        attendance
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  checkOut = async (req, res) => {
    try {
      const { employeeId } = req.body;

      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID is required'
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const attendance = await Attendance.findOne({ employee: employeeId, date: today });

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: 'No check-in found for today. Please check in first.'
        });
      }

      if (!attendance.checkInTime) {
        return res.status(400).json({
          success: false,
          message: 'Please check in first before checking out'
        });
      }

      if (attendance.checkOutTime) {
        return res.status(400).json({
          success: false,
          message: 'Already checked out for today',
          attendance
        });
      }

      const checkOutTime = new Date();
      const checkInHours = attendance.checkInTime.getHours();
      const checkInMinutes = attendance.checkInTime.getMinutes();
      const checkOutHours = checkOutTime.getHours();
      const checkOutMinutes = checkOutTime.getMinutes();

      const checkInTotalMinutes = checkInHours * 60 + checkInMinutes;
      const checkOutTotalMinutes = checkOutHours * 60 + checkOutMinutes;

      const earliestCheckOutConfig = locationConfig.workingHours.earliestCheckOutTime;
      const earliestCheckOut = earliestCheckOutConfig.hours * 60 + earliestCheckOutConfig.minutes;

      // Check if early checkout - commented out to allow early checkout without approval
      // if (checkOutTotalMinutes < earliestCheckOut) {
      //   return res.status(400).json({
      //     success: false,
      //     requiresApproval: true,
      //     message: 'Early checkout requires HR approval',
      //     expectedCheckout: `${earliestCheckOutConfig.hours}:${earliestCheckOutConfig.minutes.toString().padStart(2, '0')}`,
      //     currentTime: checkOutTime.toLocaleTimeString('en-US', {
      //       hour: '2-digit',
      //       minute: '2-digit',
      //       hour12: true
      //     }),
      //     checkOutTimeMinutes: checkOutTotalMinutes,
      //     requiredMinutes: earliestCheckOut
      //   });
      // }

      attendance.checkOutTime = checkOutTime;

      // Calculate working hours
      if (attendance.checkInTime) {
        const hours = (attendance.checkOutTime - attendance.checkInTime) / (1000 * 60 * 60);
        attendance.workingHours = parseFloat(hours.toFixed(2));
      }

      const latestCheckInConfig = locationConfig.workingHours.latestCheckInTime;
      const latestCheckIn = latestCheckInConfig.hours * 60 + latestCheckInConfig.minutes;

      // ─── Time boundary constants (in total minutes from midnight) ───────────
      const LATE_CHECKIN_START = 9 * 60 + 40;   // 9:40 AM
      const LATE_CHECKIN_END = 9 * 60 + 50;   // 9:50 AM
      const SHORT_LEAVE_CHECKIN_END = 11 * 60;      // 11:00 AM
      const SHORT_LEAVE_CHECKOUT_START = 17 * 60;   // 5:00 PM
      const SHORT_LEAVE_CHECKOUT_END = 18 * 60 + 30; // 6:30 PM
      // ────────────────────────────────────────────────────────────────────────

      // Condition 1: CheckIn between 9:40 - 9:50 → LATE
      const isLateCheckIn = checkInTotalMinutes >= LATE_CHECKIN_START && checkInTotalMinutes < LATE_CHECKIN_END;

      // Condition 2: CheckIn between 9:50 - 11:00 → SHORT LEAVE
      const isShortLeaveByCheckIn = checkInTotalMinutes >= LATE_CHECKIN_END && checkInTotalMinutes < SHORT_LEAVE_CHECKIN_END;

      // Condition 3: CheckOut between 17:00 - 18:30 → SHORT LEAVE
      const isShortLeaveByCheckOut = checkOutTotalMinutes >= SHORT_LEAVE_CHECKOUT_START && checkOutTotalMinutes <= SHORT_LEAVE_CHECKOUT_END;

      // ─── Status determination (priority order) ───────────────────────────────
      if (isShortLeaveByCheckIn || isShortLeaveByCheckOut) {
        // Short leave takes priority: late check-in (9:50-11:00) or early checkout (17:00-18:30)
        attendance.status = 'short-leave';
      } else if (isLateCheckIn) {
        // Late check-in: arrived between 9:40 and 9:50
        attendance.status = 'late';
      }
      else if (attendance.workingHours >= 8.5) {
        attendance.status = 'present';
      }
      else if (checkInTotalMinutes <= latestCheckIn && checkOutTotalMinutes >= earliestCheckOut) {
        // On time check-in + proper checkout → Present
        attendance.status = 'present';
      } else if (attendance.workingHours >= 4.5) {
        attendance.status = 'half-day';
      } else {
        attendance.status = 'absent';
      }
      // ─────────────────────────────────────────────────────────────────────────

      await attendance.save();
      res.json({
        success: true,
        message: 'Check-out successful',
        attendance,
        workingHours: attendance.workingHours,
        status: attendance.status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  requestEarlyCheckout = async (req, res) => {
    try {
      const { employeeId, reason, latitude, longitude } = req.body;

      if (!reason || reason.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Reason is required for early checkout'
        });
      }

      // Validate location data
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Location data is required'
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let attendance = await Attendance.findOne({ employee: employeeId, date: today });

      if (!attendance) {
        return res.status(400).json({
          success: false,
          message: 'No attendance record found for today'
        });
      }

      if (!attendance.checkInTime) {
        return res.status(400).json({
          success: false,
          message: 'Please check in first before requesting early checkout'
        });
      }

      if (attendance.checkOutTime) {
        return res.status(400).json({
          success: false,
          message: 'Already checked out for today'
        });
      }

      // Verify location is within office
      const locationCheck = this.isWithinOffice(latitude, longitude);
      if (!locationCheck.isWithin) {
        return res.status(400).json({
          success: false,
          message: `You are ${locationCheck.distance}m away from office. Must be within office premises to request early checkout.`,
          distance: locationCheck.distance
        });
      }

      attendance.earlyCheckoutRequest = {
        requested: true,
        requestedAt: new Date(),
        reason: reason.trim(),
        status: 'pending',
        location: { latitude, longitude }
      };

      await attendance.save();

      res.json({
        success: true,
        message: 'Early checkout request submitted for HR approval',
        attendance
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  approveEarlyCheckout = async (req, res) => {
    try {
      const { attendanceId, approved, hrId, latitude, longitude } = req.body;

      if (!attendanceId || !hrId || approved === undefined) {
        return res.status(400).json({
          success: false,
          message: 'attendanceId, hrId, and approved status are required'
        });
      }

      const attendance = await Attendance.findById(attendanceId);

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
      }

      if (!attendance.earlyCheckoutRequest.requested) {
        return res.status(400).json({
          success: false,
          message: 'No early checkout request found'
        });
      }

      if (attendance.earlyCheckoutRequest.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Request already ${attendance.earlyCheckoutRequest.status}`
        });
      }

      attendance.earlyCheckoutRequest.approvedBy = hrId;
      attendance.earlyCheckoutRequest.approvedAt = new Date();
      attendance.earlyCheckoutRequest.status = approved ? 'approved' : 'rejected';

      if (approved) {
        // Approve and process checkout
        attendance.checkOutTime = new Date();
        if (latitude && longitude) {
          attendance.checkOutLocation = { latitude, longitude };
        }

        // Calculate working hours
        const hours = (attendance.checkOutTime - attendance.checkInTime) / (1000 * 60 * 60);
        attendance.workingHours = parseFloat(hours.toFixed(2));

        // Determine status based on working hours
        if (attendance.workingHours >= locationConfig.workingHours.minimumHoursForHalfDay) {
          attendance.status = 'half-day';
        } else {
          attendance.status = 'absent';
        }
      } else {
        // Rejected - reset to working status
        attendance.status = 'working';
      }

      await attendance.save();

      res.json({
        success: true,
        message: approved ? 'Early checkout request approved successfully' : 'Early checkout request rejected',
        attendance,
        action: approved ? 'approved' : 'rejected'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getPendingRequests = async (req, res) => {
    try {
      const requests = await Attendance.find({
        'earlyCheckoutRequest.requested': true,
        'earlyCheckoutRequest.status': 'pending'
      })
        .populate('employee', 'employeeId firstName lastName email department designation')
        .sort({ 'earlyCheckoutRequest.requestedAt': -1 });

      res.json({
        success: true,
        count: requests.length,
        data: requests
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getAttendance = async (req, res) => {
    try {
      const { employeeId, startDate, endDate } = req.query;
      const query = { employee: employeeId };

      if (startDate && endDate) {
        query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }

      const attendance = await Attendance.find(query)
        .populate('employee', 'firstName lastName')
        .sort({ date: -1 });

      res.json(attendance);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getCalendarData = async (req, res) => {
    try {
      const { employeeId, year, month } = req.query;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      endDate.setHours(23, 59, 59, 999);

      const attendance = await Attendance.find({
        employee: employeeId,
        date: { $gte: startDate, $lte: endDate }
      }).select('date status workingHours');

      res.json({
        success: true,
        data: attendance
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getAttendanceSummary = async (req, res) => {
    try {
      const { employeeId, month, year } = req.query;

      const currentDate = new Date();
      const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
      const targetYear = year ? parseInt(year) : currentDate.getFullYear();

      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(targetYear, targetMonth + 1, 0);
      endDate.setHours(23, 59, 59, 999);

      const attendance = await Attendance.find({
        employee: employeeId,
        date: { $gte: startDate, $lte: endDate }
      });

      const summary = {
        totalDays: attendance.length,
        present: attendance.filter(a => a.status === 'present').length,
        absent: attendance.filter(a => a.status === 'absent').length,
        halfDay: attendance.filter(a => a.status === 'half-day').length,
        late: attendance.filter(a => a.status === 'late').length,
        shortLeave: attendance.filter(a => a.status === 'short-leave').length,
        leave: attendance.filter(a => a.status === 'leave').length,
        pending: attendance.filter(a => a.status === 'pending-approval').length,
        totalWorkingHours: attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0).toFixed(2),
        averageWorkingHours: (attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0) / (attendance.length || 1)).toFixed(2),
        month: targetMonth + 1,
        year: targetYear
      };

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  markAttendance = async (req, res) => {
    try {
      const { employeeId, date, status } = req.body;

      // Fetch user to get username
      const user = await User.findById(employeeId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      const username = `${user.firstName} ${user.lastName}`;

      const attendance = await Attendance.findOneAndUpdate(
        { employee: employeeId, date: new Date(date) },
        { status, username },
        { new: true, upsert: true }
      );

      res.json({
        success: true,
        message: 'Attendance marked successfully',
        attendance
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getAttendanceList = async (req, res) => {
    try {
      const { from, to, status, employeeId } = req.query;

      const filter = {};

      // ── FIX: Properly handle date range with timezone-aware filtering ──
      if (from || to) {
        filter.date = {};
        if (from) {
          // Start of the day (inclusive)
          const fromDate = new Date(from);
          fromDate.setHours(0, 0, 0, 0);
          filter.date.$gte = fromDate;
        }
        if (to) {
          // End of the day (inclusive)
          const toDate = new Date(to);
          toDate.setHours(23, 59, 59, 999);
          filter.date.$lte = toDate;
        }
      }

      // Apply status filter only if provided
      if (status) {
        filter.status = status;
      }

      // Apply employeeId filter only if provided
      if (employeeId) {
        filter.employee = employeeId;
      }

      console.log('Attendance filter query:', filter); // Debug log

      const records = await Attendance.find(filter)
        .populate('employee', 'employeeId firstName lastName email department designation role')
        .sort({ date: -1, createdAt: -1 });

      console.log('Attendance records found:', records.length); // Debug log

      return res.status(200).json({
        success: true,
        count: records.length,
        data: records,
      });
    } catch (err) {
      console.error('Error fetching attendance list:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance list',
        error: err.message
      });
    }
  };
}

module.exports = new AttendanceController();