import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { payrollAPI, employeeAPI } from '../services/api';
import '../styles/Payroll.css';

function Payroll() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    baseSalary: '',
    allowances: '',
    deductions: '',
    tax: '',
  });
  const { user } = useSelector((state) => state.auth);

  // Fetching employee data
  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getPayrolls();
      console.log('Fetched employees: payroll', response.data);
      setEmployees(response.data.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle checkbox selection for employees
  const handleCheckboxChange = (employeeId) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        // Remove if already selected
        return prev.filter(id => id !== employeeId);
      } else {
        // Add if not selected
        return [...prev, employeeId];
      }
    });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedEmployees.length === 0) {
      alert('Please select at least one employee');
      return;
    }

    try {
      await payrollAPI.generate({
        employee: selectedEmployees,
        ...formData,
        baseSalary: parseFloat(formData.baseSalary),
        allowances: parseFloat(formData.allowances) || 0,
        deductions: parseFloat(formData.deductions) || 0,
        tax: parseFloat(formData.tax) || 0,
        month: parseInt(formData.month),
        year: parseInt(formData.year)
      });
      
      // Reset form
      setFormData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        baseSalary: '',
        allowances: '',
        deductions: '',
        tax: '',
      });
      setSelectedEmployees([]);
      setShowForm(false);
      
      // Refresh employee data
      fetchEmployees();
      
      alert('Payroll generated successfully!');
    } catch (error) {
      console.error('Error generating payroll:', error);
      alert('Error generating payroll. Please try again.');
    }
  };

  // Check if an employee is selected
  const isEmployeeSelected = (employeeId) => {
    return selectedEmployees.includes(employeeId);
  };

  // Separate selected and unselected employees
  const selectedEmployeeList = employees.filter(emp => selectedEmployees.includes(emp._id));
  const unselectedEmployeeList = employees.filter(emp => !selectedEmployees.includes(emp._id));

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="payroll-container">
      <div className="payroll-header">
        <h1>Payroll Management</h1>
        {(user?.role === 'admin' || user?.role === 'hr') && selectedEmployees.length > 0 && (
          <button onClick={() => setShowForm(!showForm)} className="generate-btn">
            {showForm ? 'Cancel' : `Generate Payroll (${selectedEmployees.length})`}
          </button>
        )}
      </div>

      <div className="payroll-table">
        <h2>Employee Payroll</h2>
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Employee ID</th>
              <th>Employee Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Date of Joining</th>
              <th>Salary</th>
              <th>Allowances</th>
              <th>Deductions</th>
              <th>Net Salary</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '30px' }}>
                  No employees found
                </td>
              </tr>
            ) : (
              <>
                {/* Selected Employees */}
                {selectedEmployeeList.map((emp) => (
                  <tr key={`selected-${emp._id}`} className="selected-row">
                    <td>
                      <input
                        type="checkbox"
                        checked={isEmployeeSelected(emp._id)}
                        onChange={() => handleCheckboxChange(emp._id)}
                      />
                    </td>
                    <td>{emp.employeeId}</td>
                    <td>{emp.firstName} {emp.lastName}</td>
                    <td>{emp.email}</td>
                    <td>{emp.department}</td>
                    <td>{emp.designation}</td>
                    <td>{new Date(emp.dateOfJoining).toLocaleDateString()}</td>
                    <td>₹{emp.payroll?.baseSalary || '-'}</td>
                    <td>₹{emp.payroll?.allowances || '-'}</td>
                    <td>₹{emp.payroll?.deductions || '-'}</td>
                    <td>₹{emp.payroll?.netSalary || '-'}</td>
                  </tr>
                ))}

                {/* Form Row - Appears after selected employees */}
                {showForm && selectedEmployees.length > 0 && (
                  <tr key="payroll-form-row" className="form-row-container">
                    <td colSpan="11">
                      <form onSubmit={handleSubmit} className="inline-payroll-form">
                        <h3>Generate Payroll for {selectedEmployees.length} Employee(s)</h3>
                        
                        {/* Selected Employees Verification Box */}
                        <div className="selected-employees-box">
                          <h4>Selected Employees:</h4>
                          <div className="employee-chips">
                            {selectedEmployeeList.map((emp) => (
                              <div key={emp._id} className="employee-chip">
                                <span className="emp-id">{emp.employeeId}</span>
                                <span className="emp-name">{emp.firstName} {emp.lastName}</span>
                                <button
                                  type="button"
                                  className="remove-chip"
                                  onClick={() => handleCheckboxChange(emp._id)}
                                  title="Remove from selection"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="form-grid">
                          <div className="form-group">
                            <label>Month *</label>
                            <select
                              name="month"
                              value={formData.month}
                              onChange={handleChange}
                              required
                            >
                              <option value="1">January</option>
                              <option value="2">February</option>
                              <option value="3">March</option>
                              <option value="4">April</option>
                              <option value="5">May</option>
                              <option value="6">June</option>
                              <option value="7">July</option>
                              <option value="8">August</option>
                              <option value="9">September</option>
                              <option value="10">October</option>
                              <option value="11">November</option>
                              <option value="12">December</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Year *</label>
                            <input
                              type="number"
                              name="year"
                              min="2020"
                              max="2030"
                              value={formData.year}
                              onChange={handleChange}
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label>Base Salary *</label>
                            <input
                              type="number"
                              name="baseSalary"
                              placeholder="Enter base salary"
                              value={formData.baseSalary}
                              onChange={handleChange}
                              required
                              min="0"
                              step="0.01"
                            />
                          </div>

                          <div className="form-group">
                            <label>Allowances</label>
                            <input
                              type="number"
                              name="allowances"
                              placeholder="Enter allowances"
                              value={formData.allowances}
                              onChange={handleChange}
                              min="0"
                              step="0.01"
                            />
                          </div>

                          <div className="form-group">
                            <label>Deductions</label>
                            <input
                              type="number"
                              name="deductions"
                              placeholder="Enter deductions"
                              value={formData.deductions}
                              onChange={handleChange}
                              min="0"
                              step="0.01"
                            />
                          </div>

                          <div className="form-group">
                            <label>Tax</label>
                            <input
                              type="number"
                              name="tax"
                              placeholder="Enter tax amount"
                              value={formData.tax}
                              onChange={handleChange}
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>

                        <div className="form-actions">
                          <button type="submit" className="save-payroll-btn">
                            Save Payroll
                          </button>
                          <button 
                            type="button" 
                            className="cancel-btn"
                            onClick={() => setShowForm(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}

                {/* Unselected Employees */}
                {unselectedEmployeeList.map((emp) => (
                  <tr key={`unselected-${emp._id}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isEmployeeSelected(emp._id)}
                        onChange={() => handleCheckboxChange(emp._id)}
                      />
                    </td>
                    <td>{emp.employeeId}</td>
                    <td>{emp.firstName} {emp.lastName}</td>
                    <td>{emp.email}</td>
                    <td>{emp.department}</td>
                    <td>{emp.designation}</td>
                    <td>{new Date(emp.dateOfJoining).toLocaleDateString()}</td>
                    <td>₹{emp.payroll?.baseSalary || '-'}</td>
                    <td>₹{emp.payroll?.allowances || '-'}</td>
                    <td>₹{emp.payroll?.deductions || '-'}</td>
                    <td>₹{emp.payroll?.netSalary || '-'}</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Payroll;