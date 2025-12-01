import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employeeAPI } from '../services/api'; // Check your path
// import './EmployeeDetails.css'; // Import the CSS file we just created

const EmployeeDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        setLoading(true);
        // Using the getById function from your api.js
        const response = await employeeAPI.getById(id);
        setEmployee(response.data);
      } catch (err) {
        console.error("Error fetching details:", err);
        setError("Failed to load employee details.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchEmployee();
    }
  }, [id]);

  if (loading) return <div className="loading-container">Loading Profile...</div>;
  if (error) return <div className="error-container">{error}</div>;
  if (!employee) return <div className="error-container">Employee not found.</div>;

  return (
    <div className="details-container">
      <div className="details-card">
        
        {/* Header with Title and Back Button */}
        <div className="details-header">
          <h1>Employee Profile</h1>
          <button className="add-btn" onClick={() => navigate(-1)}>
            ⬅ Back to List
          </button>
        </div>

        {/* Body with Grid Data */}
        <div className="details-body">
          <div className="info-grid">
            
            {/* Full Name */}
            <div className="info-group">
              <span className="info-label">Full Name</span>
              <span className="info-value">
                {employee.firstName} {employee.lastName}
              </span>
            </div>

            {/* Employee ID */}
            <div className="info-group">
              <span className="info-label">Employee ID</span>
              <span className="info-value">
                {employee.employeeId ? `EMP-${employee.employeeId}` : 'N/A'}
              </span>
            </div>

            {/* Email */}
            <div className="info-group">
              <span className="info-label">Email Address</span>
              <span className="info-value">{employee.email}</span>
            </div>

            {/* Status (Using the badge style) */}
            <div className="info-group">
              <span className="info-label">Status</span>
              <div>
                <span className={`status-badge ${employee.isActive ? 'active' : 'inactive'}`}>
                  {employee.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Department */}
            <div className="info-group">
              <span className="info-label">Department</span>
              <span className="info-value">{employee.department || 'Not Assigned'}</span>
            </div>

            {/* Designation */}
            <div className="info-group">
              <span className="info-label">Designation</span>
              <span className="info-value">{employee.designation || 'Not Assigned'}</span>
            </div>

            {/* Date of Joining */}
            <div className="info-group">
              <span className="info-label">Date of Joining</span>
              <span className="info-value">
                {employee.dateOfJoining 
                  ? new Date(employee.dateOfJoining).toLocaleDateString() 
                  : 'N/A'}
              </span>
            </div>

            {/* Base Salary (Formatted as Currency) */}
            <div className="info-group">
              <span className="info-label">Base Salary</span>
              <span className="info-value">
                {employee.baseSalary 
                  ? `₹${employee.baseSalary.toLocaleString()}` 
                  : 'N/A'}
              </span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetails;