/*
 * Memat Digi Inc. — HRMS
 * One-time migration: backfill new hierarchy fields on existing User records.
 *
 * Run ONCE after deploying the new schema:
 *     cd server && node src/scripts/migrateHierarchy.js
 *
 * ⚠️ After this, restart PM2 (`pm2 restart <app-name>`) — Mongoose schema
 *    changes are only picked up by a fresh process, otherwise new fields get
 *    silently stripped by the running one.
 *
 * What it does:
 *   1. Sets `designationLevel` for every user based on their current `role`:
 *        admin    → 1     hr/manager → 2     tl → 3     employee → 5
 *      (Level 4 = "Senior Employee" is reserved for manual assignment via the
 *       Hierarchy page — the migration never guesses seniority from job titles.)
 *   2. Initialises `teamLead_id` to null where the field is missing.
 *   3. Creates the default ScoringConfig document if it doesn't exist.
 *
 * Idempotent — safe to run more than once. Existing non-default values are
 * never overwritten (pass --force to reset designationLevel from role).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const ScoringConfig = require('../models/ScoringConfig');

const FORCE = process.argv.includes('--force');

const LEVEL_BY_ROLE = {
  admin:    1,
  hr:       2,
  manager:  2,
  tl:       3,
  employee: 5,
};

(async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) throw new Error('MONGODB_URI is not set in .env');

    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    const users = await User.find({}).select('_id role designationLevel teamLead_id');
    console.log(`📋 Found ${users.length} users`);

    let levelUpdates = 0;
    let tlInits = 0;

    for (const user of users) {
      const update = {};

      const needsLevel = FORCE || user.designationLevel === undefined || user.designationLevel === null;
      if (needsLevel) {
        update.designationLevel = LEVEL_BY_ROLE[user.role] ?? 5;
        levelUpdates += 1;
      }

      if (user.teamLead_id === undefined) {
        update.teamLead_id = null;
        tlInits += 1;
      }

      if (Object.keys(update).length) {
        // updateOne (not save) so we don't trigger the password-hash pre-save hook
        await User.updateOne({ _id: user._id }, { $set: update });
      }
    }

    console.log(`✅ designationLevel backfilled on ${levelUpdates} users`);
    console.log(`✅ teamLead_id initialised on ${tlInits} users`);

    const cfg = await ScoringConfig.getConfig();
    console.log(`✅ ScoringConfig ready (id: ${cfg._id})`);

    console.log('\n🎉 Migration complete.');
    console.log('👉 NEXT STEP: pm2 restart <app-name>  — required after any schema change!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
})();
