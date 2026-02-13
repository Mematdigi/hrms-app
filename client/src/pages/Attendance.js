import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { attendanceAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

function Attendance() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const isHR = user?.role === 'admin' || user?.role === 'hr';

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Employee Data
  const [attendance, setAttendance] = useState([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [punchTime, setPunchTime] = useState(null);
  const [punchOutTime, setPunchOutTime] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState({
    workingDays: 0, present: 0, absent: 0, late: 0, shortLeaves: 0, halfDays: 0, totalHours: 0
  });
  const [calendarData, setCalendarData] = useState([]);

  // HR Data
  const [allAttendance, setAllAttendance] = useState([]); // Default to empty array
  const [hrSummary, setHrSummary] = useState({ total: 0, present: 0, absent: 0, late: 0, short: 0, half: 0 });
  const [filters, setFilters] = useState({ name: '', status: '', dept: '' });

  // --- EFFECTS ---
  useEffect(() => {
    if (isHR) {
      fetchHRData();
    } else {
      fetchEmployeeData();
    }
  }, [isHR, currentDate, filters.status, filters.dept]); // Re-fetch on filter change

  // --- API CALLS ---

  // 1. Employee Fetch
  const fetchEmployeeData = async () => {
    setLoading(true);
    try {
      const response = await attendanceAPI.getAttendance({ employeeId: user?.id });
      // Safely access array
      const logs = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setAttendance(logs);
      
      const today = new Date().toDateString();
      const todayRecord = logs.find(a => new Date(a.date).toDateString() === today);
      
      if (todayRecord?.checkInTime && !todayRecord?.checkOutTime) {
        setCheckedIn(true);
        setPunchTime(new Date(todayRecord.checkInTime));
        setPunchOutTime(null);
      } else if (todayRecord?.checkInTime && todayRecord?.checkOutTime) {
        setCheckedIn(false);
        setPunchTime(new Date(todayRecord.checkInTime));
        setPunchOutTime(new Date(todayRecord.checkOutTime));
      } else {
        setCheckedIn(false);
        setPunchTime(null);
        setPunchOutTime(null);
      }

      const currentMonthLogs = logs.filter(a => new Date(a.date).getMonth() === currentDate.getMonth());
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
      console.error('Error fetching employee data:', error);
      setAttendance([]); // Fallback
    } finally { setLoading(false); }
  };

  // 2. HR Fetch (FIXED)
  const fetchHRData = async () => {
    setLoading(true);
    try {
      // Calculate from and to dates for the current month
      const from = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const to = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const response = await attendanceAPI.getAllAttendance({
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
        status: filters.status
        // Note: name and dept filters are not supported server-side, handle client-side if needed
      });

      // ✅ FIX: Robust check for array structure
      let data = [];
      if (Array.isArray(response.data)) {
          data = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
          data = response.data.data;
      }

      // Apply client-side filters for name and dept
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

      // Get unique employees from filtered data
      const uniqueEmployees = [...new Set(filteredData.map(r => r.employee?._id || r.employee))];

      // Calc HR Summary dynamically from filtered data (using lowercase status)
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
        setAllAttendance([]); // Prevent map error
    } finally { setLoading(false); }
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
      fetchEmployeeData();
    } catch (error) {
      // alert('❌ Punch failed. Please try again.');
    } finally { setLoading(false); }
  };

  const handleDownload = () => {
    // Simple CSV export logic
    const headers = ["Employee,Date,Punch In,Punch Out,Total Hours,Status\n"];
    const csvRows = allAttendance.map(row => {
        const employeeName = row.username || (row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : 'Unknown');
        return `${employeeName},${new Date(row.date).toLocaleDateString()},${row.checkInTime ? new Date(row.checkInTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'},${row.checkOutTime ? new Date(row.checkOutTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'},${row.workingHours || '-'},${row.status}`;
    });
    const csvContent = "data:text/csv;charset=utf-8," + headers + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_report_${currentDate.getMonth()+1}_${currentDate.getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          if(record.status === 'present') statusClass = 'dot-present';
          else if(record.status === 'absent') statusClass = 'dot-absent';
          else if(record.status === 'late') statusClass = 'dot-late';
          else if(record.status === 'half-day') statusClass = 'dot-half';
          else if(record.status === 'short-leave') statusClass = 'dot-short';
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

  return (
    <div className="attendance-page">
      
      {/* HEADER SECTION */}
      <header className="page-header">
        <div className="header-left">
            <h1>Attendance</h1>
            <p>Track your {isHR ? 'employee' : 'monthly'} attendance records</p>
        </div>
        
        <div className="header-right">
            
            {/* 1. Employee Action: Apply Leave (Visible only to Employees) */}
            {!isHR && (
                <button 
                    className="btn-action btn-gradient-blue" 
                    onClick={() => navigate('/leave')}
                >
                    <i className="bi bi-calendar-plus me-2"></i> Apply Leave
                </button>
            )}

            {/* 4. HR Punch Button (Optional: if HR wants to punch from header) */}
            {isHR && (
              <button
                  className={`btn-action punch-btn ${checkedIn ? 'check-out' : 'check-in'}`}
                  onClick={handlePunch}
                  disabled={loading}
              >
                  {loading ? '...' : (checkedIn ? 'Check Out' : 'Check In')}
              </button>
            )}

            {/* 2. HR Action: Download Report (Visible only to HR) */}
            {isHR && (
                <button className="btn-action download-btn" onClick={handleDownload}>
                    <i className="bi bi-cloud-download me-2"></i> Download Report
                </button>
            )}

            {/* 3. Date Navigator */}
           <div className="date-nav">
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>‹</button>
                <span>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>›</button>
            </div>
        </div>
      </header>

      {/* --- EMPLOYEE VIEW --- */}
      {!isHR ? (
        <div className="employee-layout fade-in">
            <div className="punch-widget-bar">
                <div className={`punch-btn-area ${checkedIn ? 'checked-in' : ''}`}>
                    <button className="btn-main-punch" onClick={handlePunch} disabled={loading}>
                        {loading ? 'Processing...' : (checkedIn ? 'Check Out' : 'Punch In')}
                    </button>
                </div>
                <div className="punch-info">
                    <div className="info-item">
                        <small>Punch In</small>
                        <strong>{punchTime ? punchTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</strong>
                    </div>
                    <div className="info-item">
                        <small>Punch Out</small>
                        <strong>{punchOutTime ? punchOutTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</strong>
                    </div>
                    <div className="info-item highlight">
                        <small>Total Hours</small>
                        <strong>{attendanceSummary.totalHours} hrs</strong>
                    </div>
                </div>
            </div>


            <div className="content-split">
                <div className="table-section">
                    <table className="modern-table">
                        <thead><tr><th>Date</th><th>Punch In</th><th>Punch Out</th><th>Total Hours</th><th>Status</th></tr></thead>
                        <tbody>
                            {/* ✅ FIX: Check if attendance is array before mapping */}
                            {Array.isArray(attendance) && attendance.length > 0 ? attendance.slice(0, 8).map(record => (
                                <tr key={record._id}>
                                    <td>{new Date(record.date).toLocaleDateString()}</td>
                                    <td>{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</td>
                                    <td>{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</td>
                                    <td>{record.workingHours ? `${record.workingHours} hrs` : '--'}</td>
                                    <td><span className={`status-pill ${record.status?.toLowerCase().replace(' ', '-')}`}>{record.status}</span></td>
                                </tr>
                            )) : <tr><td colSpan="5" className="text-center p-4">No records yet.</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="calendar-section">
                    <h5>Attendance Calendar</h5>
                    <div className="cal-header-row">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <span key={d}>{d}</span>)}
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
            {/* 1. HR Stats */}
            <div className="stats-row hr">
                <div className="stat-box"><small>Total Employees</small><h3>{hrSummary.total}</h3><i className="bi bi-people"></i></div>
                <div className="stat-box"><small>Present This Month</small><h3>{hrSummary.present}</h3><i className="bi bi-person-check text-success"></i></div>
                <div className="stat-box"><small>Absent This Month</small><h3>{hrSummary.absent}</h3><i className="bi bi-person-x text-danger"></i></div>
                <div className="stat-box"><small>Late This Month</small><h3>{hrSummary.late}</h3><i className="bi bi-clock-history text-warning"></i></div>
                <div className="stat-box"><small>Short Leave This Month</small><h3>{hrSummary.short}</h3><i className="bi bi-box-arrow-right text-info"></i></div>
                <div className="stat-box"><small>Half Day This Month</small><h3>{hrSummary.half}</h3><i className="bi bi-pie-chart text-purple"></i></div>
            </div>

            {/* 2. Filters */}
            <div className="filter-card-clean">
                <div className="filter-header">
                    <i className="bi bi-funnel"></i> Filters
                </div>
                <div className="filter-input-group">
                    <div className="search-box">
                        <i className="bi bi-search"></i>
                        <input type="text" placeholder="Search employee..." value={filters.name} onChange={(e) => setFilters({...filters, name: e.target.value})} />
                    </div>
                    
                    <select className="filter-select" value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
                        <option value="">All Status</option>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                        <option value="half-day">Half Day</option>
                    </select>

                    <select className="filter-select" value={filters.dept} onChange={(e) => setFilters({...filters, dept: e.target.value})}>
                        <option value="">All Departments</option>
                        <option value="IT">IT</option>
                        <option value="HR">HR</option>
                        <option value="Sales">Sales</option>
                    </select>
                </div>
            </div>


            {/* 3. HR Table */}
            <div className="table-section full-width">
                <table className="modern-table">
                    <thead><tr><th>Employee</th><th>Date</th><th>Punch In</th><th>Punch Out</th><th>Total Hours</th><th>Status</th></tr></thead>
                    <tbody>
                        {/* ✅ FIX: Add Safety check before mapping */}
                        {Array.isArray(allAttendance) && allAttendance.length > 0 ? (
                            allAttendance.map(record => (
                            <tr key={record._id}>
                                <td>
                                    <div className="emp-cell">
                                        <div className="avatar">{record.username ? record.username[0] : 'U'}</div>
                                        <span>{record.username || 'Unknown'}</span>
                                    </div>
                                </td>
                                <td>{new Date(record.date).toLocaleDateString()}</td>
                                <td>{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '--'}</td>
                                <td>{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '--'}</td>
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