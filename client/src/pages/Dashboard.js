// src/pages/Dashboard.js
import React, { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import api, { employeeAPI } from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";

// ✅ NEW: Chart.js imports
import { Line } from 'react-chartjs-2';
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

// ✅ Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);


// ---- attendance chart helpers ----
// Weekly attendance series (you can change the data)
const ATTENDANCE_WEEKS = ["02", "06", "10", "14", "18", "22", "26", "30"];

const ATTENDANCE_SERIES = [
  {
    key: "fullTime",
    label: "Full-time Employees",
    colorClass: "line-blue",
    data: [92, 88, 95, 90, 96, 93, 94, 92],
  },
  {
    key: "interns",
    label: "Interns",
    colorClass: "line-pink",
    data: [85, 82, 80, 88, 90, 86, 89, 87],
  },
  {
    key: "contract",
    label: "Contract Staff",
    colorClass: "line-green",
    data: [78, 82, 80, 84, 81, 79, 83, 80],
  },
];

// const MAX_ATTENDANCE = 100;
const CHART_WIDTH = 120;
const CHART_HEIGHT = 60;


// Example workforce mix – replace these values with real counts
const EMPLOYMENT_BREAKDOWN = [
  { key: 'employees', label: 'Full-time Employees', value: 88, colorClass: 'seg-blue' },
  { key: 'interns', label: 'Interns', value: 50, colorClass: 'seg-green' },
  { key: 'contract', label: 'Contract Staff', value: 26, colorClass: 'seg-red' },
];

const EMPLOYEES_SIDEBAR = [
  { name: "Anika Rosser", team: "UI/UX Team", rate: "98.7%" },
  { name: "Roger Dias", team: "Illustrator Team", rate: "97.1%" },
  { name: "Charlie Korsgaard", team: "Graphic Design Team", rate: "96.8%" },
];

// Role-wise quick action buttons (HR Features section) – acts as permission matrix
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

// Role-based headings/subtitles (from older version)
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

const Dashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();


  // attendance graph
  const lineChartRef = useRef(null);

  useEffect(() => {
    if (!lineChartRef.current) return;

    const paths = lineChartRef.current.querySelectorAll(".attn-line");

    paths.forEach((path, idx) => {
      const length = path.getTotalLength();

      // set initial dash so line is hidden
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = length;
      path.style.transition = "none";

      // double rAF so browser applies the initial state first
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          path.style.transition =
            "stroke-dashoffset 1.3s cubic-bezier(0.4, 0.0, 0.2, 1)";
          path.style.transitionDelay = `${idx * 0.25}s`; // stagger each line
          path.style.strokeDashoffset = "0"; // animate from start → end
        });
      });
    });
  }, []);


  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    departments: 0,
  });
  const [loading, setLoading] = useState(false);
  const [activeReminderIndex, setActiveReminderIndex] = useState(1);

  const role = user?.role || "employee";
  const roleTitle = ROLE_TITLE_MAP[role] || "Dashboard";
  const roleSubtitle = ROLE_SUBTITLE_MAP[role] || "";
  const quickActions = QUICK_ACTIONS[role] || QUICK_ACTIONS.employee;

  // ---- fetch dashboard stats from /employees ----
  useEffect(() => {
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await api.get("/employees");
        const employees = response.data || [];

        setStats({
          totalEmployees: employees.length,
          activeEmployees: employees.filter((e) => e.status === "active").length,
          departments: [...new Set(employees.map((e) => e.department))].length,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const MAX_ATTENDANCE = 100;

  // helper to build a smooth-ish SVG path for attandance
  const buildAttendancePath = (values, width, height) => {
    if (!values || values.length === 0) return "";
    const stepX = width / Math.max(values.length - 1, 1);

    const points = values.map((v, i) => {
      const x = i * stepX;
      const y = height - (Math.min(v, MAX_ATTENDANCE) / MAX_ATTENDANCE) * height;
      return { x, y };
    });

    if (points.length < 2) {
      const p = points[0];
      return `M ${p.x} ${p.y}`;
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      d += ` Q ${midX} ${prev.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  };

  // ---- routing for quick actions (only actions defined in QUICK_ACTIONS are allowed) ----
  const handleCardClick = (action) => {
    const routes = {
      employees: "/employees",
      attendance: "/attendance",
      leave: "/leave",
      payroll: "/payroll",
      performance: "/performance",
      roles: "/roles",
      reports: "/reports",
      settings: "/settings",
      team: "/team",
      profile: "/profile",
    };

    if (routes[action]) {
      navigate(routes[action]);
    }
  };

  const handleReminderClick = (index) => {
    setActiveReminderIndex(index);
  };


  // ---Fetch Employee---
  const [employees, setEmployees] = useState([]);

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


  // attendence
  useEffect(() => {
    if (!lineChartRef.current) return;

    const svgEl = lineChartRef.current;
    const paths = svgEl.querySelectorAll(".attn-line");

    paths.forEach((path, idx) => {
      const length = path.getTotalLength();
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = length;
      path.style.transition = "none";

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          path.style.transition =
            "stroke-dashoffset 1.3s cubic-bezier(0.4, 0.0, 0.2, 1)";
          path.style.transitionDelay = `${idx * 0.25}s`;
          path.style.strokeDashoffset = "0";
        });
      });
    });

    // make whole chart fade in
    requestAnimationFrame(() => {
      svgEl.classList.add("ready");
    });
  }, []);


  // changing number of overview
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

        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };

      window.requestAnimationFrame(step);
    }, [value, duration]);

    return (
      <div className={className}>
        {display.toLocaleString()}
      </div>
    );
  };


  // NEW: Dummy data for Monthly Chart
  const monthlyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#2d3748',
        bodyColor: '#4a5568',
        borderColor: '#e2e8f0',
        borderWidth: 2,
        padding: 12,
        displayColors: true,
        boxWidth: 12,
        boxHeight: 12,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#f1f5f9',
          drawBorder: false,
        },
        ticks: {
          color: '#718096',
          font: {
            size: 12,
            weight: 600,
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#718096',
          font: {
            size: 12,
            weight: 600,
          },
        },
      },
    },
  };


  // ---- loading skeleton ----
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

  // ---- MAIN LAYOUT (role-aware header + shared layout) ----
  return (
    <div className="hr-page">
      <main className="container-xxl hr-main m-0 p-3">
        <div className="dashboard-shell border">

          {/* Role-based header (from old version) */}
          <div className="mb-4">
            <h2 className="page-greeting">
              {roleTitle}
              {user?.firstName ? ` – ${user.firstName}` : ""}
            </h2>
            {roleSubtitle && (
              <div className="text-muted small mt-1">{roleSubtitle}</div>
            )}
          </div>

          <div className="row g-4">

            <div className="col-lg-8 d-flex flex-column gap-4">

              {/*Monthly Overview Chart*/}
              <div className="dashboard-chart-card">
                <div className="chart-header">
                  <h3 className="chart-title">📈 Daily Overview</h3>
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span className="legend-dot blue"></span>
                      <span>Present</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot pink"></span>
                      <span>Absent</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot green"></span>
                      <span>Half Day</span>
                    </div>
                  </div>
                </div>

                <div className="chart-stats">
                  <div className="stat-item">
                    <AnimatedNumber
                      value={3442}
                      className="stat-value blue"
                      duration={1200}  // 1.2s
                    />
                    <div className="stat-label">Total Present</div>
                  </div>

                  <div className="stat-item">
                    <AnimatedNumber
                      value={1442}
                      className="stat-value pink"
                      duration={1200}
                    />
                    <div className="stat-label">Total Absent</div>
                  </div>

                  <div className="stat-item">
                    <AnimatedNumber
                      value={856}
                      className="stat-value green"
                      duration={1200}
                    />
                    <div className="stat-label">Half Days</div>
                  </div>
                </div>
              </div>

              {/* HR / Admin / Manager / Employee Features – role-based quick actions */}
              <div className="dashboard-chart-card">
                <div className="chart-header">
                  <h3 className="chart-title"><span>🧑‍💼
                    {role === "admin"
                      ? "Admin Features"
                      : role === "hr"
                        ? "HR Features"
                        : role === "manager"
                          ? "Manager Features"
                          : "Employee Features"}
                  </span></h3>
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

              {/* Overview */}
              <div className="dashboard-chart-card">
                <div className="chart-header">
                  <h3 className="chart-title">📋 Overview</h3>
                </div>

                <div className="card-body">
                  <div className="stat-row">
                    {/* For all roles: show employees stats, but actions differ via handleCardClick */}
                    <div
                      className="stat-card stat-card-purple"
                      onClick={() => handleCardClick("employees")}
                    >
                      <div className="stat-icon">👥</div>
                      <div className="stat-label">
                        {role === "manager" ? "Team Members" : "Total Employees"}
                      </div>
                      <div className="stat-value">
                        {stats.totalEmployees || 0}
                      </div>
                    </div>

                    <div
                      className="stat-card stat-card-pink"
                      onClick={() => handleCardClick("attendance")}
                    >
                      <div className="stat-icon">✅</div>
                      <div className="stat-label">
                        {role === "employee"
                          ? "My Attendance"
                          : "Active Employees"}
                      </div>
                      <div className="stat-value">
                        {stats.activeEmployees || 0}
                      </div>
                    </div>

                    {/* Departments card only makes sense for admin / hr */}
                    {(role === "admin" || role === "hr") && (
                      <div
                        className="stat-card stat-card-gold"
                        onClick={() => handleCardClick("employees")}
                      >
                        <div className="stat-icon">🏢</div>
                        <div className="stat-label">Departments</div>
                        <div className="stat-value">
                          {stats.departments || 0}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN – reminders + Employee Work Rate (same for all roles for now) */}
            <div className="col-lg-4 d-flex flex-column gap-4">

              {/* Employee Work Rate */}
              <div className="dashboard-chart-card">
                <div className="chart-header">
                  <h3 className="chart-title">📊 Empoloyee Work Rate</h3>
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span className="legend-dot blue"></span>
                      <span className="legend-dot green"></span>
                      <span className="legend-dot seg-red"></span>
                    </div>
                  </div>
                </div>

                <div className="card-body access-vertical">
                  {/* TOP: full-width animated multi-ring chart */}
                  <div className="access-chart-wrap access-chart-full">
                    <svg viewBox="0 0 140 140" className="access-chart-svg">
                      {(() => {
                        const baseRadius = 62;          // outer ring
                        const ringGap = 8;              // distance between rings
                        const total = EMPLOYMENT_BREAKDOWN.reduce(
                          (sum, item) => sum + item.value,
                          0
                        );

                        return EMPLOYMENT_BREAKDOWN.map((item, index) => {
                          const radius = baseRadius - index * ringGap;
                          const circumference = 2 * Math.PI * radius;
                          const fraction = total ? item.value / total : 0;
                          const length = fraction * circumference;

                          return (
                            <g key={item.key}>
                              {/* grey base ring */}
                              <circle
                                cx="70"
                                cy="70"
                                r={radius}
                                className="access-segment-bg"
                              />
                              {/* colored animated ring */}
                              <circle
                                cx="70"
                                cy="70"
                                r={radius}
                                className={`access-segment ${item.colorClass}`}
                                style={{
                                  '--dash': length,
                                  '--gap': circumference - length,
                                  '--delay': `${index * 0.18}s`,
                                }}
                              />
                            </g>
                          );
                        });
                      })()}
                    </svg>

                    <div className="access-chart-center">
                      <div className="access-center-value">
                        {EMPLOYMENT_BREAKDOWN.reduce((s, i) => s + i.value, 0)}
                      </div>
                      <div className="access-center-label">Total Staff</div>
                    </div>
                  </div>

                  {/* BOTTOM: Category values + tiny badges */}
                  <div className="access-legend access-legend-bottom">
                    {EMPLOYMENT_BREAKDOWN.map((item) => (
                      <div className="access-legend-row" key={item.key}>
                        <div className="legend-label-wrap">
                          <span className={`legend-dot ${item.colorClass}`} />
                          <span className="legend-label">{item.label}</span>
                        </div>
                        <div className="legend-values">
                          <span className="legend-count">{item.value}</span>
                          <span
                            className={
                              item.colorClass === 'seg-red'
                                ? 'legend-badge badge-down'
                                : 'legend-badge badge-up'
                            }
                          >
                            {item.colorClass === 'seg-red' ? '-1.2%' : '+3.4%'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* All Employees */}
              <div className="dashboard-chart-card">
                <div className="chart-header">
                  <h3 className="chart-title">🧑‍🤝‍🧑 All Employees</h3>
                </div>
                {/*  add employees-scroll to make it scrollable */}
                <div className="card-body reminders-body employees-scroll">
                  {employees.map((item, index) => {
                    const isActive = item.status === "active"; // status-based
                    return (
                      <div
                        key={item._id || item.employeeId || index}
                        className={
                          "reminder-item" +
                          (isActive ? " reminder-item-active" : "")
                        }
                        onClick={() => handleReminderClick(index)}
                      >
                        <div className="reminder-icon text-center" >{item.firstName.charAt(0)}</div>
                        <div className="reminder-text">
                          <div className="reminder-title">
                            {item.firstName} {item.lastName}
                          </div>
                          <div className="reminder-subtitle">
                            {item.email}
                          </div>
                        </div>

                        {/* Tick for active, cross for others */}
                        <span className="check-badge">
                          {item.isActive ? "✓" : "❌"}
                        </span>
                      </div>
                    );
                  })}
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