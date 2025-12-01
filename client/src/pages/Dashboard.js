// src/pages/Dashboard.js

// ==============================
// 1. Imports
// ==============================
import React, { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux"; // To access global state (user info)
import { useNavigate } from "react-router-dom"; // To handle navigation
import api, { employeeAPI, attendanceAPI } from "../services/api"; // API service calls
import "bootstrap/dist/css/bootstrap.min.css"; // Bootstrap styling

// Chart.js imports for data visualization
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Registering Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// ==============================
// 2. Constants & Configuration
// ==============================

// Data for the Ring Chart (Employee Breakdown)
const EMPLOYMENT_BREAKDOWN = [
  { key: 'employees', label: 'Full-time Employees', value: 88, colorClass: 'seg-blue' },
  { key: 'interns', label: 'Interns', value: 50, colorClass: 'seg-green' },
  { key: 'contract', label: 'Contract Staff', value: 26, colorClass: 'seg-red' },
];

// Configuration for "Quick Actions" buttons based on User Role
const QUICK_ACTIONS = {
  admin: [
    { label: "Manage Employees", action: "employees" },
    { label: "Manage Attendance", action: "attendance" },
    { label: "Approve Leave Requests", action: "leave" },
    { label: "Manage Payroll", action: "payroll" },
    { label: "View HR Reports", action: "reports" },
    { label: "My Profile", action: "profile" },
  ],
  hr: [
    { label: "Manage Employees", action: "employees" },
    { label: "Manage Attendance", action: "attendance" },
    { label: "Approve Leave Requests", action: "leave" },
    { label: "Manage Payroll", action: "payroll" },
    { label: "View HR Reports", action: "reports" },
    { label: "My Profile", action: "profile" },
  ],
  manager: [
    { label: "View Team", action: "team" },
    { label: "Review Attendance", action: "attendance" },
    { label: "Approve Leave", action: "leave" },
    { label: "Performance", action: "performance" },
    { label: "My Profile", action: "profile" },
  ],
  employee: [
    { label: "My Attendance", action: "attendance" },
    { label: "Apply Leave", action: "leave" },
    { label: "View Payroll", action: "payroll" },
    { label: "Performance", action: "performance" },
    { label: "My Profile", action: "profile" },
  ],
};

// Titles and Subtitles based on Role
const ROLE_TITLE_MAP = {
  admin: "Admin Dashboard",
  hr: "HR Manager Dashboard",
  manager: "Manager Dashboard",
  employee: "Employee Dashboard",
};

const ROLE_SUBTITLE_MAP = {
  admin: "Full System Access & Control",
  hr: "Human Resources Operations",
  manager: "Team Management & Oversight",
  employee: "Personal Information & Self-Service",
};

// ==============================
// 3. Main Component: Dashboard
// ==============================
const Dashboard = () => {
  // Access user data from Redux Store
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const lineChartRef = useRef(null);

  // --- State Management ---
  const [loading, setLoading] = useState(false); // Page loading state
  const [attendance, setAttendance] = useState([]); // Stores attendance records
  const [checkedIn, setCheckedIn] = useState(false); // Tracks if user is currently checked in
  const [employees, setEmployees] = useState([]); // List of all employees
  
  // Dashboard Numerical Statistics
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    departments: 0,
  });

  // Leave Management State
  const [leaves, setLeaves] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Determine current user role
  const role = user?.role || "employee";
  const roleTitle = ROLE_TITLE_MAP[role] || "Dashboard";
  const roleSubtitle = ROLE_SUBTITLE_MAP[role] || "";
  const quickActions = QUICK_ACTIONS[role] || QUICK_ACTIONS.employee;

  // ==============================
  // 4. Effects (Data Fetching)
  // ==============================

  // Effect: Fetch Dashboard Statistics (Total Employees, Depts, etc.)
  useEffect(() => {
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Call API to get employee list
        const response = await api.get("/employees");
        const allEmp = response.data || [];

        // Calculate stats based on response
        setStats({
          totalEmployees: allEmp.length,
          activeEmployees: allEmp.filter((e) => e.status === "active").length,
          departments: [...new Set(allEmp.map((e) => e.department))].length,
        });
        setEmployees(allEmp);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  // Effect: Fetch Attendance Records
  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      const response = await attendanceAPI.getAttendance({
        employeeId: user?.id,
      });
      setAttendance(response.data);
      
      // Check if user has checked in today
      const today = response.data.find(
        (a) => new Date(a.date).toDateString() === new Date().toDateString()
      );
      setCheckedIn(!!today?.checkInTime);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  // Effect: Fetch Leave Requests (Mock Data currently)
  useEffect(() => {
    const fetchLeaves = async () => {
      try {
        // MOCK DATA: Simulating API response
        setLeaves([
          { _id: '1', employee: { firstName: 'John', lastName: 'Doe', email: 'john@test.com' }, leaveType: 'Sick', status: 'pending', numberOfDays: 2},
          { _id: '2', employee: { firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com' }, leaveType: 'Casual', status: 'pending', numberOfDays: 1},
          { _id: '3', employee: { firstName: 'Robert', lastName: 'Brown', email: 'rob@test.com' }, leaveType: 'Annual', status: 'approved', numberOfDays: 5},
          { _id: '4', employee: { firstName: 'Emily', lastName: 'Davis', email: 'emily@test.com' }, leaveType: 'Sick', status: 'pending', numberOfDays: 1},
        ]);
      } catch (error) {
        console.error("Error fetching leaves:", error);
      }
    };
    fetchLeaves();
  }, []);

  // ==============================
  // 5. Action Handlers
  // ==============================

  // Handle Check-In
  const handleCheckIn = async () => {
    try {
      await attendanceAPI.checkIn({ employeeId: user?.id });
      setCheckedIn(true);
      fetchAttendance();
    } catch (error) {
      console.error('Error checking in:', error);
    }
  };

  // Handle Check-Out
  const handleCheckOut = async () => {
    try {
      await attendanceAPI.checkOut({ employeeId: user?.id });
      setCheckedIn(false);
      fetchAttendance();
    } catch (error) {
      console.error('Error checking out:', error);
    }
  };

  // Logic to calculate the formatted string of the last check-in
  let lastCheckInTime = null;
  if (attendance && attendance.length > 0) {
    const lastObject = attendance[attendance.length - 1];
    if (lastObject && lastObject.checkInTime) {
      const date = new Date(lastObject.checkInTime);
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      lastCheckInTime = `${hours}:${minutes}:${seconds}`;
    }
  }

  // Filter Leaves Logic (by name, month, year, status)
  const getFilteredLeaves = () => {
    let filtered = [...leaves];

    // Search Filter
    if (searchQuery && (role === 'hr' || role === 'admin')) {
      filtered = filtered.filter((leave) => {
        const fullName = `${leave.employee?.firstName} ${leave.employee?.lastName}`.toLowerCase();
        const email = leave.employee?.email?.toLowerCase() || '';
        return fullName.includes(searchQuery.toLowerCase()) || 
               email.includes(searchQuery.toLowerCase());
      });
    }
    // Month Filter
    if (selectedMonth) {
      filtered = filtered.filter((leave) => {
        const leaveDate = new Date(leave.startDate);
        const leaveMonth = (leaveDate.getMonth() + 1).toString().padStart(2, '0');
        return leaveMonth === selectedMonth;
      });
    }
    // Year Filter
    if (selectedYear) {
      filtered = filtered.filter((leave) => {
        const leaveDate = new Date(leave.startDate);
        return leaveDate.getFullYear().toString() === selectedYear;
      });
    }
    // Status Filter
    if (selectedStatus) {
      filtered = filtered.filter((leave) => leave.status === selectedStatus);
    }
    return filtered;
  };

  const filteredLeaves = getFilteredLeaves();

  // Helper: Get Badge Color for Status
  const getStatusBadge = (status) => {
    switch(status) {
      case 'approved': return { class: 'bg-success text-white', text: 'Approved' };
      case 'rejected': return { class: 'bg-danger text-white', text: 'Rejected' };
      default: return { class: 'bg-warning text-dark', text: 'Pending' };
    }
  };

  // Handle Leave Approval
  const handleApproveLeave = async (id) => {
    try {
        // Optimistic UI update
        setLeaves(prev => prev.map(l => l._id === id ? {...l, status: 'approved'} : l));
        console.log(`Approved leave ${id}`);
    } catch (err) {
        console.error(err);
    }
  };

  // Handle Leave Rejection
  const handleRejectLeave = async (id) => {
    try {
        setLeaves(prev => prev.map(l => l._id === id ? {...l, status: 'rejected'} : l));
        console.log(`Rejected leave ${id}`);
    } catch (err) {
        console.error(err);
    }
  };

  // Handle Navigation when clicking cards
  const handleCardClick = (action) => {
    const routes = {
      'employees': '/employees',
      'attendance': '/attendance',
      'leave': '/leave',
      'payroll': '/payroll',
      'reports': '/reports',
      'team': '/team',
      'profile': '/profile',
    };
    if (routes[action]) navigate(routes[action]);
  };

  // --- Animation Component Helper ---
  // Animates numbers from 0 to value
  const AnimatedNumber = ({ value, className = "", duration = 1200 }) => {
    const [display, setDisplay] = React.useState(0);
    React.useEffect(() => {
      let startTimestamp = null;
      const startValue = 0;
      const diff = value - startValue;
      if (diff === 0) {
        setDisplay(value);
        return;
      }
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.round(startValue + diff * progress);
        setDisplay(current);
        if (progress < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    }, [value, duration]);
    return <div className={className}>{display.toLocaleString()}</div>;
  };

  // ==============================
  // 6. Render
  // ==============================

  // Loading Screen
  if (loading) {
    return (
      <div className="hr-page">
        <main className="container-xxl hr-main m-0 p-3">
          <div className="dashboard-shell loading-shell">
            <div className="dashboard-loader text-center py-5">
              <div className="spinner-border" role="status" />
              <p className="mt-3 mb-0">Loading Dashboard...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="hr-page">
      <main className="container-xxl hr-main m-0 p-3">
        <div className="dashboard-shell border">
          
          {/* Header Section */}
          <div className="mb-4 d-flex justify-content-between align-items-center">
            <div className="greeting-container">
              <h2 className="page-greeting">
                {roleTitle} {user?.firstName ? ` – ${user.firstName}` : ""}
              </h2>
              {roleSubtitle && (
                <div className="text-muted small mt-1">{roleSubtitle}</div>
              )}
            </div>

            {/* Check In / Check Out Buttons */}
            <div className="button-container d-flex">
              <div className="mt-2 h5 me-3">{checkedIn && lastCheckInTime}</div>
              {!checkedIn ? (
                <button onClick={handleCheckIn} className="btn btn-primary">
                  Check In
                </button>
              ) : (
                <button onClick={handleCheckOut} className="btn btn-outline-danger">
                  Check Out
                </button>
              )}
            </div>
          </div>

          <div className="row g-4">
            
            {/* --- LEFT COLUMN --- */}
            <div className="col-lg-8 d-flex flex-column gap-4">
              
              {/* Card 1: Daily Overview Statistics */}
              <div className="dashboard-chart-card">
                <div className="chart-header">
                  <h3 className="chart-title">📈 Daily Overview</h3>
                  <div className="chart-legend">
                    <div className="legend-item"><span className="legend-dot blue"></span><span>Present</span></div>
                    <div className="legend-item"><span className="legend-dot pink"></span><span>Absent</span></div>
                    <div className="legend-item"><span className="legend-dot green"></span><span>Half Day</span></div>
                  </div>
                </div>
                <div className="chart-stats">
                  <div className="stat-item">
                    <AnimatedNumber value={3442} className="stat-value blue" duration={1200} />
                    <div className="stat-label">Total Present</div>
                  </div>
                  <div className="stat-item">
                    <AnimatedNumber value={1442} className="stat-value pink" duration={1200} />
                    <div className="stat-label">Total Absent</div>
                  </div>
                  <div className="stat-item">
                    <AnimatedNumber value={856} className="stat-value green" duration={1200} />
                    <div className="stat-label">Half Days</div>
                  </div>
                </div>
              </div>

              {/* Card 2: Quick Links (Buttons) */}
              <div className="dashboard-chart-card">
                <div className="chart-header">
                  <h3 className="chart-title">
                    <span>🧑‍💼 {role === "admin" ? "Admin" : role === "hr" ? "HR" : "User"} Quick Links</span>
                  </h3>
                </div>
                <div className="card-body">
                  <div className="feature-grid">
                    {quickActions.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="feature-pill"
                        onClick={() => handleCardClick(item.action)}
                      >
                        <span className="feature-dot" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 3: General Stats (Clickable) */}
              <div className="dashboard-chart-card">
                <div className="chart-header"><h3 className="chart-title">📋 Overview</h3></div>
                <div className="card-body">
                  <div className="stat-row">
                    <div className="stat-cards stat-card-purple" onClick={() => handleCardClick("employees")}>
                      <div className="stat-icon">👥</div>
                      <div className="stat-label">{role === "manager" ? "Team Members" : "Total Employees"}</div>
                      <div className="stat-value">{stats.totalEmployees || 0}</div>
                    </div>
                    <div className="stat-cards stat-card-pink" onClick={() => handleCardClick("attendance")}>
                      <div className="stat-icon">✅</div>
                      <div className="stat-label">{role === "employee" ? "My Attendance" : "Active Employees"}</div>
                      <div className="stat-value">{stats.activeEmployees || 0}</div>
                    </div>
                    {(role === "admin" || role === "hr") && (
                      <div className="stat-cards stat-card-gold" onClick={() => handleCardClick("employees")}>
                        <div className="stat-icon">🏢</div>
                        <div className="stat-label">Departments</div>
                        <div className="stat-value">{stats.departments || 0}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* --- RIGHT COLUMN --- */}
            <div className="col-lg-4 d-flex flex-column gap-4">
              
              {/* Card 4: Employee Breakdown Ring Chart */}
              <div className="dashboard-chart-card">
                <div className="chart-header">
                  <h3 className="chart-title">📊 Employee Work Rate</h3>
                </div>
                <div className="card-body access-vertical">
                  <div className="access-chart-wrap access-chart-full">
                    {/* SVG Chart Logic */}
                    <svg viewBox="0 0 140 140" className="access-chart-svg">
                      {(() => {
                        const baseRadius = 62;
                        const ringGap = 8;
                        const total = EMPLOYMENT_BREAKDOWN.reduce((sum, item) => sum + item.value, 0);
                        return EMPLOYMENT_BREAKDOWN.map((item, index) => {
                          const radius = baseRadius - index * ringGap;
                          const circumference = 2 * Math.PI * radius;
                          const fraction = total ? item.value / total : 0;
                          const length = fraction * circumference;
                          return (
                            <g key={item.key}>
                              <circle cx="70" cy="70" r={radius} className="access-segment-bg" />
                              <circle
                                cx="70" cy="70" r={radius}
                                className={`access-segment ${item.colorClass}`}
                                style={{ '--dash': length, '--gap': circumference - length, '--delay': `${index * 0.18}s` }}
                              />
                            </g>
                          );
                        });
                      })()}
                    </svg>
                    <div className="access-chart-center">
                      <div className="access-center-value">{EMPLOYMENT_BREAKDOWN.reduce((s, i) => s + i.value, 0)}</div>
                      <div className="access-center-label">Total Staff</div>
                    </div>
                  </div>
                  {/* Legend for Ring Chart */}
                  <div className="access-legend access-legend-bottom">
                    {EMPLOYMENT_BREAKDOWN.map((item) => (
                      <div className="access-legend-row" key={item.key}>
                        <div className="legend-label-wrap">
                          <span className={`legend-dot ${item.colorClass}`} />
                          <span className="legend-label">{item.label}</span>
                        </div>
                        <div className="legend-values">
                          <span className="legend-count">{item.value}</span>
                          <span className={item.colorClass === 'seg-red' ? 'legend-badge badge-down' : 'legend-badge badge-up'}>
                            {item.colorClass === 'seg-red' ? '-1.2%' : '+3.4%'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 5: All Employees / Recent Leaves Table 
                  MODIFIED: Scrollable area + Redirect Icon */}
              <div className="dashboard-chart-card">
                <div className="chart-header d-flex justify-content-between align-items-center">
                    <h3 className="chart-title">
                        🧑‍🤝‍🧑 Employees Request
                        {/* REDIRECT ICON ADDED HERE */}
                        <span 
                            title="Go to Employees Page"
                            style={{ cursor: "pointer", marginLeft: "10px", fontSize: "1.52em", color: "#666" }}
                            onClick={() => navigate('/leave')}
                        >
                            ↗
                        </span>
                    </h3>
                </div>
                
                {/* SCROLLABLE CONTAINER ADDED HERE 
                    maxHeight: 180px ensures roughly 2 rows are fully visible, 
                    indicating to the user they can scroll for more. */}
                <div 
                    className="card-body" 
                    style={{ maxHeight: "180px", overflowY: "auto", padding: "0" }}
                >
                    <table className="table table-hover align-middle leaves-table mb-0">
                        {/* Sticky Header to keep titles visible while scrolling */}
                        <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 2 }}>
                            <tr>
                                <th>S.no</th>
                                {(user?.role === 'hr' || user?.role === 'admin') && <th>Employee</th>}
                                <th>Type</th>
                                {(user?.role === 'hr' || user?.role === 'admin') && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLeaves.map((leave, index) => {
                                return (
                                <tr key={leave._id}>
                                    <td>{index + 1}</td>
                                    {(user?.role === 'hr' || user?.role === 'admin') && (
                                    <td>{leave.employee?.firstName} {leave.employee?.lastName}</td>
                                    )}
                                    <td>{leave.leaveType}</td>
                                    {(user?.role === 'hr' || user?.role === 'admin') && (
                                    <td>
                                        <button
                                        className="btn btn-sm btn-success me-2"
                                        onClick={() => handleApproveLeave(leave._id)}
                                        disabled={leave.status !== 'pending'}
                                        >
                                        ✓
                                        </button>
                                        <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => handleRejectLeave(leave._id)}
                                        disabled={leave.status !== 'pending'}
                                        >
                                        ✕
                                        </button>
                                    </td>
                                    )}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard; 