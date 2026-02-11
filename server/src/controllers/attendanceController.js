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
      const { employeeId, latitude, longitude } = req.body;

      console.log('Check-in request received:', req.body);
      // Validate location data - commented out to allow check-in without location
      // if (!latitude || !longitude) {
      //   return res.status(400).json({
      //     success: false,
      //     message: 'Location data is required for check-in'
      //   });
      // }

      // Verify if employee is within office premises - commented out
      // console.log('Checking location for check-in:', latitude, longitude);
      // const locationCheck = this.isWithinOffice(latitude, longitude);

      // if (!locationCheck.isWithin) {
      //   return res.status(403).json({
      //     success: false,
      //     message: `You must be at the office premises to check in`,
      //     distance: locationCheck.distance,
      //     distanceKm: (locationCheck.distance / 1000).toFixed(2),
      //     requiredRadius: this.OFFICE_LOCATION.radiusInMeters,
      //     officeLocation: {
      //       latitude: this.OFFICE_LOCATION.latitude,
      //       longitude: this.OFFICE_LOCATION.longitude
      //     }
      //   });
      // }

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
          checkInLocation: { latitude, longitude },
          status: 'working'
        });
      } else if (!attendance.checkInTime) {
        attendance.checkInTime = new Date();
        attendance.checkInLocation = { latitude, longitude };
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
        // Location check commented out - no location info in response
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
      const { employeeId, latitude, longitude } = req.body;

      // Validate location data - commented out to allow check-out without location
      // if (!latitude || !longitude) {
      //   return res.status(400).json({
      //     success: false,
      //     message: 'Location data is required for check-out'
      //   });
      // }

      // Verify if employee is within office premises - commented out
      // const locationCheck = this.isWithinOffice(latitude, longitude);

      // if (!locationCheck.isWithin) {
      //   return res.status(403).json({
      //     success: false,
      //     message: `You must be at the office premises to check out`,
      //     distance: locationCheck.distance,
      //     distanceKm: (locationCheck.distance / 1000).toFixed(2),
      //     requiredRadius: this.OFFICE_LOCATION.radiusInMeters,
      //     officeLocation: {
      //       latitude: this.OFFICE_LOCATION.latitude,
      //       longitude: this.OFFICE_LOCATION.longitude
      //     }
      //   });
      // }

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
      attendance.checkOutLocation = { latitude, longitude };
      
      // Calculate working hours
      if (attendance.checkInTime) {
        const hours = (attendance.checkOutTime - attendance.checkInTime) / (1000 * 60 * 60);
        attendance.workingHours = parseFloat(hours.toFixed(2));
      }

      const latestCheckInConfig = locationConfig.workingHours.latestCheckInTime;
      const latestCheckIn = latestCheckInConfig.hours * 60 + latestCheckInConfig.minutes;

      // Determine attendance status
      if (checkInTotalMinutes <= latestCheckIn && checkOutTotalMinutes >= earliestCheckOut) {
        attendance.status = 'present';
      } else if (attendance.workingHours >= locationConfig.workingHours.minimumHoursForHalfDay) {
        attendance.status = 'half-day';
      } else {
        attendance.status = 'absent';
      }

      await attendance.save();
      res.json({
        success: true,
        message: 'Check-out successful',
        attendance,
        workingHours: attendance.workingHours,
        status: attendance.status
        // Location check commented out - no location info in response
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

      // Verify if employee is within office premises
      const locationCheck = this.isWithinOffice(latitude, longitude);
      
      if (!locationCheck.isWithin) {
        return res.status(403).json({ 
          success: false,
          message: `You must be at the office premises to request early checkout`,
          distance: locationCheck.distance,
          distanceKm: (locationCheck.distance / 1000).toFixed(2),
          requiredRadius: this.OFFICE_LOCATION.radiusInMeters
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const attendance = await Attendance.findOne({ employee: employeeId, date: today });
      
      if (!attendance || !attendance.checkInTime) {
        return res.status(404).json({ 
          success: false,
          message: 'No check-in found for today. Please check in first.' 
        });
      }

      if (attendance.checkOutTime) {
        return res.status(400).json({ 
          success: false,
          message: 'Already checked out for today' 
        });
      }

      if (attendance.earlyCheckoutRequest?.requested && 
          attendance.earlyCheckoutRequest?.status === 'pending') {
        return res.status(400).json({ 
          success: false,
          message: 'Early checkout request already submitted and pending approval' 
        });
      }

      attendance.earlyCheckoutRequest = {
        requested: true,
        reason: reason,
        requestedAt: new Date(),
        status: 'pending'
      };
      attendance.status = 'pending-approval';

      await attendance.save();
      
      res.json({
        success: true,
        message: 'Early checkout request submitted successfully. Waiting for HR approval.',
        attendance
        // Location check commented out - no location info in response
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
      const { attendanceId, hrId, approved, latitude, longitude } = req.body;

      const attendance = await Attendance.findById(attendanceId).populate('employee', 'firstName lastName employeeId');
      
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

      if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = new Date(from);
        if (to) filter.date.$lte = new Date(to);
      }

      if (status) {
        filter.status = status;
      }

      if (employeeId) {
        filter.employee = employeeId;
      }

      const records = await Attendance.find(filter)
        .populate('employee', 'employeeId firstName lastName email department designation role')
        .sort({ date: -1, createdAt: -1 });

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
      });
    }
  };
}

module.exports = new AttendanceController();
