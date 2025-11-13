import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { employeeAPI } from '../services/api';
import '../styles/Employees.css';

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    department: '',
    designation: '',
    dateOfJoining: '',
  });
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      
      const response = await employeeAPI.getAll();
      console.log('Fetched employees: ', response.data);
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
     const response = await employeeAPI.create(formData);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        department: '',
        designation: '',
        dateOfJoining: '',
      });
      setShowForm(false);
      console.log('Employee created:', response.data);
      fetchEmployees();
    } catch (error) {
      // alert(response?.data?.message || 'Error creating employee');
      console.error('Error creating employee:', error);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  return (
    <div className="employees-container">
      <div className="employees-header">
        <h1>Employees</h1>
        {(user?.role === 'admin' || user?.role === 'hr') && (
          <button onClick={() => setShowForm(!showForm)} className="add-btn">
            {showForm ? 'Cancel' : 'Add Employee'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="employee-form">
          <input
            type="text"
            name="firstName"
            placeholder="First Name"
            value={formData.firstName}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="lastName"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="department"
            placeholder="Department"
            value={formData.department}
            onChange={handleChange}
          />
          <input
            type="text"
            name="designation"
            placeholder="Designation"
            value={formData.designation}
            onChange={handleChange}
          />
          <input
            type="date"
            name="dateOfJoining"
            placeholder="Date of Joining"
            value={formData.dateOfJoining}
            onChange={handleChange}
          />
          <button type="submit">Create Employee</button>
        </form>
      )}

      <div className="employees-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp._id}>
                <td>{emp.firstName} {emp.lastName}</td>
                <td>{emp.email}</td>
                <td>{emp.department || 'N/A'}</td>
                <td>{emp.designation || 'N/A'}</td>
                <td>{emp.isActive ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
  }

export default Employees;
