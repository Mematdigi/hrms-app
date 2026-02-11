const axios = require('axios');

const BASE_URL = 'http://localhost:5000/v1';

async function testAttendanceAPI() {
  try {
    console.log('=== Testing Attendance API ===\n');

    // 1. Register Test User
    console.log('1. Registering Test User...');
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@test.com',
      password: 'password123',
      role: 'employee'
    });
    console.log('Registration Response:', registerResponse.data);
    const userId = registerResponse.data.data.user.id;
    const token = registerResponse.data.data.token;
    console.log('User ID:', userId);
    console.log('Token:', token.substring(0, 50) + '...');

    // 2. Test Check-in
    console.log('\n2. Testing Check-in...');
    const checkInResponse = await axios.post(`${BASE_URL}/attendance/check-in`, {
      employeeId: userId,
      latitude: 28.570419,
      longitude: 77.453722
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Check-in Response:', checkInResponse.data);

    // 3. Test Check-out
    console.log('\n3. Testing Check-out...');
    const checkOutResponse = await axios.post(`${BASE_URL}/attendance/check-out`, {
      employeeId: userId,
      latitude: 28.570419,
      longitude: 77.453722
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Check-out Response:', checkOutResponse.data);

    // 4. Test Get Attendance List (HR view)
    console.log('\n4. Testing Get Attendance List...');
    const currentDate = new Date();
    const attendanceListResponse = await axios.get(`${BASE_URL}/attendance/attendance_list`, {
      params: {
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear()
      },
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Attendance List Response:', attendanceListResponse.data);

    // 5. Test Get Employee Attendance
    console.log('\n5. Testing Get Employee Attendance...');
    const employeeAttendanceResponse = await axios.get(`${BASE_URL}/attendance`, {
      params: { employeeId: userId },
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Employee Attendance Response:', employeeAttendanceResponse.data);

    console.log('\n=== All Attendance Tests Passed! ===');

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testAttendanceAPI();
