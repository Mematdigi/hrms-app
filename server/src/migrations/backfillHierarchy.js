/*
 * Memat Digi Inc.
 * backfillHierarchy.js — ONE-TIME migration for the hierarchy/TL feature.
 *
 * Backfills the new User fields so the org chart isn't empty and Mongoose
 * doesn't strip the new fields on existing records:
 *   • designationLevel — derived from the current `role`
 *   • teamLead_id      — left null (assign from the Hierarchy page)
 *   • employmentType   — defaults to 'full-time' where unset
 *
 * Run from the server folder:
 *   node src/migrations/backfillHierarchy.js
 *
 * ⚠️ DEPLOY NOTE: after deploying the schema changes, RESTART PM2
 *    (`pm2 restart <app-name>`) — new Mongoose fields have previously been
 *    silently dropped by the running process when this step was skipped.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const ROLE_TO_LEVEL = {
  admin: 1,     // Admin / Founder
  hr: 2,        // HR / Manager tier
  manager: 2,
  tl: 3,        // Team Lead
  employee: 5,  // Employee / Intern (senior employees can be bumped to 4 manually)
};

(async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    const users = await User.find({});
    let updated = 0;

    for (const user of users) {
      let dirty = false;

      if (user.designationLevel === undefined || user.designationLevel === null) {
        user.designationLevel = ROLE_TO_LEVEL[user.role] || 5;
        dirty = true;
      }
      if (user.teamLead_id === undefined) {
        user.teamLead_id = null;
        dirty = true;
      }
      if (!user.employmentType) {
        user.employmentType = 'full-time';
        dirty = true;
      }

      if (dirty) {
        await user.save();
        updated++;
      }
    }

    console.log(`✅ Backfill complete — ${updated}/${users.length} users updated`);
    console.log('👉 Next: assign Team Leads from the Hierarchy page, then restart PM2.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
})();
