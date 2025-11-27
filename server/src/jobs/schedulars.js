const cron = require("node-cron");
const moment = require("moment-timezone");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const User = require("../models/User");

const startAttendanceStatusCron = async () => {
  // Run daily at 11:59 PM IST (23:59) to process the day's attendance
  // Skip on Sundays and 2nd & 4th Saturdays
//   cron.schedule("59 23 * * *", async () => {
    const today = moment.tz("Asia/Kolkata");
    const dayOfWeek = today.day(); // 0 = Sunday, 6 = Saturday
    const dateOfMonth = today.date();
    
    // Skip if Sunday
    if (dayOfWeek === 0) {
      console.log("⏭️ Skipping attendance processing - Sunday");
      return;
    }
    
    // Skip if 2nd or 4th Saturday
    if (dayOfWeek === 6) {
      const weekOfMonth = Math.ceil(dateOfMonth / 7);
      if (weekOfMonth === 2 || weekOfMonth === 4) {
        console.log(`⏭️ Skipping attendance processing - ${weekOfMonth === 2 ? '2nd' : '4th'} Saturday`);
        return;
      }
    }

    console.log("🕛 Attendance Status Cron job running at:", today.format('YYYY-MM-DD HH:mm:ss'));

    // Get today's date in IST (start and end of day)
    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();
    const todayDateOnly = moment.tz("Asia/Kolkata").format("YYYY-MM-DD");

    // Define office timings
    const lateArrivalTime = moment.tz("Asia/Kolkata").set({ hour: 9, minute: 40, second: 0 });
    const minCheckoutTime = moment.tz("Asia/Kolkata").set({ hour: 18, minute: 30, second: 0 }); // 6:30 PM
    const minWorkingHours = 4;

    try {
      // Fetch all active employees
      const activeEmployees = await User.find({ isActive: true }).select("_id firstName lastName email employeeId");
      
      console.log(`👥 Found ${activeEmployees.length} active employees to process for ${todayDateOnly}`);

      let presentCount = 0;
      let halfDayCount = 0;
      let leaveCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let createdCount = 0;
      let skippedCount = 0;

      await Promise.all(
        activeEmployees.map(async (employee) => {
          try {
            // Check if attendance record exists for today
            let attendanceRecord = await Attendance.findOne({
              employee: employee._id,
              date: {
                $gte: todayStart,
                $lte: todayEnd
              }
            });

            // If no attendance record exists, create one
            if (!attendanceRecord) {
              attendanceRecord = new Attendance({
                employee: employee._id,
                date: todayStart,
                status: 'working', // Default to working (will be processed)
                workingHours: 0
              });
              createdCount++;
              console.log(`📝 Created new attendance record for ${employee.firstName} ${employee.lastName}`);
            }

            // Check if already finalized (present, half-day, leave, or absent with notes)
            if (attendanceRecord.status === 'present' || 
                attendanceRecord.status === 'half-day' || 
                attendanceRecord.status === 'leave' ||
                (attendanceRecord.status === 'absent' && attendanceRecord.notes && attendanceRecord.notes !== '')) {
              skippedCount++;
              console.log(`⏭️ ${employee.firstName} ${employee.lastName} already finalized as ${attendanceRecord.status.toUpperCase()} - skipping update`);
              return; // Skip further processing for finalized records
            }

            // Check if employee has approved leave for today
            const hasLeave = await Leave.findOne({
              employee: employee._id,
              status: 'approved',
              startDate: { $lte: todayEnd },
              endDate: { $gte: todayStart }
            });

            if (hasLeave) {
              // Employee is on approved leave
              attendanceRecord.status = 'leave';
              attendanceRecord.workingHours = 0;
              attendanceRecord.checkInTime = null;
              attendanceRecord.checkOutTime = null;
              attendanceRecord.notes = `Leave: ${hasLeave.leaveType} (${hasLeave.reason || 'No reason provided'})`;
              attendanceRecord.updatedAt = new Date();
              await attendanceRecord.save();
              
              leaveCount++;
              console.log(`🏖️ ${employee.firstName} ${employee.lastName} marked as LEAVE (${hasLeave.leaveType})`);
            } else if (attendanceRecord.checkInTime && attendanceRecord.checkOutTime) {
              // Both check-in and check-out exist - calculate working hours
              const checkIn = moment(attendanceRecord.checkInTime);
              const checkOut = moment(attendanceRecord.checkOutTime);
              const hoursWorked = checkOut.diff(checkIn, "hours", true);
              
              attendanceRecord.workingHours = parseFloat(hoursWorked.toFixed(2));
              
              let statusNotes = [];
              
              // Check if late arrival (after 9:40 AM)
              const isLate = checkIn.isAfter(lateArrivalTime);
              if (isLate) {
                const lateBy = checkIn.diff(lateArrivalTime, "minutes");
                statusNotes.push(`Late by ${lateBy} minutes`);
                lateCount++;
                
                // Check for 3 consecutive late days in last 3 working days
                const threeDaysAgo = moment.tz("Asia/Kolkata").subtract(5, "days").startOf("day").toDate();
                const recentAttendance = await Attendance.find({
                  employee: employee._id,
                  date: { $gte: threeDaysAgo, $lt: todayStart },
                  status: { $ne: 'leave' }
                }).sort({ date: -1 }).limit(3);
                
                // Count late arrivals in recent days
                const recentLateCount = recentAttendance.filter(att => {
                  if (att.checkInTime) {
                    const attCheckIn = moment(att.checkInTime);
                    const attLateTime = moment(att.date).set({ hour: 9, minute: 40, second: 0 });
                    return attCheckIn.isAfter(attLateTime);
                  }
                  return false;
                }).length;
                
                // If late for 3rd consecutive working day, mark absent
                if (recentLateCount >= 2) {
                  attendanceRecord.status = 'absent';
                  attendanceRecord.workingHours = 0;
                  statusNotes.push(`Marked absent - 3rd consecutive late arrival`);
                  attendanceRecord.notes = statusNotes.join(' | ');
                  attendanceRecord.updatedAt = new Date();
                  await attendanceRecord.save();
                  absentCount++;
                  console.log(`❌ ${employee.firstName} ${employee.lastName} marked ABSENT (3rd late day in a row)`);
                  return; // Skip further processing
                }
              }
              
              // Check if early checkout (before 6:30 PM) and less than 4 hours
              const isEarlyCheckout = checkOut.isBefore(minCheckoutTime);
              if (isEarlyCheckout && hoursWorked < minWorkingHours) {
                attendanceRecord.status = 'half-day';
                statusNotes.push(`Early checkout before 6:30 PM with ${hoursWorked.toFixed(2)} hours`);
                halfDayCount++;
              } else if (hoursWorked >= 8) {
                attendanceRecord.status = 'present';
                presentCount++;
              } else if (hoursWorked >= minWorkingHours) {
                attendanceRecord.status = 'half-day';
                halfDayCount++;
              } else {
                attendanceRecord.status = 'absent';
                statusNotes.push(`Insufficient hours: ${hoursWorked.toFixed(2)}`);
                absentCount++;
              }
              
              attendanceRecord.notes = statusNotes.length > 0 
                ? statusNotes.join(' | ') 
                : `Auto-processed: ${hoursWorked.toFixed(2)} hours worked`;
              
              attendanceRecord.updatedAt = new Date();
              await attendanceRecord.save();
              console.log(`✅ ${employee.firstName} ${employee.lastName} marked as ${attendanceRecord.status.toUpperCase()} (${hoursWorked.toFixed(2)} hrs)${isLate ? ' - LATE' : ''}`);
            } else if (attendanceRecord.checkInTime && !attendanceRecord.checkOutTime) {
              // Checked in but not checked out - MARK AS ABSENT
              const checkInMoment = moment(attendanceRecord.checkInTime);
              
              let statusNotes = ['No checkout recorded'];
              
              // Check if late arrival
              const isLate = checkInMoment.isAfter(lateArrivalTime);
              if (isLate) {
                const lateBy = checkInMoment.diff(lateArrivalTime, "minutes");
                statusNotes.push(`Late by ${lateBy} minutes`);
                lateCount++;
                
                // Check for 3 consecutive late days
                const threeDaysAgo = moment.tz("Asia/Kolkata").subtract(5, "days").startOf("day").toDate();
                const recentAttendance = await Attendance.find({
                  employee: employee._id,
                  date: { $gte: threeDaysAgo, $lt: todayStart },
                  status: { $ne: 'leave' }
                }).sort({ date: -1 }).limit(3);
                
                const recentLateCount = recentAttendance.filter(att => {
                  if (att.checkInTime) {
                    const attCheckIn = moment(att.checkInTime);
                    const attLateTime = moment(att.date).set({ hour: 9, minute: 40, second: 0 });
                    return attCheckIn.isAfter(attLateTime);
                  }
                  return false;
                }).length;
                
                if (recentLateCount >= 2) {
                  statusNotes.push(`3rd consecutive late arrival`);
                }
              }
              
              // Mark as ABSENT if forgot to checkout
              attendanceRecord.status = 'absent';
              attendanceRecord.workingHours = 0;
              statusNotes.push(`Marked absent - forgot to checkout`);
              attendanceRecord.notes = statusNotes.join(' | ');
              attendanceRecord.updatedAt = new Date();
              await attendanceRecord.save();
              absentCount++;
              
              console.log(`❌ ${employee.firstName} ${employee.lastName} marked ABSENT (forgot to checkout)${isLate ? ' - LATE' : ''}`);
            } else {
              // No check-in, no check-out, no leave = ABSENT
              attendanceRecord.status = 'absent';
              attendanceRecord.workingHours = 0;
              attendanceRecord.checkInTime = null;
              attendanceRecord.checkOutTime = null;
              attendanceRecord.notes = 'No attendance recorded';
              attendanceRecord.updatedAt = new Date();
              await attendanceRecord.save();
              absentCount++;
              
              console.log(`❌ ${employee.firstName} ${employee.lastName} marked as ABSENT (no check-in/out, no leave)`);
            }

          } catch (error) {
            console.error(`❌ Failed to process attendance for ${employee.firstName} ${employee.lastName} (ID: ${employee._id}):`, error);
          }
        })
      );

      console.log(`\n📈 Attendance Status Update Summary for ${todayDateOnly}:`);
      console.log(`   👥 Total Employees Processed: ${activeEmployees.length}`);
      console.log(`   📝 New Records Created: ${createdCount}`);
      console.log(`   ⏭️ Already Finalized (Skipped): ${skippedCount}`);
      console.log(`   ✅ Present: ${presentCount}`);
      console.log(`   ⏰ Half-Day: ${halfDayCount}`);
      console.log(`   ⏱️ Late Arrivals: ${lateCount}`);
      console.log(`   🏖️ On Leave: ${leaveCount}`);
      console.log(`   ❌ Absent: ${absentCount}`);
      console.log(`   🔢 Total: ${presentCount + halfDayCount + leaveCount + absentCount}\n`);

    } catch (error) {
      console.error("❌ Attendance Status Cron job error:", error);
    }
//   }, {
//     timezone: "Asia/Kolkata"
//   });

  console.log("✅ Attendance Status Cron job scheduled to run daily at 11:59 PM IST (excluding Sundays and 2nd/4th Saturdays)");
};

module.exports = startAttendanceStatusCron;