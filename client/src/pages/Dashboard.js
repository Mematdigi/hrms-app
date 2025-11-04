import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user } = useSelector(state => state.auth);
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/employees');
      const employees = response.data;
      
      setStats({
        totalEmployees: employees.length,
        activeEmployees: employees.filter(e => e.status === 'active').length,
        departments: [...new Set(employees.map(e => e.department))].length,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle card click navigation
  const handleCardClick = (action) => {
    const routes = {
      'employees': '/employees',
      'attendance': '/attendance',
      'leave': '/leave',
      'payroll': '/payroll',
      'roles': '/roles',
      'reports': '/reports',
      'settings': '/settings',
      'team': '/team',
      'profile': '/profile',
    };
    
    if (routes[action]) {
      navigate(routes[action]);
    }
  };

  // Admin Dashboard
  if (user?.role === 'admin') {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header admin-header">
          <h1>Admin Dashboard</h1>
          <p>Full System Access & Control</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card admin-card clickable-card" onClick={() => handleCardClick('employees')}>
            <div className="card-icon">👥</div>
            <div className="card-content">
              <h3>Total Employees</h3>
              <p className="card-value">{stats.totalEmployees || 0}</p>
            </div>
          </div>

          <div className="dashboard-card admin-card clickable-card" onClick={() => handleCardClick('attendance')}>
            <div className="card-icon">✅</div>
            <div className="card-content">
              <h3>Active Employees</h3>
              <p className="card-value">{stats.activeEmployees || 0}</p>
            </div>
          </div>

          <div className="dashboard-card admin-card clickable-card" onClick={() => handleCardClick('leave')}>
            <div className="card-icon">🏢</div>
            <div className="card-content">
              <h3>Departments</h3>
              <p className="card-value">{stats.departments || 0}</p>
            </div>
          </div>

          <div className="dashboard-card admin-card clickable-card" onClick={() => handleCardClick('settings')}>
            <div className="card-icon">⚙️</div>
            <div className="card-content">
              <h3>System Settings</h3>
              <p className="card-value">Manage All</p>
            </div>
          </div>
        </div>

        <div className="admin-features">
          <h2>Admin Features</h2>
          <div className="features-grid">
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('employees')}>
              <span className="feature-icon">👤</span>
              <span>Manage Users & Roles</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('reports')}>
              <span className="feature-icon">📊</span>
              <span>View All Reports</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('employees')}>
              <span className="feature-icon">💼</span>
              <span>Manage Employees</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('attendance')}>
              <span className="feature-icon">📅</span>
              <span>Manage Attendance</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('leave')}>
              <span className="feature-icon">🏖️</span>
              <span>Manage Leave</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('payroll')}>
              <span className="feature-icon">💰</span>
              <span>Manage Payroll</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('roles')}>
              <span className="feature-icon">🔐</span>
              <span>Manage Roles</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('settings')}>
              <span className="feature-icon">⚙️</span>
              <span>System Settings</span>
            </div>
          </div>
        </div>

        <div className="access-info admin-info">
          <h3>📋 Access Information</h3>
          <p>You have full administrative access to all system features and can manage all aspects of the HRMS application.</p>
        </div>
      </div>
    );
  }

  // HR Manager Dashboard
  if (user?.role === 'hr') {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header hr-header">
          <h1>HR Manager Dashboard</h1>
          <p>Human Resources Operations</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card hr-card clickable-card" onClick={() => handleCardClick('employees')}>
            <div className="card-icon">👥</div>
            <div className="card-content">
              <h3>Total Employees</h3>
              <p className="card-value">{stats.totalEmployees || 0}</p>
            </div>
          </div>

          <div className="dashboard-card hr-card clickable-card" onClick={() => handleCardClick('leave')}>
            <div className="card-icon">🏖️</div>
            <div className="card-content">
              <h3>Leave Requests</h3>
              <p className="card-value">Pending</p>
            </div>
          </div>

          <div className="dashboard-card hr-card clickable-card" onClick={() => handleCardClick('payroll')}>
            <div className="card-icon">💰</div>
            <div className="card-content">
              <h3>Payroll</h3>
              <p className="card-value">Manage</p>
            </div>
          </div>
        </div>

        <div className="hr-features">
          <h2>HR Features</h2>
          <div className="features-grid">
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('employees')}>
              <span className="feature-icon">👤</span>
              <span>Manage Employees</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('attendance')}>
              <span className="feature-icon">📅</span>
              <span>Manage Attendance</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('leave')}>
              <span className="feature-icon">🏖️</span>
              <span>Approve Leave Requests</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('payroll')}>
              <span className="feature-icon">💰</span>
              <span>Manage Payroll</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('reports')}>
              <span className="feature-icon">📊</span>
              <span>View HR Reports</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('profile')}>
              <span className="feature-icon">👤</span>
              <span>My Profile</span>
            </div>
          </div>
        </div>

        <div className="access-info hr-info">
          <h3>📋 Access Information</h3>
          <p>You have access to HR operations including employee management, leave approvals, attendance tracking, and payroll management.</p>
        </div>
      </div>
    );
  }

  // Manager Dashboard
  if (user?.role === 'manager') {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header manager-header">
          <h1>Manager Dashboard</h1>
          <p>Team Management & Oversight</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card manager-card clickable-card" onClick={() => handleCardClick('team')}>
            <div className="card-icon">👥</div>
            <div className="card-content">
              <h3>Team Members</h3>
              <p className="card-value">View</p>
            </div>
          </div>

          <div className="dashboard-card manager-card clickable-card" onClick={() => handleCardClick('leave')}>
            <div className="card-icon">🏖️</div>
            <div className="card-content">
              <h3>Leave Requests</h3>
              <p className="card-value">Pending</p>
            </div>
          </div>

          <div className="dashboard-card manager-card clickable-card" onClick={() => handleCardClick('attendance')}>
            <div className="card-icon">📅</div>
            <div className="card-content">
              <h3>Attendance</h3>
              <p className="card-value">Track</p>
            </div>
          </div>

          <div className="dashboard-card manager-card clickable-card" onClick={() => handleCardClick('profile')}>
            <div className="card-icon">👤</div>
            <div className="card-content">
              <h3>My Profile</h3>
              <p className="card-value">View</p>
            </div>
          </div>
        </div>

        <div className="manager-features">
          <h2>Manager Features</h2>
          <div className="features-grid">
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('team')}>
              <span className="feature-icon">👥</span>
              <span>View Team Data</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('leave')}>
              <span className="feature-icon">🏖️</span>
              <span>Approve Leave</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('attendance')}>
              <span className="feature-icon">📅</span>
              <span>Track Attendance</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('profile')}>
              <span className="feature-icon">👤</span>
              <span>My Profile</span>
            </div>
          </div>
        </div>

        <div className="access-info manager-info">
          <h3>📋 Access Information</h3>
          <p>You have access to team management features including viewing team data, approving leave requests, and tracking attendance.</p>
        </div>
      </div>
    );
  }

  // Employee Dashboard
  if (user?.role === 'employee') {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header employee-header">
          <h1>Employee Dashboard</h1>
          <p>Personal Information & Self-Service</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card employee-card clickable-card" onClick={() => handleCardClick('profile')}>
            <div className="card-icon">👤</div>
            <div className="card-content">
              <h3>My Profile</h3>
              <p className="card-value">View</p>
            </div>
          </div>

          <div className="dashboard-card employee-card clickable-card" onClick={() => handleCardClick('leave')}>
            <div className="card-icon">🏖️</div>
            <div className="card-content">
              <h3>Leave Management</h3>
              <p className="card-value">Apply</p>
            </div>
          </div>

          <div className="dashboard-card employee-card clickable-card" onClick={() => handleCardClick('attendance')}>
            <div className="card-icon">📅</div>
            <div className="card-content">
              <h3>Attendance</h3>
              <p className="card-value">View</p>
            </div>
          </div>

          <div className="dashboard-card employee-card clickable-card" onClick={() => handleCardClick('payroll')}>
            <div className="card-icon">💰</div>
            <div className="card-content">
              <h3>Payroll</h3>
              <p className="card-value">View</p>
            </div>
          </div>
        </div>

        <div className="employee-features">
          <h2>Employee Features</h2>
          <div className="features-grid">
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('profile')}>
              <span className="feature-icon">👤</span>
              <span>View My Profile</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('leave')}>
              <span className="feature-icon">🏖️</span>
              <span>Apply for Leave</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('attendance')}>
              <span className="feature-icon">📅</span>
              <span>View Attendance</span>
            </div>
            <div className="feature-item clickable-feature" onClick={() => handleCardClick('payroll')}>
              <span className="feature-icon">💰</span>
              <span>View Payslips</span>
            </div>
          </div>
        </div>

        <div className="access-info employee-info">
          <h3>📋 Access Information</h3>
          <p>You have access to your personal information, leave management, attendance records, and payroll information. Leave requests are sent to HR for approval.</p>
        </div>
      </div>
    );
  }

  return <div className="loading">Loading Dashboard...</div>;
};

export default Dashboard;
