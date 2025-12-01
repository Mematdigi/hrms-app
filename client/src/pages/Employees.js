import React, { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { employeeAPI } from '../services/api'; // Ensure this path is correct

function Employees() {
  // --- State Management ---
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // --- Search & Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterJoinDate, setFilterJoinDate] = useState('');

  // --- Modal & Form State ---
  const [showForm, setShowForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // --- Form Data ---
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

  const { user } = useSelector((state) => state.auth);

  // --- Effects ---
  useEffect(() => {
    fetchEmployees();
  }, []);

  // --- API Functions ---
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeAPI.getAll();
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setErrorMessage(error?.response?.data?.message || 'Error fetching employees');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await employeeAPI.create(formData);
      setSuccessMessage('✅ Employee created successfully!');
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
      fetchEmployees();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Error creating employee');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await employeeAPI.update(selectedEmployee._id, editFormData);
      setSuccessMessage('✅ Employee updated successfully!');
      setShowEditModal(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Error updating employee');
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
      fetchEmployees();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Error deleting employee');
    }
  };

  // --- Helper Functions ---
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

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

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedEmployee(null);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterDepartment('');
    setFilterDesignation('');
    setFilterStatus('');
    setFilterJoinDate('');
  };

  // --- Real-time Filtering Logic ---
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // 1. Search Logic
      const searchLower = searchQuery.toLowerCase();
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const matchesSearch = 
        fullName.includes(searchLower) ||
        emp.email.toLowerCase().includes(searchLower) ||
        (emp.employeeId && emp.employeeId.toString().includes(searchLower));

      // 2. Department Filter
      const matchesDept = filterDepartment 
        ? emp.department?.toLowerCase() === filterDepartment.toLowerCase() 
        : true;

      // 3. Designation Filter
      const matchesDesig = filterDesignation
        ? emp.designation?.toLowerCase() === filterDesignation.toLowerCase()
        : true;

      // 4. Status Filter
      const matchesStatus = filterStatus
        ? (filterStatus === 'active' ? emp.isActive : !emp.isActive)
        : true;

      // 5. Join Date Filter (Compares YYYY-MM-DD string)
      const matchesDate = filterJoinDate
        ? (emp.dateOfJoining && emp.dateOfJoining.startsWith(filterJoinDate))
        : true;

      return matchesSearch && matchesDept && matchesDesig && matchesStatus && matchesDate;
    });
  }, [employees, searchQuery, filterDepartment, filterDesignation, filterStatus, filterJoinDate]);

  // Extract unique values for dropdowns
  const uniqueDepartments = useMemo(() => {
    const depts = employees.map(e => e.department).filter(Boolean);
    return [...new Set(depts)];
  }, [employees]);

  const uniqueDesignations = useMemo(() => {
    const desigs = employees.map(e => e.designation).filter(Boolean);
    return [...new Set(desigs)];
  }, [employees]);


  if (loading) return <div className="loading">Loading Employees...</div>;

  return (
    <div className="employees-container">
      {/* Alerts */}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

      <div className="employees-header">
        <h1>Employees Directory</h1>
        {(user?.role === 'admin' || user?.role === 'hr') && (
          <button onClick={() => setShowForm(!showForm)} className="add-btn">
            {showForm ? '✕ Cancel' : '+ Add Employee'}
          </button>
        )}
      </div>

      {/* --- Controls Section (All in one line) --- */}
      <div className="controls-section" style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px', 
        flexWrap: 'wrap', 
        alignItems: 'center' 
      }}>
        
        {/* Search */}
        <div className="" style={{ flex: '2', minWidth: '200px' }}>
          <input
            type="text"
            placeholder="🔍 Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          />
        </div>
        
        {/* Department Filter */}
        <div className="filter-box" style={{ flex: '1', minWidth: '150px' }}>
          <select 
            value={filterDepartment} 
            onChange={(e) => setFilterDepartment(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="">All Departments</option>
            {uniqueDepartments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        {/* Designation Filter */}
        <div className="filter-box" style={{ flex: '1', minWidth: '150px' }}>
          <select 
            value={filterDesignation} 
            onChange={(e) => setFilterDesignation(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="">All Designations</option>
            {uniqueDesignations.map(desig => (
              <option key={desig} value={desig}>{desig}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="filter-box" style={{ flex: '1', minWidth: '120px' }}>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Join Date Filter */}
        <div className="filter-box" style={{ flex: '1', minWidth: '130px' }}>
          <input 
            type="date"
            value={filterJoinDate}
            onChange={(e) => setFilterJoinDate(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
            title="Filter by Join Date"
          />
        </div>

        {/* Reset Button */}
        <button 
          className="reset-btn" 
          onClick={handleResetFilters}
          style={{ padding: '10px 15px', whiteSpace: 'nowrap' }}
        >
          🔄 Reset
        </button>
      </div>

      {/* --- Add Employee Form --- */}
      {showForm && (
        <form onSubmit={handleSubmit} className="employee-form">
          <h2>Add New Employee</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>First Name *</label>
              <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Department</label>
              <input type="text" name="department" value={formData.department} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Designation</label>
              <input type="text" name="designation" value={formData.designation} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Date of Joining</label>
              <input type="date" name="dateOfJoining" value={formData.dateOfJoining} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Base Salary</label>
              <input type="number" name="baseSalary" value={formData.baseSalary} onChange={handleChange} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="submit-btn">Create Employee</button>
            <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* --- Edit Employee Modal --- */}
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
                  <input type="text" name="firstName" value={editFormData.firstName} onChange={handleEditChange} required />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input type="text" name="lastName" value={editFormData.lastName} onChange={handleEditChange} required />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" name="email" value={editFormData.email} onChange={handleEditChange} required />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input type="text" name="department" value={editFormData.department} onChange={handleEditChange} />
                </div>
                <div className="form-group">
                  <label>Designation</label>
                  <input type="text" name="designation" value={editFormData.designation} onChange={handleEditChange} />
                </div>
                <div className="form-group">
                  <label>Date of Joining</label>
                  <input type="date" name="dateOfJoining" value={editFormData.dateOfJoining} onChange={handleEditChange} />
                </div>
                <div className="form-group">
                  <label>Base Salary</label>
                  <input type="number" name="baseSalary" value={editFormData.baseSalary} onChange={handleEditChange} />
                </div>
                <div className="form-group checkbox-group">
                  <label>
                    <input type="checkbox" name="isActive" checked={editFormData.isActive} onChange={handleEditChange} />
                    <span>Active Employee</span>
                  </label>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="submit-btn">Update Employee</button>
                <button type="button" className="cancel-btn" onClick={handleCloseEditModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Employee Table --- */}
      <div className="employees-table">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Status</th>
              <th>Join Date</th>
              <th>Salary</th>
              {(user?.role === 'admin' || user?.role === 'hr') && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp, index) => (
                <tr key={emp._id}>
                  <td>{index + 1}</td>
                  <td>{emp.employeeId ? `EMP${emp.employeeId}` : '-'}</td>
                  <td>{emp.firstName} {emp.lastName}</td>
                  <td>{emp.email}</td>
                  <td>{emp.department || 'N/A'}</td>
                  <td>{emp.designation || 'N/A'}</td>
                  <td>
                    <span className={emp.isActive ? "status-badge active" : "status-badge inactive"}>
                      {emp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString() : '-'}</td>
                  <td>₹{emp.baseSalary || 0}</td>
                  {(user?.role === 'admin' || user?.role === 'hr') && (
                    <td className="actions-cell">
                      <button className="action-btn edit-btn" onClick={() => handleEditClick(emp)} title="Edit">
                        ✏️
                      </button>
                      {user?.role === 'admin' && (
                        <button className="action-btn delete-btn" onClick={() => handleDelete(emp._id, `${emp.firstName} ${emp.lastName}`)} title="Delete">
                          🗑️
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" style={{textAlign: 'center', padding: '20px'}}>No employees found matching filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Employees;