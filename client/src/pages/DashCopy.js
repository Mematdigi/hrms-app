// src/components/Dashboard.js
import React, { useState } from "react";
// import "./Dashboard.scss";
import "bootstrap/dist/css/bootstrap.min.css";

const NAV_ITEMS = ["Dashboard", "Employee", "Projects", "Reports", "Schedule"];

const REMINDERS_DATA = [
  {
    title: "New Hire Check",
    subtitle: "Review onboarding progress.",
  },
  {
    title: "Job Post Updates",
    subtitle: "Share new internal roles weekly.",
  },
  {
    title: "Interview Scheduling",
    subtitle: "Schedule interviews for next week.",
  },
];

const EMPLOYEES = [
  { name: "Anika Rosser", team: "UI/UX Team", rate: "98.7%" },
  { name: "Roger Dias", team: "Illustrator Team", rate: "97.1%" },
  { name: "Charlie Korsgaard", team: "Graphic Design Team", rate: "96.8%" },
  // { name: "Carla Westervelt", team: "UI/UX Team", rate: "95.6%" },
  // { name: "Jaxson Geidt", team: "Graphic Design Team", rate: "95.3%" },
  // { name: "Livia Madsen", team: "UI/UX Team", rate: "94.8%" },
];

const MONTHS = ["June 2025", "July 2025", "August 2025"];

