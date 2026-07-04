// src/jobs/birthdayCron.js

const cron = require('node-cron');
const Employee = require('../models/Employee');
const { sendBirthdayNotification } = require('../controllers/Notificationcontroller');

const startBirthdayCron = () => {

  // ── Runs every day at 10:00 AM IST ────────────────────────────────────────
  cron.schedule('8 8 * * *', async () => {
    try {
      const today    = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const getMonthDay = (date) => ({
        month: date.getMonth() + 1,
        day:   date.getDate(),
      });

      const todayMD    = getMonthDay(today);
      const tomorrowMD = getMonthDay(tomorrow);

      console.log(
        `🎂 [BirthdayCron] Checking birthdays for today (${todayMD.day}/${todayMD.month})` +
        ` and tomorrow (${tomorrowMD.day}/${tomorrowMD.month})...`
      );

      // ── 1. Fetch birthday employees (today + tomorrow) ────────────────────
      const birthdayEmployees = await Employee.find({
        isActive: true,
        dateOfBirth: { $exists: true, $ne: null },
        $or: [
          {
            $expr: {
              $and: [
                { $eq: [{ $month: '$dateOfBirth' }, todayMD.month] },
                { $eq: [{ $dayOfMonth: '$dateOfBirth' }, todayMD.day] },
              ],
            },
          },
          {
            $expr: {
              $and: [
                { $eq: [{ $month: '$dateOfBirth' }, tomorrowMD.month] },
                { $eq: [{ $dayOfMonth: '$dateOfBirth' }, tomorrowMD.day] },
              ],
            },
          },
        ],
      }).select('_id firstName lastName employeeId department dateOfBirth');

      if (!birthdayEmployees.length) {
        console.log('🎂 [BirthdayCron] No birthdays today or tomorrow.');
        return;
      }

      // ── 2. Fetch ALL active employees' user IDs (notification recipients) ─
      const allEmployees = await Employee.find({ isActive: true })
        .select('_id user firstName lastName')
        .lean();

      // Build recipient userId list — use emp.user if your Employee model
      // has a `user` ref, otherwise use emp._id directly
      const recipientUserIds = allEmployees
        .map(emp => emp.user ?? emp._id)
        .filter(Boolean);

      if (!recipientUserIds.length) {
        console.log('🎂 [BirthdayCron] No active employees to notify.');
        return;
      }

      // ── 3. Classify birthday employees as today vs eve ────────────────────
      const todayBirthdays    = [];
      const tomorrowBirthdays = [];

      for (const emp of birthdayEmployees) {
        try {
          const dob = new Date(emp.dateOfBirth);
          if (isNaN(dob.getTime())) continue;

          const dobMonth = dob.getUTCMonth() + 1;
          const dobDay   = dob.getUTCDate();

          if (dobMonth === todayMD.month && dobDay === todayMD.day) {
            todayBirthdays.push(emp);
          } else if (dobMonth === tomorrowMD.month && dobDay === tomorrowMD.day) {
            tomorrowBirthdays.push(emp);
          }
        } catch {
          // skip malformed dates
        }
      }

      // ── 4. Send D-0 notifications to everyone ─────────────────────────────
      for (const emp of todayBirthdays) {
        await sendBirthdayNotification(emp, 'today', recipientUserIds);
        console.log(`🎂 [BirthdayCron] [TODAY] Notified all → ${emp.firstName} ${emp.lastName} (${emp.employeeId})`);
      }

      // ── 5. Send D-1 (eve) notifications to everyone ───────────────────────
      for (const emp of tomorrowBirthdays) {
        await sendBirthdayNotification(emp, 'eve', recipientUserIds);
        console.log(`🎉 [BirthdayCron] [EVE]   Notified all → ${emp.firstName} ${emp.lastName} (${emp.employeeId})`);
      }

      console.log(
        `🎂 [BirthdayCron] Done. ` +
        `${todayBirthdays.length} today, ${tomorrowBirthdays.length} eve. ` +
        `${recipientUserIds.length} employees notified each.`
      );

    } catch (err) {
      console.error('🎂 [BirthdayCron] Error:', err.message);
    }

  }, {
    timezone: 'Asia/Kolkata',
  });

  console.log('🎂 Birthday cron job started — runs daily at 10:00 AM IST');
};

module.exports = startBirthdayCron;