import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { payrollAPI, employeeAPI } from '../services/api';
import '../styles/Payroll.css';
 import {showError} from '../utils/toast';
function Payroll() {
  // ==================== STATE MANAGEMENT ====================
  
  const [employees, setEmployees] = useState([]);
  
  // Loading state to show spinner while fetching data
  const [loading, setLoading] = useState(true);
  
  // Controls whether the payroll form is visible or hidden
  const [showForm, setShowForm] = useState(false);
  
  // MODIFIED: Now stores only ONE employee ID (not an array)
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  // Form data for payroll generation
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1, // Current month (1-12)
    year: new Date().getFullYear(),    // Current year
    baseSalary: '',                    // Base salary amount
    WorkedDays: '',                     // Additional WorkedDays
    deductions: '',                     // Deductions (PF, insurance, etc.)
    workingDays: '',                           // workingDays amount
  });
  
  // Get logged-in user details from Redux store (for role-based access)
  const { user } = useSelector((state) => state.auth);

  //==================== DATA FETCHING ====================
  
  // Fetch employee data when component mounts
  useEffect(() => {
    fetchEmployees();
  }, []); // Empty dependency array means this runs only once on mount

  /**
   * Fetches all employees from the API
   * Sets loading to false after data is fetched
   */
  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getPayrolls();
      console.log('Fetched employees: payroll', response.data);
      setEmployees(response.data.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      // Always set loading to false, whether success or error
      setLoading(false);
    }
  };

  // ==================== EVENT HANDLERS ====================
  
  /**
   * MODIFIED: Handles radio button selection of ONE employee at a time
   * @param {string} employeeId - The ID of the employee to select
   */
  const handleCheckboxChange = (employeeId) => {
    // If clicking the same employee, deselect
    if (selectedEmployee === employeeId) {
      setSelectedEmployee(null);
      setShowForm(false); // Hide form when deselected
    } else {
      // Select the new employee (replaces previous selection)
      setSelectedEmployee(employeeId);
    }
  };

  /**
   * Handles form input changes
   * @param {Event} e - The change event from input fields
   */
  const handleChange = (e) => {
    setFormData({ 
      ...formData, 
      [e.target.name]: e.target.value 
    });
  };
  
  /**
   * MODIFIED: Handles form submission for payroll generation (single employee)
   * @param {Event} e - The form submit event
   */
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior
    
    // Validation: Check if an employee is selected
    if (!selectedEmployee) {
      alert('Please select an employee');
      return;
    }

    try {
      // Send payroll generation request to API for single employee
      console.log("selected employee",selectedEmployee)
      await payrollAPI.generate({
        employee: selectedEmployee,  // Send as array with single employee
        ...formData,            // Spread all form data
        // Parse string values to numbers for calculations
        baseSalary: parseFloat(formData.baseSalary),
          WorkedDays: parseFloat(formData.WorkedDays) || 0,  // Default to 0 if empty
          deductions: parseFloat(formData.deductions) || 0,  // Default to 0 if empty
          TotalWorkingDays: parseFloat(formData.workingDays) || 0,                // Default to 0 if empty
         month: parseInt(formData.month),
          year: parseInt(formData.year)
      });
      
      // Reset form to initial state after successful submission
      setFormData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        baseSalary: '',
        WorkedDays: '',
        deductions: '',
        workingDays: '',
      });
      
      // Clear selected employee
      setSelectedEmployee(null);
      
      // Hide the form
      setShowForm(false);
      
      // Refresh employee data to show updated payroll information
      fetchEmployees();
      
      // Show success message
      alert('Payroll generated successfully!');
    }catch (error) {
    console.error('Error generating payroll:', error);
    showError('Error generating payroll. Please try again.',error.response?.data?.message);
    }
  };

  // ==================== HELPER FUNCTIONS ====================
  
  /**
   * Check if a specific employee is selected
   * @param {string} employeeId - The employee ID to check
   * @returns {boolean} - True if employee is selected
   */
  const isEmployeeSelected = (employeeId) => {
    return selectedEmployee === employeeId;
  };

  /**
   * Get the selected employee object
   */
  const selectedEmployeeData = employees.find(emp => emp._id === selectedEmployee);

  /**
   * Separate employees into two arrays:
   * 1. Selected employee (to show at top)
   * 2. Unselected employees (to show at bottom)
   */
  const selectedEmployeeList = selectedEmployee 
    ? employees.filter(emp => emp._id === selectedEmployee)
    : [];
  const unselectedEmployeeList = employees.filter(emp => emp._id !== selectedEmployee);

  // ==================== RENDERING ====================
  
  // Show loading spinner while fetching data
  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="payroll-container">
      {/* ========== HEADER SECTION ========== */}
      <div className="payroll-header">
        <h1>Payroll Management</h1>
        
        {/* Show "Generate Payroll" button only if:
            1. User is admin or HR
            2. An employee is selected */}
        {(user?.role === 'admin' || user?.role === 'hr') && selectedEmployee && (
          <button 
            onClick={() => setShowForm(!showForm)} 
            className="generate-btn"
          >
            {/* Toggle button text based on form visibility */}
            {showForm ? 'Cancel' : 'Generate Payroll'}
          </button>
        )}
      </div>

      {/* ========== PAYROLL TABLE ========== */}
      <div className="payroll-table">
        <h2>Employee Payroll</h2>
        <table>
          {/* Table Headers */}
          <thead>
            <tr>
              <th>Select</th>
              <th>Employee ID</th>
              <th>Employee Name</th>
              <th>Email</th>
              <th>Department</th>
              {/* <th>Designation</th> */}
              <th>Date of Joining</th>
              <th>Salary</th>
              <th>Worked Days</th>
              <th>Deductions</th>
              <th>Net Salary</th>
              <th>Working Days</th>
            </tr>
          </thead>
          
          <tbody>
            {/* Show message if no employees found */}
            {employees.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '30px' }}>
                  No employees found
                </td>
              </tr>
            ) : (
              <>
                {/* ========== SELECTED EMPLOYEE (Show at top) ========== */}
                {selectedEmployeeList.map((emp) => (
                  <tr 
                    key={emp._id}  // Unique key using employee ID
                    className="selected-row"  // CSS class for highlighting
                  >
                    <td>
                      {/* MODIFIED: Using radio button behavior with checkbox appearance */}
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
                    {/* Payroll data with fallback to '-' if not available */}
                    <td>₹{emp.payroll?.baseSalary || '-'}</td>
                    <td>₹{emp.payroll?.WorkedDays || '-'}</td>
                    <td>₹{emp.payroll?.deductions || '-'}</td>
                    <td>₹{emp.payroll?.netSalary || '-'}</td>
                  </tr>
                ))}

                {/* ========== PAYROLL FORM (Appears below selected employee) ========== */}
                {showForm && selectedEmployee && (
                  <tr key="payroll-form-row" className="form-row-container">
                    {/* Span all columns to make form full-width */}
                    <td colSpan="11">
                      <form onSubmit={handleSubmit} className="inline-payroll-form">
                        {/* Form Title */}
                        <h3>Generate Payroll for Employee</h3>
                        
                        {/* ========== EMPLOYEE VERIFICATION BOX ========== */}
                        <div className="selected-employees-box">
                          <h4>Selected Employee:</h4>
                          
                          {/* Display selected employee as a chip */}
                          <div className="employee-chips">
                            {selectedEmployeeData && (
                              <div className="employee-chip">
                                {/* Employee ID Badge */}
                                <span className="emp-id">{selectedEmployeeData.employeeId}</span>
                                
                                {/* Employee Name */}
                                <span className="emp-name">
                                  {selectedEmployeeData.firstName} {selectedEmployeeData.lastName}
                                </span>
                                
                                {/* Remove button to deselect employee */}
                                <button
                                  type="button"
                                  className="remove-chip"
                                  onClick={() => {
                                    setSelectedEmployee(null);
                                    setShowForm(false);
                                  }}
                                  title="Remove from selection"
                                >
                                  ×
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ========== FORM FIELDS ========== */}
                        <div className="form-grid">
                          {/* Month Selection Dropdown */}
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

                          {/* Year Input */}
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

                          {/* Base Salary Input */}
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
                              step="0.01"  // Allow decimal values
                            />
                          </div>

                          {/* WorkedDays Input (Optional) */}
                          <div className="form-group">
                            <label>WorkedDays</label>
                            <input
                              type="number"
                              name="WorkedDays"
                              placeholder="Enter WorkedDays"
                              value={formData.WorkedDays}
                              onChange={handleChange}
                              min="0"
                              step="0.01"
                            />
                          </div>

                          {/* Deductions Input (Optional) */}
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

                          {/* Working Days Input (Optional) */}
                          <div className="form-group">
                            <label>Working Days</label>
                            <input
                              type="number"
                              name="workingDays"
                              placeholder="Enter working days amount"
                              value={formData.workingDays}
                              onChange={handleChange}
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>

                        {/* ========== FORM ACTION BUTTONS ========== */}
                        <div className="form-actions">
                          {/* Submit Button */}
                          <button type="submit" className="save-payroll-btn">
                            Save Payroll
                          </button>
                          
                          {/* Cancel Button */}
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

                {/* ========== UNSELECTED EMPLOYEES (Show at bottom) ========== */}
                {unselectedEmployeeList.map((emp) => (
                  <tr key={emp._id}>
                    <td>
                      {/* Checkbox for unselected employees */}
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
                    {/* <td>{emp.designation}</td> */}
                    <td>{new Date(emp.dateOfJoining).toLocaleDateString()}</td>
                    <td>₹{emp.payroll?.baseSalary || '-'}</td>
                    <td>₹{emp.payroll?.WorkedDays || '-'}</td>
                    <td>₹{emp.payroll?.deductions || '-'}</td>
                    <td>₹{emp.payroll?.netSalary || '-'}</td>
                    <td>₹{emp.payroll?.workingDays || '-'}</td>
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