const Dashboard = () => {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [searchValue, setSearchValue] = useState("");
  const [activeReminderIndex, setActiveReminderIndex] = useState(1); // Job Post default
  const [scheduleView, setScheduleView] = useState("Timeline");
  const [monthIndex, setMonthIndex] = useState(0);

  const currentMonthLabel = MONTHS[monthIndex];

  const handleMonthClick = () => {
    setMonthIndex((prev) => (prev + 1) % MONTHS.length);
  };

  const handleShareClick = () => {
    // Replace with real share logic later
    alert("Share clicked! (Hook to real share flow here)");
  };

  const handleNavClick = (item) => {
    setActiveNav(item);
  };

  const handleReminderClick = (index) => {
    setActiveReminderIndex(index);
  };

  const handleScheduleViewClick = (view) => {
    setScheduleView(view);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    console.log("Searching for:", searchValue);
  };

  // ---------- LEFT COLUMN CONTENT BASED ON ACTIVE NAV ----------
  const renderLeftColumnContent = () => {
    if (activeNav !== "Dashboard") {
      // Simple placeholder screens for other nav items
      return (
        <div className="col-lg-8 d-flex flex-column gap-4">
          <div className="card hr-card">
            <div className="card-header hr-card-header">
              <span>{activeNav}</span>
            </div>
            <div className="card-body">
              <p className="mb-1 text-muted small">
                You clicked on <strong>{activeNav}</strong> tab.
              </p>
              <p className="mb-0">
                Here you can render the actual {activeNav.toLowerCase()} page
                later. For now, it’s just a placeholder to show the button is
                working.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Original dashboard layout
    return (
      <div className="col-lg-8 d-flex flex-column gap-4">
        {/* Worker Devices + Income Project */}
        <div className="row g-4">
          <div className="col-md-6">
            <div className="card h-100 hr-card">
              <div className="card-header hr-card-header">
                <span>Worker Devices</span>
                <button className="dots-btn">⋯</button>
              </div>
              <div className="card-body">
                <div className="gauge-wrap">
                  <div className="gauge-arc gauge-arc-left" />
                  <div className="gauge-arc gauge-arc-middle" />
                  <div className="gauge-arc gauge-arc-right" />
                  <div className="gauge-center">
                    <span className="gauge-label">Total Worker</span>
                    <span className="gauge-value">248</span>
                  </div>
                </div>
                <div className="mt-4">
                  <ul className="list-unstyled small mb-0">
                    <li className="d-flex justify-content-between">
                      <span>
                        <span className="dot dot-green" /> Illustrator
                      </span>
                      <span>95 Worker</span>
                    </li>
                    <li className="d-flex justify-content-between">
                      <span>
                        <span className="dot dot-orange" /> Graphic Designer
                      </span>
                      <span>67 Worker</span>
                    </li>
                    <li className="d-flex justify-content-between">
                      <span>
                        <span className="dot dot-blue" /> UI/UX Designer
                      </span>
                      <span>88 Worker</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Income Project */}
          <div className="col-md-6">
            <div className="card h-100 hr-card">
              <div className="card-header hr-card-header">
                <span>Income Project</span>
                <button className="dots-btn">⋯</button>
              </div>
              <div className="card-body">
                <div className="chart-legend mb-3">
                  <span>
                    <span className="dot dot-green" /> Target
                  </span>
                  <span>
                    <span className="dot dot-orange" /> Income
                  </span>
                </div>
                <div className="chart-placeholder">
                  {/* Replace with real chart later */}
                  <span>Line chart placeholder</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time Schedule */}
        <div className="card hr-card">
          <div className="card-header hr-card-header">
            <div className="d-flex align-items-center gap-3">
              <span>Time Schedule</span>
              <div className="schedule-tabs">
                {["Board", "Calendar", "Timeline", "List"].map((view) => (
                  <button
                    key={view}
                    className={
                      "schedule-pill" +
                      (scheduleView === view ? " active" : "")
                    }
                    onClick={() => handleScheduleViewClick(view)}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>
            <button className="dots-btn">⋯</button>
          </div>

          <div className="card-body timeline-body">
            <div className="d-flex justify-content-between mb-3 small text-muted">
              <span>Today</span>
              <span>Illustrator Team</span>
            </div>

            {scheduleView === "Timeline" ? (
              <div className="timeline-grid">
                <div className="timeline-hours d-flex justify-content-between small text-muted mb-2">
                  <span>9 AM</span>
                  <span>10 AM</span>
                  <span>11 AM</span>
                  <span>12 AM</span>
                  <span>13 PM</span>
                  <span>14 PM</span>
                </div>
                <div className="timeline-track">
                  <div className="task-block task-orange">
                    <div className="task-title">Concept Sketching</div>
                    <div className="task-meta">1h 30m</div>
                  </div>
                  <div className="task-block task-green">
                    <div className="task-title">
                      Background &amp; Environment Illustration
                    </div>
                    <div className="task-meta">2h 30m</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="schedule-placeholder">
                <p className="mb-1">
                  <strong>{scheduleView}</strong> view selected.
                </p>
                <p className="mb-0 small text-muted">
                  Here you can plug in the actual {scheduleView.toLowerCase()}{" "}
                  component. Right now it’s just a placeholder to show that the
                  buttons are working.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ---------- MAIN JSX ----------
  return (
   <>

   <div className="container-xxl hr-main m-0 p-3">
         {/* NAV + search row */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-3">
              <div className="logo-circle">
                <span className="logo-icon">★</span>
              </div>

              <ul className="nav nav-pills hr-tabs">
                {NAV_ITEMS.map((item) => (
                  <li className="nav-item" key={item}>
                    <button
                      className={
                        "nav-link" + (activeNav === item ? " active" : "")
                      }
                      onClick={() => handleNavClick(item)}
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="d-flex align-items-center gap-3">
              <form onSubmit={handleSearchSubmit} className="search-box">
                <i className="bi bi-search" />
                <input
                  type="text"
                  placeholder="Search"
                  className="form-control search-input"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </form>
              <button className="icon-btn" title="Notifications">
                <i className="bi bi-bell" />
              </button>
              <button className="icon-btn" title="Settings">
                <i className="bi bi-gear" />
              </button>
              <div className="avatar-circle" title="Profile">
                <span>IR</span>
              </div>
            </div>
          </div>
   </div>



    <div className="hr-page">
      {/* Top page header */}
      {/* <header className="hr-page-header container-xxl">
        <div className="d-flex align-items-center justify-content-between">
          <h1 className="hr-title">HR Management Dashboard</h1>
          <div className="figma-pill">
            <span className="figma-dot" />
            <span>Figma</span>
          </div>
        </div>
      </header> */}

      {/* Main dashboard shell */}
      <main className="container-xxl hr-main m-0 p-3">
        <div className="dashboard-shell">
         
          {/* Breadcrumb + month row */}
          <div className="d-flex justify-content-between align-items-start mb-4">
            <div>
              <div className="breadcrumb-text">
                Kindred Studio <span>&gt;</span> Dashboard
              </div>
              <h2 className="page-greeting">Have a Good Day Iris</h2>
            </div>
            <div className="d-flex align-items-center gap-3">
              <button
                type="button"
                className="btn btn-light btn-sm rounded-pill date-pill"
                onClick={handleMonthClick}
              >
                {currentMonthLabel}
              </button>
              <button
                type="button"
                className="btn btn-outline-light btn-sm rounded-pill share-pill"
                onClick={handleShareClick}
              >
                <i className="bi bi-share" />
                <span className="ms-2">Share</span>
              </button>
            </div>
          </div>

          {/* GRID: left + right */}
          <div className="row g-4">
            {/* LEFT COLUMN – varies with nav */}
            {renderLeftColumnContent()}

            {/* RIGHT COLUMN – reminders + employee work rate */}
            <div className="col-lg-4 d-flex flex-column gap-4">
              {/* Reminders */}
              <div className="card hr-card">
                <div className="card-header hr-card-header">
                  <span>Reminders</span>
                  <button className="dots-btn">⋯</button>
                </div>
                <div className="card-body reminders-body">
                  {REMINDERS_DATA.map((item, index) => {
                    const isActive = index === activeReminderIndex;
                    return (
                      <div
                        key={item.title}
                        className={
                          "reminder-item" +
                          (isActive ? " reminder-item-active" : "")
                        }
                        onClick={() => handleReminderClick(index)}
                      >
                        <div className="reminder-icon" />
                        <div className="reminder-text">
                          <div className="reminder-title">{item.title}</div>
                          <div className="reminder-subtitle">
                            {item.subtitle}
                          </div>
                        </div>
                        {isActive && <span className="check-badge">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Employee Work Rate */}
              <div className="card hr-card">
                <div className="card-header hr-card-header">
                  <span>Employee Work Rate</span>
                  <button className="dots-btn">⋯</button>
                </div>
                <div className="card-body employee-list">
                  {EMPLOYEES.map((emp) => (
                    <div key={emp.name} className="employee-row">
                      <div className="emp-avatar">{emp.name[0]}</div>
                      <div className="emp-info">
                        <div className="emp-name">{emp.name}</div>
                        <div className="emp-team">{emp.team}</div>
                      </div>
                      <div className="emp-rate">{emp.rate}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* END GRID */}
        </div>
      </main>
    </div>
   </>
  );
};

export default Dashboard;
