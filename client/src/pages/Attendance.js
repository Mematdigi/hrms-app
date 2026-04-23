import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { attendanceAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';

function Attendance() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const isHR = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';

  // --- Helper: format any date as "22 Apr 2026" ---
  // Used everywhere on this page for a consistent date display.
  const formatDate = (dateInput) => {
    if (!dateInput) return '—';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric'
    });
  };

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Employee Data
  const [attendance, setAttendance] = useState([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [punchTime, setPunchTime] = useState(null);       // formatted string, e.g. "09:15 AM"
  const [punchOutTime, setPunchOutTime] = useState(null); // formatted string, e.g. "06:00 PM"
  const [todayWorkingHours, setTodayWorkingHours] = useState(0); // today's hours only
  const [attendanceSummary, setAttendanceSummary] = useState({
    workingDays: 0, present: 0, absent: 0, late: 0, shortLeaves: 0, halfDays: 0, totalHours: 0
  });
  const [calendarData, setCalendarData] = useState([]);

  // HR Data
  const [allAttendance, setAllAttendance] = useState([]);
  const [hrSummary, setHrSummary] = useState({ total: 0, present: 0, absent: 0, late: 0, short: 0, half: 0 });
  const [filters, setFilters] = useState({ name: '', status: '', dept: '' });

  // --- EFFECTS ---
  useEffect(() => {
    if (isHR) {
      fetchHRData();
    } else {
      fetchEmployeeData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHR, filters.status, filters.dept]);

  // Re-fetch when month changes
  useEffect(() => {
    if (!isHR) {
      fetchEmployeeData();
    } else {
      fetchHRData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate.getMonth(), currentDate.getFullYear()]);

  // --- API CALLS ---
  const fetchEmployeeData = async () => {
    setLoading(true);
    try {
      const response = await attendanceAPI.getAttendance({ employeeId: user?.id });
      const logs = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setAttendance(logs);

      // ── Today's Record ──
      const todayStr = new Date().toDateString();
      const todayRecord = logs.find(a => new Date(a.date).toDateString() === todayStr);

      if (todayRecord) {
        // Check-In / Check-Out state — same logic as Dashboard.js
        if (todayRecord.checkInTime && !todayRecord.checkOutTime) {
          setCheckedIn(true);
        } else {
          setCheckedIn(false);
        }

        // Punch In time — store as formatted string (same as Dashboard)
        if (todayRecord.checkInTime) {
          const formatted = new Date(todayRecord.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setPunchTime(formatted);
        } else {
          setPunchTime(null);
        }

        // Punch Out time — store as formatted string
        if (todayRecord.checkOutTime) {
          const formatted = new Date(todayRecord.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setPunchOutTime(formatted);
        } else {
          setPunchOutTime(null);
        }

        // ── TODAY'S Working Hours (not monthly total) ──
        if (todayRecord.workingHours) {
          setTodayWorkingHours(parseFloat(todayRecord.workingHours).toFixed(2));
        } else if (todayRecord.checkInTime && !todayRecord.checkOutTime) {
          // Still checked in — calculate live hours from check-in until now
          const checkInMs = new Date(todayRecord.checkInTime).getTime();
          const nowMs = Date.now();
          const diffHrs = ((nowMs - checkInMs) / (1000 * 60 * 60)).toFixed(2);
          setTodayWorkingHours(diffHrs);
        } else {
          setTodayWorkingHours(0);
        }
      } else {
        // No record for today
        setCheckedIn(false);
        setPunchTime(null);
        setPunchOutTime(null);
        setTodayWorkingHours(0);
      }

      // ── Monthly Summary ──
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const currentMonthLogs = logs.filter(a => {
        const d = new Date(a.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

      setAttendanceSummary({
        workingDays: currentMonthLogs.length,
        present: currentMonthLogs.filter(a => a.status === 'present').length,
        absent: currentMonthLogs.filter(a => a.status === 'absent').length,
        late: currentMonthLogs.filter(a => a.status === 'late').length,
        shortLeaves: currentMonthLogs.filter(a => a.status === 'short-leave').length,
        halfDays: currentMonthLogs.filter(a => a.status === 'half-day').length,
        totalHours: currentMonthLogs.reduce((acc, curr) => acc + (parseFloat(curr.workingHours) || 0), 0).toFixed(2)
      });

      setCalendarData(currentMonthLogs);

    } catch (error) {
      console.error('Database fetch error:', error);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHRData = async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const from = new Date(year, month, 1).toISOString().split('T')[0];
      const to = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const response = await attendanceAPI.getAllAttendance({
        from,
        to,
        status: filters.status
      });

      let data = [];
      if (Array.isArray(response.data)) {
        data = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        data = response.data.data;
      }

      // Client-side filters
      let filteredData = data;
      if (filters.name) {
        filteredData = filteredData.filter(record =>
          record.username?.toLowerCase().includes(filters.name.toLowerCase()) ||
          record.employee?.firstName?.toLowerCase().includes(filters.name.toLowerCase()) ||
          record.employee?.lastName?.toLowerCase().includes(filters.name.toLowerCase())
        );
      }
      if (filters.dept) {
        filteredData = filteredData.filter(record =>
          record.employee?.department?.toLowerCase() === filters.dept.toLowerCase()
        );
      }

      setAllAttendance(filteredData);

      const uniqueEmployees = [...new Set(filteredData.map(r => r.employee?._id || r.employee))];
      setHrSummary({
        total: uniqueEmployees.length,
        present: filteredData.filter(r => r.status === 'present').length,
        absent: filteredData.filter(r => r.status === 'absent').length,
        late: filteredData.filter(r => r.status === 'late').length,
        short: filteredData.filter(r => r.status === 'short-leave').length,
        half: filteredData.filter(r => r.status === 'half-day').length
      });

    } catch (error) {
      console.error("HR Fetch Error", error);
      setAllAttendance([]);
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLERS ---
  const handlePunch = async () => {
    setLoading(true);
    try {
      if (!checkedIn) {
        await attendanceAPI.checkIn({ employeeId: user?.id });
        alert('✅ Checked In Successfully');
      } else {
        await attendanceAPI.checkOut({ employeeId: user?.id });
        alert('✅ Checked Out Successfully');
      }
      // Refresh state from database — same as Dashboard pattern
      await fetchEmployeeData();
    } catch (error) {
      console.error('Punch failed:', error);
      alert('❌ Action failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const headers = ["Employee,Date,Punch In,Punch Out,Total Hours,Status\n"];
    const csvRows = allAttendance.map(row => {
      const employeeName = row.username || (row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : 'Unknown');
      return `${employeeName},${formatDate(row.date)},${row.checkInTime ? new Date(row.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'},${row.checkOutTime ? new Date(row.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'},${row.workingHours || '-'},${row.status}`;
    });
    const csvContent = "data:text/csv;charset=utf-8," + headers + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_report_${currentDate.getMonth() + 1}_${currentDate.getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Month navigation — create new Date to avoid mutation
  const goToPrevMonth = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  // --- RENDER HELPERS ---
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="cal-day empty"></div>);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = new Date(year, month, day).toDateString();
      const record = calendarData.find(d => new Date(d.date).toDateString() === dateStr);

      let statusClass = '';
      if (record) {
        if (record.status === 'present') statusClass = 'dot-present';
        else if (record.status === 'absent') statusClass = 'dot-absent';
        else if (record.status === 'late') statusClass = 'dot-late';
        else if (record.status === 'half-day') statusClass = 'dot-half';
        else if (record.status === 'short-leave') statusClass = 'dot-short';
      }

      days.push(
        <div key={day} className="cal-day">
          <span className="day-num">{day}</span>
          {statusClass && <span className={`status-dot ${statusClass}`}></span>}
        </div>
      );
    }
    return days;
  };

  if (loading) return <div className="p-5 text-center">Loading Attendance...</div>;

  return (
    <div className="attendance-page">

      {/* HEADER SECTION */}
      <header className="page-header">
        <div className="header-left">
          <h1><span className="m-3"><BackButton/></span> Attendance</h1>
          {/* <p>Track your {isHR ? 'employee' : 'monthly'} attendance records</p> */}
        </div>

        <div className="header-right">

          {/* Employee: Apply Leave */}
          {!isHR && (
            <button
              className="btn-action btn-gradient-blue"
              onClick={() => navigate('/leave')}
            >
              <i className="bi bi-calendar-plus me-2"></i> Apply Leave
            </button>
          )}

          {/* HR: Download Report */}
          {isHR && (
            <button className="btn-action download-btn" onClick={handleDownload}>
              <i className="bi bi-cloud-download me-2"></i> Download Report
            </button>
          )}

          {/* Date Navigator */}
          <div className="date-nav">
            <button onClick={goToPrevMonth}>‹</button>
            <span>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <button onClick={goToNextMonth}>›</button>
          </div>
        </div>
      </header>

      {/* --- EMPLOYEE VIEW --- */}
      {!isHR ? (
        <div className="employee-layout fade-in">
          <div className="punch-widget-bar">

            {/* Punch Button — hidden for admin */}
            {user?.role !== 'admin' && (
              <div className={`punch-btn-area ${checkedIn ? 'checked-in' : ''}`}>
                <button className="btn-main-punch" onClick={handlePunch} disabled={loading}>
                  {loading ? 'Processing...' : (checkedIn ? 'Check Out' : 'Punch In')}
                </button>
              </div>
            )}

            <div className="punch-info">
              <div className="info-item">
                <small>Punch In</small>
                {/* punchTime is already a formatted string — display directly */}
                <strong>{punchTime || '--:--'}</strong>
              </div>
              <div className="info-item">
                <small>Punch Out</small>
                <strong>{punchOutTime || '--:--'}</strong>
              </div>
              <div className="info-item highlight">
                <small>Today's Hours</small>
                {/* Show TODAY's working hours, not monthly total */}
                <strong>{todayWorkingHours > 0 ? `${todayWorkingHours} hrs` : '--'}</strong>
              </div>
            </div>
          </div>

          {/* Monthly Summary Stats */}
          <div className="stats-row">
            <div className="stat-box"><small>Working Days</small><h3>{attendanceSummary.workingDays}</h3></div>
            <div className="stat-box"><small>Present</small><h3>{attendanceSummary.present}</h3></div>
            <div className="stat-box"><small>Absent</small><h3>{attendanceSummary.absent}</h3></div>
            <div className="stat-box"><small>Late</small><h3>{attendanceSummary.late}</h3></div>
            <div className="stat-box"><small>Short Leave</small><h3>{attendanceSummary.shortLeaves}</h3></div>
            <div className="stat-box"><small>Monthly Hours</small><h3>{attendanceSummary.totalHours}</h3></div>
          </div>

          <div className="content-split">
            <div className="table-section">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Punch In</th>
                    <th>Punch Out</th>
                    <th>Total Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(attendance) && attendance.length > 0 ? (
                    attendance.slice(0, 8).map(record => (
                      <tr key={record._id}>
                        <td>{formatDate(record.date)}</td>
                        <td>{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                        <td>{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                        <td>{record.workingHours ? `${record.workingHours} hrs` : '--'}</td>
                        <td><span className={`status-pill ${record.status?.toLowerCase().replace(' ', '-')}`}>{record.status}</span></td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="5" className="text-center p-4">No records yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="calendar-section">
              <h5>Attendance Calendar</h5>
              <div className="cal-header-row">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <span key={d}>{d}</span>)}
              </div>
              <div className="cal-grid">
                {renderCalendar()}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // --- HR VIEW ---
        <div className="hr-layout fade-in">
          {/* HR Stats */}
          <div className="stats-row hr">
            <div className="stat-box"><small>Total Employees</small><h3>{hrSummary.total}</h3><i className="bi bi-people"></i></div>
            <div className="stat-box"><small>Present This Month</small><h3>{hrSummary.present}</h3><i className="bi bi-person-check text-success"></i></div>
            <div className="stat-box"><small>Absent This Month</small><h3>{hrSummary.absent}</h3><i className="bi bi-person-x text-danger"></i></div>
            <div className="stat-box"><small>Late This Month</small><h3>{hrSummary.late}</h3><i className="bi bi-clock-history text-warning"></i></div>
            <div className="stat-box"><small>Short Leave This Month</small><h3>{hrSummary.short}</h3><i className="bi bi-box-arrow-right text-info"></i></div>
            <div className="stat-box"><small>Half Day This Month</small><h3>{hrSummary.half}</h3><i className="bi bi-pie-chart text-purple"></i></div>
          </div>

          {/* Filters */}
          <div className="filter-card-clean">
            <div className="filter-header">
              <i className="bi bi-funnel"></i> Filters
            </div>
            <div className="filter-input-group">
              <div className="search-box">
                <i className="bi bi-search"></i>
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={filters.name}
                  onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                />
              </div>

              <select className="filter-select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">All Status</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="half-day">Half Day</option>
              </select>

              <select className="filter-select" value={filters.dept} onChange={(e) => setFilters({ ...filters, dept: e.target.value })}>
                <option value="">All Departments</option>
                <option value="IT">IT</option>
                <option value="HR">HR</option>
                <option value="Sales">Sales</option>
              </select>
            </div>
          </div>

          {/* HR Table */}
          <div className="table-section full-width">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Punch In</th>
                  <th>Punch Out</th>
                  <th>Total Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(allAttendance) && allAttendance.length > 0 ? (
                  allAttendance.map(record => (
                    <tr key={record._id}>
                      <td>
                        <div className="emp-cell">
                          <div className="avatar">{record.username ? record.username[0].toUpperCase() : 'U'}</div>
                          <span>{record.username || (record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : 'Unknown')}</span>
                        </div>
                      </td>
                      <td>{formatDate(record.date)}</td>
                      <td>{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                      <td>{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                      <td>{record.workingHours ? `${record.workingHours} hrs` : '--'}</td>
                      <td><span className={`status-pill ${record.status?.toLowerCase().replace(' ', '-')}`}>{record.status}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" className="text-center p-4">No records found matching filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Attendance;