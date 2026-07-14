import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { attendanceAPI, regularizationAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { Modal, Button, Form } from 'react-bootstrap';

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
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // --- Helper: today's date as YYYY-MM-DD for <input type="date" max="..."> ---
  const todayInputValue = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // --- Helper: color styling for regularization status pills ---
  const getRegStatusStyle = (status) => {
    switch (status) {
      case 'approved':
        return { background: '#d4edda', color: '#155724' };
      case 'rejected':
        return { background: '#f8d7da', color: '#721c24' };
      default:
        return { background: '#fff3cd', color: '#856404' }; // pending
    }
  };

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Punch Out Confirmation Modal State
  const [showPunchOutConfirm, setShowPunchOutConfirm] = useState(false);
  const [punchOutLoading, setPunchOutLoading] = useState(false);

  // Employee Data
  const [attendance, setAttendance] = useState([]); // Full unfiltered data - NEVER modified by filters
  const [checkedIn, setCheckedIn] = useState(false);
  const [punchTime, setPunchTime] = useState(null);       // formatted string, e.g. "09:15 AM"
  const [punchOutTime, setPunchOutTime] = useState(null); // formatted string, e.g. "06:00 PM"
  const [todayWorkingHours, setTodayWorkingHours] = useState(0); // today's hours only
  const [attendanceSummary, setAttendanceSummary] = useState({
    workingDays: 0, present: 0, absent: 0, late: 0, shortLeaves: 0, halfDays: 0, totalHours: 0
  });
  const [calendarData, setCalendarData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null); // Selected date for filtering

  // HR Data
  const [allAttendance, setAllAttendance] = useState([]);
  const [hrSummary, setHrSummary] = useState({ total: 0, present: 0, absent: 0, late: 0, short: 0, half: 0 });
  const [filters, setFilters] = useState({ name: '', status: '', dept: '' });

  // Regularization — Employee side
  const [showRegularizeModal, setShowRegularizeModal] = useState(false);
  const [regularizeDate, setRegularizeDate] = useState('');
  const [regularizeReason, setRegularizeReason] = useState('');
  const [regularizeSubmitting, setRegularizeSubmitting] = useState(false);
  const [myRegularizations, setMyRegularizations] = useState([]);

  // Regularization — HR side
  const [hrRegularizations, setHrRegularizations] = useState([]);
  const [regFilter, setRegFilter] = useState('pending'); // '', 'pending', 'approved', 'rejected'
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [regActionLoading, setRegActionLoading] = useState(false);

  // --- EFFECTS ---
  useEffect(() => {
    if (isHR) {
      fetchHRData();
      fetchHrRegularizations();
    } else {
      fetchEmployeeData();
      fetchMyRegularizations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHR]);

  // Re-fetch when month changes
  useEffect(() => {
    if (!isHR) {
      fetchEmployeeData();
    } else {
      fetchHRData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate.getMonth(), currentDate.getFullYear()]);

  // Re-fetch HR regularization list whenever the status filter changes
  useEffect(() => {
    if (isHR) {
      fetchHrRegularizations(regFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regFilter]);

  // --- API CALLS ---
  const fetchEmployeeData = async () => {
    setLoading(true);
    try {
      const response = await attendanceAPI.getAttendance({ employeeId: user?.id });
      const logs = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setAttendance(logs); // Store FULL unfiltered data

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

      // ── Monthly Summary — filter by SELECTED MONTH, not today's month ──
      const selectedMonth = currentDate.getMonth();
      const selectedYear = currentDate.getFullYear();
      const selectedMonthLogs = logs.filter(a => {
        const d = new Date(a.date);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });

      setAttendanceSummary({
        workingDays: selectedMonthLogs.length,
        present: selectedMonthLogs.filter(a => a.status === 'present').length,
        absent: selectedMonthLogs.filter(a => a.status === 'absent').length,
        late: selectedMonthLogs.filter(a => a.status === 'late').length,
        shortLeaves: selectedMonthLogs.filter(a => a.status === 'short-leave').length,
        halfDays: selectedMonthLogs.filter(a => a.status === 'half-day').length,
        totalHours: selectedMonthLogs.reduce((acc, curr) => acc + (parseFloat(curr.workingHours) || 0), 0).toFixed(2)
      });

      setCalendarData(selectedMonthLogs);

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

      // Fetch without status filter first, then apply client-side
      const response = await attendanceAPI.getAllAttendance({
        from,
        to
      });

      let data = [];
      if (Array.isArray(response.data)) {
        data = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        data = response.data.data;
      } else if (response.data && typeof response.data === 'object') {
        // Handle case where data might be nested differently
        data = Array.isArray(response.data) ? response.data : [];
      }

      // Client-side filters - apply all filters here
      let filteredData = data;

      // Apply status filter
      if (filters.status) {
        filteredData = filteredData.filter(record =>
          record.status?.toLowerCase() === filters.status.toLowerCase()
        );
      }

      // Apply name filter
      if (filters.name) {
        filteredData = filteredData.filter(record =>
          record.username?.toLowerCase().includes(filters.name.toLowerCase()) ||
          record.employee?.firstName?.toLowerCase().includes(filters.name.toLowerCase()) ||
          record.employee?.lastName?.toLowerCase().includes(filters.name.toLowerCase())
        );
      }

      // Apply department filter
      if (filters.dept) {
        filteredData = filteredData.filter(record =>
          record.employee?.department?.toLowerCase() === filters.dept.toLowerCase()
        );
      }

      setAllAttendance(filteredData);

      // Calculate summary from ALL data (not filtered data) for the month stats
      const totalEmployeesInMonth = [...new Set(data.map(r => r.employee?._id || r.username || r.employee))];

      setHrSummary({
        total: totalEmployeesInMonth.length,
        present: data.filter(r => r.status === 'present').length,
        absent: data.filter(r => r.status === 'absent').length,
        late: data.filter(r => r.status === 'late').length,
        short: data.filter(r => r.status === 'short-leave').length,
        half: data.filter(r => r.status === 'half-day').length
      });

    } catch (error) {
      console.error("HR Fetch Error", error);
      setAllAttendance([]);
      setHrSummary({ total: 0, present: 0, absent: 0, late: 0, short: 0, half: 0 });
    } finally {
      setLoading(false);
    }
  };

  // ── Regularization: fetch my own requests (employee) ──
  const fetchMyRegularizations = async () => {
    try {
      const response = await regularizationAPI.getMine(user?.id);
      const list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setMyRegularizations(list);
    } catch (error) {
      console.error('Failed to fetch regularization requests:', error);
      setMyRegularizations([]);
    }
  };

  // ── Regularization: fetch all requests (HR) ──
  const fetchHrRegularizations = async (statusFilter = regFilter) => {
    try {
      const response = await regularizationAPI.getAll(statusFilter ? { status: statusFilter } : {});
      const list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setHrRegularizations(list);
    } catch (error) {
      console.error('Failed to fetch HR regularization requests:', error);
      setHrRegularizations([]);
    }
  };

  // --- HANDLERS ---
  const handlePunchClick = () => {
    if (checkedIn) {
      setShowPunchOutConfirm(true);
    } else {
      handlePunch();
    }
  };

  const handlePunch = async () => {
    setLoading(true);
    try {
      if (!checkedIn) {
        await attendanceAPI.checkIn({ employeeId: user?.id });
        alert('✅ Checked In Successfully');
      } else {
        setPunchOutLoading(true);
        await attendanceAPI.checkOut({ employeeId: user?.id });
        alert('✅ Checked Out Successfully');
        setShowPunchOutConfirm(false);
      }
      // Refresh state from database — same as Dashboard pattern
      await fetchEmployeeData();
    } catch (error) {
      console.error('Punch failed:', error);
      alert('❌ Action failed. Please try again.');
    } finally {
      setLoading(false);
      setPunchOutLoading(false);
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

  // ── Regularization Handlers: Employee ──
  const openRegularizeModal = () => {
    setRegularizeDate('');
    setRegularizeReason('');
    setShowRegularizeModal(true);
  };

  const handleSubmitRegularize = async () => {
    if (!regularizeDate) {
      alert('Please select the date you want to regularize.');
      return;
    }
    if (!regularizeReason.trim()) {
      alert('Please provide a reason for the regularization request.');
      return;
    }
    setRegularizeSubmitting(true);
    try {
      await regularizationAPI.submit({
        employeeId: user?.id,
        date: regularizeDate,
        reason: regularizeReason.trim()
      });
      alert('✅ Regularization request submitted. Awaiting HR approval.');
      setShowRegularizeModal(false);
      setRegularizeDate('');
      setRegularizeReason('');
      await fetchMyRegularizations();
    } catch (error) {
      console.error('Regularization submit failed:', error);
      alert(`❌ ${error?.response?.data?.message || 'Failed to submit request. Please try again.'}`);
    } finally {
      setRegularizeSubmitting(false);
    }
  };

  // ── Regularization Handlers: HR ──
  const handleApproveRegularization = async (id) => {
    if (!window.confirm('Approve this regularization request? The attendance for that date will be set to Present (9:30 AM – 6:30 PM, 9 hrs).')) {
      return;
    }
    setRegActionLoading(true);
    try {
      await regularizationAPI.approve(id, { hrId: user?.id });
      await fetchHrRegularizations();
      await fetchHRData(); // refresh attendance table/stats since a record just changed
    } catch (error) {
      console.error('Approve failed:', error);
      alert(`❌ ${error?.response?.data?.message || 'Failed to approve request.'}`);
    } finally {
      setRegActionLoading(false);
    }
  };

  const openRejectModal = (id) => {
    setRejectingId(id);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectRegularization = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }
    setRegActionLoading(true);
    try {
      await regularizationAPI.reject(rejectingId, {
        hrId: user?.id,
        rejectionReason: rejectReason.trim()
      });
      setShowRejectModal(false);
      setRejectingId(null);
      setRejectReason('');
      await fetchHrRegularizations();
    } catch (error) {
      console.error('Reject failed:', error);
      alert(`❌ ${error?.response?.data?.message || 'Failed to reject request.'}`);
    } finally {
      setRegActionLoading(false);
    }
  };

  // --- RENDER HELPERS ---
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    // Helper to format date as YYYY-MM-DD (local time, timezone-safe)
    const formatDateKey = (year, month, day) => {
      const d = new Date(year, month, day);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="cal-day empty"></div>);

    for (let day = 1; day <= daysInMonth; day++) {
      // Use YYYY-MM-DD format for comparison (timezone-safe)
      const currentDayKey = formatDateKey(year, month, day);

      // Find matching record by comparing date strings
      const record = calendarData.find(d => {
        const recordDate = new Date(d.date);
        const recordDayKey = formatDateKey(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate());
        return recordDayKey === currentDayKey;
      });

      // Check if this day is selected
      const isSelected = selectedDate && selectedDate.getDate() === day &&
        selectedDate.getMonth() === month &&
        selectedDate.getFullYear() === year;

      let statusClass = '';
      if (record) {
        if (record.status === 'present') statusClass = 'dot-present';
        else if (record.status === 'absent') statusClass = 'dot-absent';
        else if (record.status === 'late') statusClass = 'dot-late';
        else if (record.status === 'half-day') statusClass = 'dot-half';
        else if (record.status === 'short-leave') statusClass = 'dot-short';
      }

      days.push(
        <div
          key={day}
          className={`cal-day ${isSelected ? 'selected' : ''}`}
          onClick={() => handleDateClick(year, month, day)}
        >
          <span className="day-num">{day}</span>
          {statusClass && <span className={`status-dot ${statusClass}`}></span>}
        </div>
      );
    }
    return days;
  };

  // Handle calendar date click
  const handleDateClick = (year, month, day) => {
    const clickedDate = new Date(year, month, day);
    setSelectedDate(clickedDate);
  };

  if (loading) return <div className="p-5 text-center">Loading Attendance...</div>;

  return (
    <div className="attendance-page">

      {/* HEADER SECTION */}
      <header className="page-header">
        <div className="header-left">
          <h1><span className="m-3"><BackButton /></span> Attendance</h1>
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

          {/* Employee: Regularize Attendance (hidden for admin, same as punch button) */}
          {!isHR && user?.role !== 'admin' && (
            <button
              className="btn-action"
              style={{ background: 'linear-gradient(135deg, #ff9800, #f57c00)', color: '#fff', border: 'none' }}
              onClick={openRegularizeModal}
            >
              <i className="bi bi-pencil-square me-2"></i> Regularize Attendance
            </button>
          )}

          {/* HR: Download Report */}
          {isHR && (
            <button className="btn-action download-btn" onClick={handleDownload}>
              <i className="bi bi-cloud-download me-2"></i> Download Report
            </button>
          )}

          {
            !isHR && (
          <div className="date-nav">
            <button onClick={goToPrevMonth}>‹</button>
            <span>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <button onClick={goToNextMonth}>›</button>
          </div>
            )
          }
        </div>
      </header>

      {/* --- EMPLOYEE VIEW --- */}
      {!isHR ? (
        <div className="employee-layout fade-in">
          <div className="punch-widget-bar">

            {/* Punch Button — hidden for admin */}
            {user?.role !== 'admin' && (
              <div className={`punch-btn-area ${checkedIn ? 'checked-in' : ''}`}>
                <button className="btn-main-punch" onClick={handlePunchClick} disabled={loading || punchOutLoading}>
                  {loading || punchOutLoading ? 'Processing...' : (checkedIn ? 'Check Out' : 'Punch In')}
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
                    (() => {
                      // Filter by selected date if one is picked — from FULL unfiltered attendance data
                      let tablData = attendance;
                      if (selectedDate) {
                        const selectedDateStr = selectedDate.toDateString();
                        tablData = attendance.filter(record =>
                          new Date(record.date).toDateString() === selectedDateStr
                        );
                      }

                      return tablData.slice(0, 8).map(record => (
                        <tr key={record._id}>
                          <td>
                            {formatDate(record.date)}
                            {record.isRegularized && (
                              <span
                                title="This day's attendance was regularized"
                                style={{ marginLeft: 6, fontSize: 11, color: '#f57c00' }}
                              >
                                <i className="bi bi-pencil-square"></i>
                              </span>
                            )}
                          </td>
                          <td>{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                          <td>{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                          <td>{record.workingHours ? `${record.workingHours} hrs` : '--'}</td>
                          <td><span className={`status-pill ${record.status?.toLowerCase().replace(' ', '-')}`}>{record.status}</span></td>
                        </tr>
                      ));
                    })()
                  ) : (
                    <tr><td colSpan="5" className="text-center p-4">No records yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="calendar-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h5 style={{ margin: 0 }}>Attendance Calendar</h5>
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate(null)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Clear Date Filter
                  </button>
                )}
              </div>
              {selectedDate && (
                <div style={{
                  padding: '8px 12px',
                  background: '#e3f2fd',
                  borderLeft: '4px solid #1976d2',
                  borderRadius: '4px',
                  marginBottom: '12px',
                  fontSize: '13px',
                  fontWeight: '500'
                }}>
                  📅 Filtering by: {selectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              )}
              <div className="cal-header-row">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <span key={d}>{d}</span>)}
              </div>
              <div className="cal-grid">
                {renderCalendar()}
              </div>
            </div>
          </div>

          {/* Regularization History — Employee */}
          {myRegularizations.length > 0 && (
            <div className="table-section" style={{ marginTop: '20px' }}>
              <h5 style={{ marginBottom: '12px' }}>
                <i className="bi bi-pencil-square me-2"></i>My Regularization Requests
              </h5>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>HR Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {myRegularizations.map(req => (
                    <tr key={req._id}>
                      <td>{formatDate(req.date)}</td>
                      <td>{req.reason}</td>
                      <td>
                        <span
                          className="status-pill"
                          style={{ ...getRegStatusStyle(req.status), textTransform: 'capitalize' }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td>
                        {req.status === 'rejected'
                          ? <span style={{ color: '#c82333' }}>{req.rejectionReason}</span>
                          : (req.status === 'approved' ? 'Attendance updated to Present' : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

          {/* Regularization Requests — HR */}
          <div className="filter-card-clean" style={{ marginBottom: '16px' }}>
            <div className="filter-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><i className="bi bi-pencil-square"></i> Regularization Requests</span>
              <select
                className="filter-select"
                value={regFilter}
                onChange={(e) => setRegFilter(e.target.value)}
                style={{ maxWidth: 160 }}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="">All</option>
              </select>
            </div>

            <div className="table-section full-width" style={{ marginTop: '10px' }}>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {hrRegularizations.length > 0 ? (
                    hrRegularizations.map(req => (
                      <tr key={req._id}>
                        <td>
                          <div className="emp-cell">
                            <div className="avatar">{req.username ? req.username[0].toUpperCase() : 'U'}</div>
                            <span>{req.username || (req.employee ? `${req.employee.firstName} ${req.employee.lastName}` : 'Unknown')}</span>
                          </div>
                        </td>
                        <td>{formatDate(req.date)}</td>
                        <td>{req.reason}</td>
                        <td>
                          <span
                            className="status-pill"
                            style={{ ...getRegStatusStyle(req.status), textTransform: 'capitalize' }}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td>
                          {req.status === 'rejected'
                            ? <span style={{ color: '#c82333' }}>{req.rejectionReason}</span>
                            : '—'}
                        </td>
                        <td>
                          {req.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="btn-action"
                                style={{ background: '#28a745', color: '#fff', border: 'none', padding: '4px 10px', fontSize: 12 }}
                                disabled={regActionLoading}
                                onClick={() => handleApproveRegularization(req._id)}
                              >
                                <i className="bi bi-check-lg"></i> Accept
                              </button>
                              <button
                                className="btn-action"
                                style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '4px 10px', fontSize: 12 }}
                                disabled={regActionLoading}
                                onClick={() => openRejectModal(req._id)}
                              >
                                <i className="bi bi-x-lg"></i> Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: '#888' }}>
                              {req.reviewedAt ? formatDate(req.reviewedAt) : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="6" className="text-center p-4">No regularization requests found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
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
                <option value="Overtime">OverTime</option>
                <option value="half-day">Half Day</option>
              </select>

              {/* <select className="filter-select" value={filters.dept} onChange={(e) => setFilters({ ...filters, dept: e.target.value })}>
                <option value="">All Departments</option>
                <option value="IT">IT</option>
                <option value="HR">HR</option>
                <option value="Sales">Sales</option>
              </select> */}

              {/* Date Navigator */}
          <div className="date-nav">
            <button onClick={goToPrevMonth}>‹</button>
            <span>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <button onClick={goToNextMonth}>›</button>
          </div>
            </div>
          </div>

          {/* HR Table */}
          <div>
            <div className='row'>
            <div className='col-md-8'>

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
                      (() => {
                        // Filter by selected date if one is picked
                        let tableData = allAttendance;
                        if (selectedDate) {
                          const selectedDateStr = selectedDate.toDateString();
                          tableData = allAttendance.filter(record =>
                            new Date(record.date).toDateString() === selectedDateStr
                          );
                        }

                        // Apply additional filters
                        let filteredData = tableData;
                        if (filters.name) {
                          filteredData = filteredData.filter(record =>
                            record.username?.toLowerCase().includes(filters.name.toLowerCase()) ||
                            record.employee?.firstName?.toLowerCase().includes(filters.name.toLowerCase()) ||
                            record.employee?.lastName?.toLowerCase().includes(filters.name.toLowerCase())
                          );
                        }
                        if (filters.status) {
                          filteredData = filteredData.filter(record =>
                            record.status?.toLowerCase() === filters.status.toLowerCase()
                          );
                        }
                        if (filters.dept) {
                          filteredData = filteredData.filter(record =>
                            record.employee?.department?.toLowerCase() === filters.dept.toLowerCase()
                          );
                        }

                        return filteredData.map(record => (
                          <tr key={record._id}>
                            <td>
                              <div className="emp-cell">
                                <div className="avatar">{record.username ? record.username[0].toUpperCase() : 'U'}</div>
                                <span>{record.username || (record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : 'Unknown')}</span>
                              </div>
                            </td>
                            <td>
                              {formatDate(record.date)}
                              {record.isRegularized && (
                                <span
                                  title="This day's attendance was regularized"
                                  style={{ marginLeft: 6, fontSize: 11, color: '#f57c00' }}
                                >
                                  <i className="bi bi-pencil-square"></i>
                                </span>
                              )}
                            </td>
                            <td>{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                            <td>{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                            <td>{record.workingHours ? `${record.workingHours} hrs` : '--'}</td>
                            <td><span className={`status-pill ${record.status?.toLowerCase().replace(' ', '-')}`}>{record.status}</span></td>
                          </tr>
                        ));
                      })()
                    ) : (
                      <tr><td colSpan="6" className="text-center p-4">No records found matching filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className='col-md-4'>          {/* Calendar Section - At Top */}
              <div className="calendar-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h5>📅Click Date to Filter</h5>
                  {selectedDate && (
                    <button
                      onClick={() => setSelectedDate(null)}
                      style={{
                        padding: '6px 14px',
                        fontSize: '12px',
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#d32f2f'}
                      onMouseLeave={(e) => e.target.style.background = '#f44336'}
                    >
                      ✕ Clear Date Filter
                    </button>
                  )}
                </div>
                {selectedDate && (
                  <div style={{
                    padding: '10px 14px',
                    background: '#e3f2fd',
                    borderLeft: '4px solid #1976d2',
                    borderRadius: '4px',
                    marginBottom: '14px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#1565c0'
                  }}>
                    🔍 Showing all employees' attendance for: <strong>{selectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                  </div>
                )}
                <div className="cal-header-row">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <span key={d}>{d}</span>)}
                </div>
                <div className="cal-grid">
                  {renderCalendar()}
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================== */}
      {/* PUNCH OUT CONFIRMATION   */}
      {/* ======================== */}
      <Modal show={showPunchOutConfirm} onHide={() => setShowPunchOutConfirm(false)} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold fs-5">
            <i className="bi bi-exclamation-triangle me-2 text-warning"></i>Confirm Punch Out
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-3">
          <div className="alert py-3 small mb-3" style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, lineHeight: 1.6 }}>
            <i className="bi bi-info-circle me-2 text-warning fw-semibold"></i>
            <span className="fw-semibold">⚠️ Important Notice:</span> Once you punch out, you cannot punch in again today. Please make sure your work is complete before proceeding.
          </div>
          <div className="text-center py-2">
            <div style={{ fontSize: '2.5rem' }}>🕐</div>
            <div className="fw-bold mt-2">Current Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 flex-column gap-2">
          <Button
            variant="light"
            className="w-100 rounded-pill fw-semibold"
            onClick={() => setShowPunchOutConfirm(false)}
            disabled={punchOutLoading}
          >
            <i className="bi bi-x-lg me-2"></i>Cancel
          </Button>
          <Button
            className="w-100 rounded-pill fw-semibold"
            style={{ background: 'linear-gradient(135deg, #dc3545, #c82333)', border: 'none', color: '#fff' }}
            disabled={punchOutLoading}
            onClick={handlePunch}
          >
            {punchOutLoading
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Processing...</>
              : <><i className="bi bi-check-lg me-2"></i>Confirm Punch Out</>}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ======================== */}
      {/* REGULARIZE ATTENDANCE — Employee */}
      {/* ======================== */}
      <Modal show={showRegularizeModal} onHide={() => !regularizeSubmitting && setShowRegularizeModal(false)} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold fs-5">
            <i className="bi bi-pencil-square me-2 text-warning"></i>Regularize Attendance
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-3">
          <p className="small text-muted mb-3">
            Use this if you forgot to punch in/out or came in late on a past date. Once approved by HR,
            that day will be marked <strong>Present</strong> (9:30 AM – 6:30 PM, 9 hrs).
          </p>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">Date to Regularize</Form.Label>
              <Form.Control
                type="date"
                max={todayInputValue()}
                value={regularizeDate}
                onChange={(e) => setRegularizeDate(e.target.value)}
                disabled={regularizeSubmitting}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="fw-semibold small">Reason</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="e.g. Forgot to punch out after finishing work late"
                value={regularizeReason}
                onChange={(e) => setRegularizeReason(e.target.value)}
                disabled={regularizeSubmitting}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 flex-column gap-2">
          <Button
            className="w-100 rounded-pill fw-semibold"
            style={{ background: 'linear-gradient(135deg, #ff9800, #f57c00)', border: 'none', color: '#fff' }}
            disabled={regularizeSubmitting}
            onClick={handleSubmitRegularize}
          >
            {regularizeSubmitting
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Submitting...</>
              : <><i className="bi bi-send me-2"></i>Submit Request</>}
          </Button>
          <Button
            variant="light"
            className="w-100 rounded-pill fw-semibold"
            onClick={() => setShowRegularizeModal(false)}
            disabled={regularizeSubmitting}
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ======================== */}
      {/* REJECT REGULARIZATION — HR */}
      {/* ======================== */}
      <Modal show={showRejectModal} onHide={() => !regActionLoading && setShowRejectModal(false)} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold fs-5">
            <i className="bi bi-x-circle me-2 text-danger"></i>Reject Request
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-3">
          <p className="small text-muted mb-2">
            Let the employee know why this regularization request is being rejected.
          </p>
          <Form.Control
            as="textarea"
            rows={3}
            placeholder="e.g. No supporting reason provided / date already marked present"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            disabled={regActionLoading}
          />
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 flex-column gap-2">
          <Button
            className="w-100 rounded-pill fw-semibold"
            style={{ background: 'linear-gradient(135deg, #dc3545, #c82333)', border: 'none', color: '#fff' }}
            disabled={regActionLoading}
            onClick={handleRejectRegularization}
          >
            {regActionLoading
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Rejecting...</>
              : <><i className="bi bi-x-lg me-2"></i>Confirm Rejection</>}
          </Button>
          <Button
            variant="light"
            className="w-100 rounded-pill fw-semibold"
            onClick={() => setShowRejectModal(false)}
            disabled={regActionLoading}
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  );
}

export default Attendance;