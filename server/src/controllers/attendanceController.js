const Attendance = require('../models/Attendance');

class AttendanceCoutroller{
checkIn = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({ employee: employeeId, date: today });
    
    if (!attendance) {
      attendance = new Attendance({
        employee: employeeId,
        date: today,
        checkInTime: new Date(),
        status: 'working'
      });
      
    } else if (!attendance.checkInTime) {
      attendance.checkInTime = new Date();
      attendance.status = 'working';
    }

    await attendance.save();
    res.json({ message: 'Check-in successful', attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

checkOut = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({ employee: employeeId, date: today });
    
    if (!attendance) {
      return res.status(404).json({ message: 'No check-in found for today' });
    }

    attendance.checkOutTime = new Date();
    
    // Calculate working hours
    if (attendance.checkInTime) {
      const hours = (attendance.checkOutTime - attendance.checkInTime) / (1000 * 60 * 60);
      attendance.workingHours = parseFloat(hours.toFixed(2));
    }

    // Extract hours and minutes for time comparison
    const checkInHours = attendance.checkInTime.getHours();
    const checkInMinutes = attendance.checkInTime.getMinutes();
    const checkOutHours = attendance.checkOutTime.getHours();
    const checkOutMinutes = attendance.checkOutTime.getMinutes();

    // Convert to comparable format (9:40 AM = 9*60 + 40 = 580 minutes, 6:30 PM = 18*60 + 30 = 1110 minutes)
    const checkInTotalMinutes = checkInHours * 60 + checkInMinutes;
    const checkOutTotalMinutes = checkOutHours * 60 + checkOutMinutes;
    const latestCheckIn = 9 * 60 + 40; // 9:40 AM
    const earliestCheckOut = 14 * 60 + 30; // 6:30 PM

    // Determine attendance status
   
     if (checkInTotalMinutes <= latestCheckIn && checkOutTotalMinutes >= earliestCheckOut) 
      {
      attendance.status = 'present';
    } else if (attendance.workingHours >= 5) {
      attendance.status = 'half-day';
    } else {
      attendance.status = 'absent';
    }

    await attendance.save();
    res.json({ message: 'Check-out successful', attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

getAttendance = async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const query = { employee: employeeId };

    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const attendance = await Attendance.find(query).populate('employee', 'firstName lastName');
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

markAttendance = async (req, res) => {
  try {
    const { employeeId, date, status } = req.body;
    
    const attendance = await Attendance.findOneAndUpdate(
      { employee: employeeId, date: new Date(date) },
      { status },
      { new: true, upsert: true }
    );

    res.json({ message: 'Attendance marked successfully', attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

getAttendanceList = async (req, res) => {
  try {
    const { from, to, status, employeeId } = req.query;

    const filter = {};

    // Date range filter
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Specific employee filter
    if (employeeId) {
      filter.employee = employeeId;
    }

    const records = await Attendance.find(filter)
      .populate('employee', 'employeeId firstName lastName email department designation role') // adjust fields as per User model
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

module.exports = new AttendanceCoutroller();