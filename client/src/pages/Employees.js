import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { employeeAPI } from '../services/api';

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    department: '',
    designation: '',
    dateOfJoining: '',
    baseSalary: ''
  });
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    designation: '',
    dateOfJoining: '',
    isActive: true,
    baseSalary: ''
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [filters, setFilters] = useState({
    name: '',
    employeeId: '',
    department: 'All Departments',
    designation: 'All Designations'
  });

  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    fetchEmployees();
  }, [filters]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeAPI.getAll();
      const filteredEmployees = response.data.filter((emp) => {
        return (
          (filters.name ? emp.firstName.toLowerCase().includes(filters.name.toLowerCase()) || emp.lastName.toLowerCase().includes(filters.name.toLowerCase()) || emp.email.toLowerCase().includes(filters.name.toLowerCase()) || emp.employeeId.toString().includes(filters.name) : true) &&
          (filters.employeeId ? emp.employeeId.toString().includes(filters.employeeId) : true) &&
          (filters.department !== 'All Departments' ? emp.department?.toLowerCase().includes(filters.department.toLowerCase()) : true) &&
          (filters.designation !== 'All Designations' ? emp.designation?.toLowerCase().includes(filters.designation.toLowerCase()) : true)
        );
      });
      setEmployees(filteredEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setErrorMessage(error?.response?.data?.message || 'Error fetching employees');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData({
      ...editFormData,
      [name]: type === 'checkbox' ? checked : value
    });
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
        baseSalary: ''
      });
      setShowForm(false);
      setSuccessMessage('✅ Employee created successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
      console.log('Employee created:', response.data);
      fetchEmployees();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Error creating employee');
      setTimeout(() => setErrorMessage(''), 5000);
      console.error('Error creating employee:', error);
    }
  };

  const handleEditClick = (employee) => {
    setSelectedEmployee(employee);
    setEditFormData({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      department: employee.department || '',
      designation: employee.designation || '',
      dateOfJoining: employee.dateOfJoining ? employee.dateOfJoining.split('T')[0] : '',
      isActive: employee.isActive,
      baseSalary: employee.baseSalary
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await employeeAPI.update(selectedEmployee._id, editFormData);
      setSuccessMessage('✅ Employee updated successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
      setShowEditModal(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Error updating employee');
      setTimeout(() => setErrorMessage(''), 5000);
      console.error('Error updating employee:', error);
    }
  };

  const handleDelete = async (employeeId, employeeName) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${employeeName}?\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      await employeeAPI.delete(employeeId);
      setSuccessMessage('✅ Employee deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
      fetchEmployees();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Error deleting employee');
      setTimeout(() => setErrorMessage(''), 5000);
      console.error('Error deleting employee:', error);
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedEmployee(null);
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="employees-container">
      {/* Alerts */}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

      <div className="employees-header">
        <h1>Employees</h1>
        {(user?.role === 'admin' || user?.role === 'hr') && (
          <button onClick={() => setShowForm(!showForm)} className="add-btn">
            {showForm ? '✕ Cancel' : '+ Add Employee'}
          </button>
        )}
      </div>

      {/* Filter Section */}
      <div className="filter-section">
        <input
          type="text"
          name="name"
          placeholder="Search by name, email, or employee ID..."
          value={filters.name}
          onChange={handleFilterChange}
        />
        <input
          type="text"
          name="employeeId"
          placeholder="Employee ID"
          value={filters.employeeId}
          onChange={handleFilterChange}
        />
        <select
          name="department"
          value={filters.department}
          onChange={handleFilterChange}
        >
          <option value="All Departments">All Departments</option>
          {/* Add departments dynamically if needed */}
        </select>
        <select
          name="designation"
          value={filters.designation}
          onChange={handleFilterChange}
        >
          <option value="All Designations">All Designations</option>
          {/* Add designations dynamically if needed */}
        </select>
        <button onClick={() => fetchEmployees()} className="apply-filters-btn">
          Apply Filters
        </button>
      </div>

      {/* Add Employee Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="employee-form">
          <h2>Add New Employee</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>First Name *</label>
              <input
                type="text"
                name="firstName"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input
                type="text"
                name="lastName"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Department</label>
              <input
                type="text"
                name="department"
                placeholder="Department"
                value={formData.department}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Designation</label>
              <input
                type="text"
                name="designation"
                placeholder="Designation"
                value={formData.designation}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Date of Joining</label>
              <input
                type="date"
                name="dateOfJoining"
                value={formData.dateOfJoining}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Base of Salary</label>
              <input
                type="text"
                name="baseSalary"
                value={formData.baseSalary}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="submit-btn">Create Employee</button>
            <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Employee</h2>
              <button className="close-btn" onClick={handleCloseEditModal}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit} className="edit-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={editFormData.firstName}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    value={editFormData.lastName}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={editFormData.email}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    name="department"
                    value={editFormData.department}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="form-group">
                  <label>Designation</label>
                  <input
                    type="text"
                    name="designation"
                    value={editFormData.designation}
                    onChange={handleEditChange}
                  />
                </div>

                <div className="form-group">
                  <label>Date of Joining</label>
                  <input
                    type="date"
                    name="dateOfJoining"
                    value={editFormData.dateOfJoining}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="form-group">
                  <label>Base Salary</label>
                  <input
                    type="number"
                    name="baseSalary"
                    value={editFormData.baseSalary} 
                    onChange={handleEditChange}
                  />
                </div>
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={editFormData.isActive}
                      onChange={handleEditChange}
                    />
                    <span>Active Employee</span>
                  </label>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="submit-btn">Update Employee</button>
                <button type="button" className="cancel-btn" onClick={handleCloseEditModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Table */}
      <div className="employees-table">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Employee Id</th>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Status</th>
              <th>Date of Joining</th>
              <th>Base Salary</th>
              {(user?.role === 'admin' || user?.role === 'hr') && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, index) => (
              <tr key={emp._id}>
                <td>{index + 1}</td>
                <td>{`EMP00${emp.employeeId}`}</td>
                <td>{emp.firstName} {emp.lastName}</td>
                <td>{emp.email}</td>
                <td>{emp.department || 'N/A'}</td>
                <td>{emp.designation || 'N/A'}</td>
                <td className={emp.isActive ? "status-active" : "status-inactive"}>
                  {emp.isActive ? 'Active' : 'Inactive'}
                </td>
                <td>{new Date(emp.dateOfJoining).toLocaleDateString()}</td>
                <td>₹{emp.baseSalary || 0}</td>
                {(user?.role === 'admin' || user?.role === 'hr') && (
                  <td className="actions-cell">
                    <button
                      className="action-btn edit-btn"
                      onClick={() => handleEditClick(emp)}
                      title="Edit Employee"
                    >
                      ✏️
                    </button>
                    {user?.role === 'admin' && (
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(emp._id, `${emp.firstName} ${emp.lastName}`)}
                        title="Delete Employee"
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Employees;
