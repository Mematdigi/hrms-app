const axios = require('axios');

const BASE_URL = 'http://localhost:5000/v1';

// Note: Holiday routes don't require authentication based on the code

// Test 1: Get All Holidays (should be empty initially)
async function testGetHolidays() {
  console.log('\n=== TEST 1: Get All Holidays ===');
  try {
    const response = await axios.get(`${BASE_URL}/holidays?year=2026`);
    
    const data = response.data;
    console.log('✅ Holidays retrieved successfully!');
    console.log('Total holidays:', data.count || data.holidays?.length || 0);
    
    if (data.holidays && data.holidays.length > 0) {
      console.log('Sample holidays:');
      data.holidays.slice(0, 3).forEach(h => {
        console.log(`  - ${h.name}: ${new Date(h.date).toISOString().slice(0, 10)}`);
      });
    }
    return true;
  } catch (error) {
    console.error('❌ Get Holidays failed:', error.response?.data || error.message);
    return false;
  }
}

// Test 2: Create Single Holiday
async function testCreateHoliday() {
  console.log('\n=== TEST 2: Create Single Holiday ===');
  try {
    const holidayData = {
      name: 'New Year',
      date: '2026-01-01',
      description: 'New Year Day Celebration'
    };

    const response = await axios.post(`${BASE_URL}/holidays`, holidayData, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('✅ Holiday created successfully!');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Create Holiday failed:', error.response?.data || error.message);
    return false;
  }
}

// Test 3: Get Holiday Stats
async function testGetHolidayStats() {
  console.log('\n=== TEST 3: Get Holiday Stats ===');
  try {
    const response = await axios.get(`${BASE_URL}/holidays/stats?year=2026`);

    console.log('✅ Holiday stats retrieved!');
    console.log('Stats:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Get Stats failed:', error.response?.data || error.message);
    return false;
  }
}

// Test 4: Check if a date is a holiday
async function testCheckHoliday() {
  console.log('\n=== TEST 4: Check if Date is Holiday ===');
  try {
    const response = await axios.get(`${BASE_URL}/holidays/check?date=2026-01-01`);

    console.log('✅ Holiday check result:');
    console.log('  Is Holiday:', response.data.isHoliday);
    console.log('  Holiday Details:', response.data.holiday);
    return true;
  } catch (error) {
    console.error('❌ Check Holiday failed:', error.response?.data || error.message);
    return false;
  }
}

// Test 5: Check non-holiday date
async function testCheckNonHoliday() {
  console.log('\n=== TEST 5: Check Non-Holiday Date ===');
  try {
    const response = await axios.get(`${BASE_URL}/holidays/check?date=2026-02-15`);

    console.log('✅ Non-holiday check result:');
    console.log('  Is Holiday:', response.data.isHoliday);
    console.log('  Holiday Details:', response.data.holiday);
    return true;
  } catch (error) {
    console.error('❌ Check Holiday failed:', error.response?.data || error.message);
    return false;
  }
}

// Test 6: Update Holiday
async function testUpdateHoliday() {
  console.log('\n=== TEST 6: Update Holiday ===');
  try {
    // First get all holidays to find one to update
    const getResponse = await axios.get(`${BASE_URL}/holidays?year=2026`);
    
    const holidays = getResponse.data.holidays || [];
    if (holidays.length === 0) {
      console.log('⚠️ No holidays to update, skipping...');
      return false;
    }
    
    const holidayId = holidays[0]._id;
    
    const updateData = {
      name: 'New Year Day (Updated)',
      description: 'Updated description'
    };

    const response = await axios.put(`${BASE_URL}/holidays/${holidayId}`, updateData, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('✅ Holiday updated successfully!');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Update Holiday failed:', error.response?.data || error.message);
    return false;
  }
}

// Test 7: Delete Holiday (Soft Delete)
async function testDeleteHoliday() {
  console.log('\n=== TEST 7: Delete Holiday (Soft Delete) ===');
  try {
    // First get all holidays to find one to delete
    const getResponse = await axios.get(`${BASE_URL}/holidays?year=2026`);
    
    const holidays = getResponse.data.holidays || [];
    if (holidays.length === 0) {
      console.log('⚠️ No holidays to delete, skipping...');
      return false;
    }
    
    const holidayId = holidays[0]._id;

    const response = await axios.delete(`${BASE_URL}/holidays/${holidayId}`);

    console.log('✅ Holiday deleted (deactivated) successfully!');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Delete Holiday failed:', error.response?.data || error.message);
    return false;
  }
}

// Test 8: Create Multiple Holidays (Date Range)
async function testCreateHolidayRange() {
  console.log('\n=== TEST 8: Create Holiday with Date Range ===');
  try {
    const holidayData = {
      name: 'Diwali Festival',
      date: '1st November 2026 - 3rd November 2026',
      description: 'Diwali Celebration'
    };

    const response = await axios.post(`${BASE_URL}/holidays`, holidayData, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('✅ Holiday range created successfully!');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Create Holiday Range failed:', error.response?.data || error.message);
    return false;
  }
}

// Test 9: Get Holiday by ID
async function testGetHolidayById() {
  console.log('\n=== TEST 9: Get Holiday By ID ===');
  try {
    // First get all holidays
    const getResponse = await axios.get(`${BASE_URL}/holidays?year=2026`);
    
    const holidays = getResponse.data.holidays || [];
    if (holidays.length === 0) {
      console.log('⚠️ No holidays found, skipping...');
      return false;
    }
    
    const holidayId = holidays[0]._id;
    
    const response = await axios.get(`${BASE_URL}/holidays/${holidayId}`);

    console.log('✅ Holiday by ID retrieved!');
    console.log('Holiday:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Get Holiday By ID failed:', error.response?.data || error.message);
    return false;
  }
}

// Test 10: Create more holidays for testing
async function testCreateMoreHolidays() {
  console.log('\n=== TEST 10: Create More Holidays ===');
  try {
    const holidays = [
      { name: 'Republic Day', date: '2026-01-26', description: 'Republic Day of India' },
      { name: 'Independence Day', date: '2026-08-15', description: 'Independence Day of India' },
      { name: 'Christmas', date: '2026-12-25', description: 'Christmas Day' },
      { name: 'Holi', date: '2026-03-15', description: 'Holi Festival' },
      { name: 'Good Friday', date: '2026-04-03', description: 'Good Friday' }
    ];

    for (const holiday of holidays) {
      try {
        await axios.post(`${BASE_URL}/holidays`, holiday, {
          headers: { 'Content-Type': 'application/json' }
        });
        console.log(`  ✅ Created: ${holiday.name}`);
      } catch (err) {
        if (err.response?.status === 409) {
          console.log(`  ⚠️ Already exists: ${holiday.name}`);
        } else {
          console.log(`  ❌ Failed: ${holiday.name} - ${err.message}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Create More Holidays failed:', error.response?.data || error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('========================================');
  console.log('  HRMS Holiday Calendar Test Suite      ');
  console.log('========================================');

  const results = [];

  // Test Get Holidays
  results.push({ name: 'Get All Holidays', passed: await testGetHolidays() });

  // Test Create Holiday
  results.push({ name: 'Create Single Holiday', passed: await testCreateHoliday() });

  // Test Get Stats
  results.push({ name: 'Get Holiday Stats', passed: await testGetHolidayStats() });

  // Test Check Holiday
  results.push({ name: 'Check Holiday', passed: await testCheckHoliday() });

  // Test Check Non-Holiday
  results.push({ name: 'Check Non-Holiday', passed: await testCheckNonHoliday() });

  // Test Get by ID
  results.push({ name: 'Get Holiday By ID', passed: await testGetHolidayById() });

  // Test Update Holiday
  results.push({ name: 'Update Holiday', passed: await testUpdateHoliday() });

  // Test Create Holiday Range
  results.push({ name: 'Create Holiday Range', passed: await testCreateHolidayRange() });

  // Test Delete Holiday
  results.push({ name: 'Delete Holiday', passed: await testDeleteHoliday() });

  // Test Create More Holidays
  results.push({ name: 'Create More Holidays', passed: await testCreateMoreHolidays() });

  // Final Get to see all holidays
  console.log('\n=== Final Holiday List ===');
  await testGetHolidays();

  // Print Summary
  console.log('\n========================================');
  console.log('            TEST SUMMARY               ');
  console.log('========================================');
  
  let passed = 0;
  let failed = 0;
  
  results.forEach(r => {
    if (r.passed) {
      passed++;
      console.log(`✅ ${r.name}`);
    } else {
      failed++;
      console.log(`❌ ${r.name}`);
    }
  });
  
  console.log('----------------------------------------');
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================');
}

runAllTests();
