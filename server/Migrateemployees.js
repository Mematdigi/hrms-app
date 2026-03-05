/**
 * Migration Script — Add new fields to existing Employee documents
 * 
 * Run once on your server:
 *   node migrateEmployees.js
 * 
 * Place this file in your backend root folder (same level as server.js)
 */

const mongoose = require('mongoose');

// ── Update this with your MongoDB connection string ──────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
// ─────────────────────────────────────────────────────────────────────────────

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('employees');

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