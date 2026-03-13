// src/jobs/birthdayCron.js
//
// Runs daily at 10:00 AM IST.
// Checks all active employees for today's birthday (by month + day)
// and sends an in-app notification to ALL HR/Admin users.
//
// dateOfBirth is stored in BOTH User and Employee models.
// We query the Employee model since it has the most complete profile data.

const cron = require('node-cron');
const Employee = require('../models/Employee');
const { sendBirthdayNotification } = require('../controllers/Notificationcontroller');

const startBirthdayCron = () => {

  // ── Runs every day at 08:00 AM IST ────────────────────────────────────────
  cron.schedule('0 10 * * *', async () => {
    try {
      const today = new Date();
      const todayMonth = today.getMonth() + 1; // 1–12
      const todayDay   = today.getDate();       // 1–31

      console.log(`🎂 [BirthdayCron] Checking birthdays for ${todayDay}/${todayMonth}...`);

      // ── Fetch all active employees who have a dateOfBirth set ─────────────
 

const employees = await Employee.find({
  isActive: true,
  dateOfBirth: { $exists: true, $ne: null },
  $expr: {
    $and: [
      { $eq: [{ $month: "$dateOfBirth" }, todayMonth] },
      { $eq: [{ $dayOfMonth: "$dateOfBirth" }, todayDay] }
    ]
  }
}).select('_id firstName lastName employeeId department dateOfBirth');
      if (!employees.length) {
        console.log('🎂 [BirthdayCron] No employees found with dateOfBirth.');
        return;
      }

      // ── Filter: whose birthday is TODAY (same month + day, any year) ──────
      const birthdayEmployees = employees.filter(emp => {
  try {
    const dob = new Date(emp.dateOfBirth);
    if (isNaN(dob.getTime())) return false;

    return (
      dob.getUTCMonth() + 1 === todayMonth &&
      dob.getUTCDate() === todayDay
    );
  } catch {
    return false;
  }
});

      if (!birthdayEmployees.length) {
        console.log('🎂 [BirthdayCron] No birthdays today.');
        return;
      }

      // ── Send notification for each birthday employee ───────────────────────
      for (const emp of birthdayEmployees) {
        await sendBirthdayNotification(emp);
        console.log(`🎂 [BirthdayCron] Notified HR → Birthday: ${emp.firstName} ${emp.lastName} (${emp.employeeId})`);
      }

      console.log(`🎂 [BirthdayCron] Done. ${birthdayEmployees.length} birthday(s) notified.`);

    } catch (err) {
      console.error('🎂 [BirthdayCron] Error:', err.message);
    }

  }, {
    timezone: 'Asia/Kolkata', // IST — change if your server is in a different TZ
  });

  console.log('🎂 Birthday cron job started — runs daily at 10:00 AM IST');
};

module.exports = startBirthdayCron;