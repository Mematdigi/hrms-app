// src/jobs/scoringJob.js
//
// Nightly scoring recompute + month-end lock, using node-cron
// (same pattern as schedulars.js / Birthdaycron.js).
//
// ⚠️ Deploy note: after any Mongoose schema change, restart PM2
//    (`pm2 restart <app-name>`) or new fields will be silently stripped
//    by the running process.

const cron = require('node-cron');
const moment = require('moment-timezone');
const { recomputeMonthForAll, finalizeMonth } = require('../services/scoring.services');
const { notifyAllEmployees } = require('../controllers/Notificationcontroller');

const TZ = 'Asia/Kolkata';

const startScoringCron = () => {
  // ── Nightly at 11:30 PM IST — recompute current month for every active employee ──
  cron.schedule('30 23 * * *', async () => {
    try {
      const now = moment.tz(TZ);
      console.log('🧮 [ScoringCron] Nightly recompute starting:', now.format('YYYY-MM-DD HH:mm'));
      const count = await recomputeMonthForAll(now.year(), now.month() + 1);
      console.log(`🧮 [ScoringCron] Recomputed MonthlyScore for ${count} employees`);
    } catch (err) {
      console.error('❌ [ScoringCron] nightly recompute failed:', err.message);
    }
  }, { timezone: TZ });

  // ── Month-end at 11:50 PM IST on the last day — finalize, lock, pick Employee of the Month ──
  cron.schedule('50 23 28-31 * *', async () => {
    try {
      const now = moment.tz(TZ);
      const isLastDay = now.date() === now.clone().endOf('month').date();
      if (!isLastDay) return;

      console.log('🏆 [ScoringCron] Month-end finalization starting...');
      const winner = await finalizeMonth(now.year(), now.month() + 1);

      if (winner && winner.employee) {
        const fullName = `${winner.employee.firstName} ${winner.employee.lastName}`;
        await notifyAllEmployees({
          sender:   winner.employee._id,
          type:     'employee_of_month',
          title:    `🏆 Employee of the Month — ${fullName}`,
          message:  `Congratulations to ${fullName} (${winner.totalPoints}/100 pts) for winning Employee of the Month for ${now.format('MMMM YYYY')}! 🎉`,
          refId:    winner._id,
          refModel: 'MonthlyScore',
          meta:     { month: now.month() + 1, year: now.year(), totalPoints: winner.totalPoints },
        });
        console.log(`🏆 [ScoringCron] Employee of the Month: ${fullName} (${winner.totalPoints} pts)`);
      }
    } catch (err) {
      console.error('❌ [ScoringCron] month-end finalization failed:', err.message);
    }
  }, { timezone: TZ });

  console.log('🧮 Scoring cron registered (nightly 23:30 + month-end 23:50 IST)');
};

module.exports = startScoringCron;
