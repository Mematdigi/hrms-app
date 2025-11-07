const Attendance = require('../models/Attendance');

exports.checkIn = async (req, res) => {
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
        status: 'present'
      });
    } else if (!attendance.checkInTime) {
      attendance.checkInTime = new Date();
      attendance.status = 'present';
    }

    await attendance.save();
    res.json({ message: 'Check-in successful', attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({ employee: employeeId, date: today });
    
    if (!attendance) {
      return res.status(404).json({ message: 'No check-in found for today' });
    }

    attendance.checkOutTime = new Date();
    
    if (attendance.checkInTime) {
      const hours = (attendance.checkOutTime - attendance.checkInTime) / (1000 * 60 * 60);
      attendance.workingHours = parseFloat(hours.toFixed(2));
    }

    await attendance.save();
    res.json({ message: 'Check-out successful', attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAttendance = async (req, res) => {
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

exports.markAttendance = async (req, res) => {
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
