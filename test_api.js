const axios = require('axios');

const BASE_URL = 'http://localhost:5000/v1';

async function testAPI() {
  try {
    console.log('=== Testing HRMS API ===\n');

    // 1. Register Test User
    console.log('1. Registering Test User...');
    const registerResponse = await axios.post(`${BASE_URL}/register`, {
      firstName: 'Test',
      lastName: 'Test',
      email: 'test@test.com',
      password: 'password123',
      role: 'employee'
    });
    console.log('Registration Response:', registerResponse.data);
    const userId = registerResponse.data.data.user.id;
    const token = registerResponse.data.data.token;
    console.log('User ID:', userId);
    console.log('Token:', token.substring(0, 50) + '...');

    // 2. Login
    console.log('\n2. Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/login`, {
      email: 'test@test.com',
      password: 'password123'
    });
    console.log('Login Response:', loginResponse.data);

    // 3. Get Employee Details
    console.log('\n3. Getting Employee Details...');
    const getResponse = await axios.get(`${BASE_URL}/employees/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Employee Details:', getResponse.data);

    // 4. Deactivate Employee
    console.log('\n4. Deactivating Employee...');
    const deactivateResponse = await axios.put(`${BASE_URL}/employees/${userId}`, {
      isActive: false
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Deactivate Response:', deactivateResponse.data);

    // 5. Check if deactivated
    console.log('\n5. Checking if deactivated...');
    const checkDeactivated = await axios.get(`${BASE_URL}/employees/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Employee after deactivation:', checkDeactivated.data);

    // 6. Reactivate Employee
    console.log('\n6. Reactivating Employee...');
    const reactivateResponse = await axios.put(`${BASE_URL}/employees/${userId}`, {
      isActive: true
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Reactivate Response:', reactivateResponse.data);

    // 7. Check if reactivated
    console.log('\n7. Checking if reactivated...');
    const checkReactivated = await axios.get(`${BASE_URL}/employees/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Employee after reactivation:', checkReactivated.data);

    // 8. Delete Employee
    console.log('\n8. Deleting Employee...');
    const deleteResponse = await axios.delete(`${BASE_URL}/employees/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Delete Response:', deleteResponse.data);

    // 9. Try to get deleted employee
    console.log('\n9. Trying to get deleted employee...');
    try {
      const getDeleted = await axios.get(`${BASE_URL}/employees/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Employee after deletion:', getDeleted.data);
    } catch (error) {
      console.log('Expected error after deletion:', error.response.data);
    }

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testAPI();
