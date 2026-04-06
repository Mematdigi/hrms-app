/**
 * HRMS Migration: Create Employee Records for Admin/HR Users
 * 
 * Creates minimal Employee docs for existing admin/hr users in User collection
 * 
 * Run: node server/Migrateemployees.js
 */

const mongoose = require('mongoose');

// ── Update this with your MongoDB connection string ──────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
// ─────────────────────────────────────────────────────────────────────────────

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const User = require('./src/models/User');
    const Employee = require('./src/models/Employee');
    const { encryptEmployee } = require('./src/utils/encryption');

    console.log('🔍 Finding admin/HR users without Employee records...');

    // Count how many need updating
    const total = await collection.countDocuments();
    console.log(`📊 Total employee documents: ${total}`);

    // Add all new fields only if they don't already exist ($setOnInsert won't work here,
    // use $set with the condition that the field doesn't exist)
    const result = await collection.updateMany(
      {}, // all documents
      {
        $set: {
          // Personal Info
          currentAddress:           '',
          dateOfBirth:              null,
          lastWorkingDay:           null,
          gender:                   '',
          maritalStatus:            '',
          nationality:              '',

          // Contact
          personalEmail:            '',

          // Identity
          panNumber:                '',
          aadharNumber:             '',
        }
      },
      { upsert: false }
    );

    console.log(`✅ Migration complete!`);
    console.log(`   Matched:  ${result.matchedCount} documents`);
    console.log(`   Modified: ${result.modifiedCount} documents`);

    // Verify — show a sample updated doc
    const sample = await collection.findOne({});
    if (sample) {
      console.log('\n📋 Sample document fields after migration:');
      const newFields = ['currentAddress', 'dateOfBirth', 'lastWorkingDay', 'gender', 'maritalStatus', 'nationality', 'panNumber', 'aadharNumber'];
      newFields.forEach(field => {
        console.log(`   ${field}: ${JSON.stringify(sample[field])}`);
      });
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

migrate();