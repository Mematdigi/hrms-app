import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { attendanceAPI } from '../services/api';
// import './Attendance.scss'; // Assuming you link the SCSS here

function Attendance() {
  // --- CONFIGURATION ---
  const OFFICE_LOCATION = {
    name: 'Main Office',
    latitude: 28.570419,
    longitude: 77.453722,
    radiusInMeters: 100,
    address: 'N 28° 34\' 13.509\'\' E 77° 27\' 13.397\'\''
  };

  // --- STATE MANAGEMENT ---
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showEarlyCheckoutModal, setShowEarlyCheckoutModal] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [calendarData, setCalendarData] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const { user } = useSelector((state) => state.auth);

  // --- EFFECTS ---
  useEffect(() => {
    fetchAttendance();
    fetchAttendanceSummary();
    fetchCalendarData();
  }, []);

  useEffect(() => {
    fetchCalendarData();
  }, [currentDate]);

  // --- API CALLS ---
  const fetchAttendance = async () => {
    try {
      const response = await attendanceAPI.getAttendance({ employeeId: user?.id });
      setAttendance(response.data);
      const today = response.data.find(
        (a) => new Date(a.date).toDateString() === new Date().toDateString()
      );
      setCheckedIn(!!today?.checkInTime && !today?.checkOutTime);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceSummary = async () => {
    try {
      const curDate = new Date();
      const response = await attendanceAPI.getAttendanceSummary({
        employeeId: user?.id,
        month: curDate.getMonth() + 1,
        year: curDate.getFullYear()
      });
      setAttendanceSummary(response.data.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const fetchCalendarData = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const response = await attendanceAPI.getCalendarData({
        employeeId: user?.id,
        year,
        month
      });
      setCalendarData(response.data.data || response.data);
    } catch (error) {
      console.error('Error fetching calendar:', error);
      setCalendarData(attendance || []);
    }
  };

  // --- GEOLOCATION LOGIC ---
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const isWithinOffice = (latitude, longitude) => {
    const distance = calculateDistance(
      OFFICE_LOCATION.latitude,
      OFFICE_LOCATION.longitude,
      latitude,
      longitude
    );
    return {
      isWithin: distance <= OFFICE_LOCATION.radiusInMeters,
      distance: distance
    };
  };

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    });
  };

  // --- HANDLERS ---
  const handleCheckIn = async () => {
    try {
      setLocationError('');
      setLoading(true);
      const location = await getCurrentLocation();
      
      // Check location logic (Currently commented out in source, but structure remains)
      // const locationCheck = isWithinOffice(location.latitude, location.longitude);
      // if (!locationCheck.isWithin) { ... }

      const response = await attendanceAPI.checkIn({ 
        employeeId: user?.id,
        latitude: location.latitude,
        longitude: location.longitude
      });

      if (response.data.success || response.data.attendance) {
        setCheckedIn(true);
        refreshAllData();
        const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        alert(`✅ Check-in successful at ${time}`);
      }
    } catch (error) {
      handleError(error, 'Check-in');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setLocationError('');
      setLoading(true);
      const location = await getCurrentLocation();
      setCurrentLocation(location);
      
      // Strict Check-out location check
      const locationCheck = isWithinOffice(location.latitude, location.longitude);
      
      if (!locationCheck.isWithin) {
        const distKm = (locationCheck.distance / 1000).toFixed(2);
        const msg = `You are ${distKm}km away. You must be within ${OFFICE_LOCATION.radiusInMeters}m to check out.`;
        setLocationError(msg);
        alert(`❌ Check-out failed!\n\n${msg}`);
        setLoading(false);
        return;
      }

      const response = await attendanceAPI.checkOut({ 
        employeeId: user?.id,
        latitude: location.latitude,
        longitude: location.longitude
      });
      
      if (response.data.success || response.data.attendance) {
        setCheckedIn(false);
        setCurrentLocation(null);
        refreshAllData();
        alert(`✅ Check-out successful!`);
      }
    } catch (error) {
      if (error.response?.data?.requiresApproval) {
        setShowEarlyCheckoutModal(true);
      } else {
        handleError(error, 'Check-out');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEarlyCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!earlyCheckoutReason.trim()) return alert('Reason required');

    setIsSubmitting(true);
    try {
      const response = await attendanceAPI.requestEarlyCheckout({
        employeeId: user?.id,
        reason: earlyCheckoutReason,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      });
      
      if (response.data.success) {
        handleModalCancel();
        refreshAllData();
        alert('✅ Early checkout requested successfully.');
      }
    } catch (error) {
      handleError(error, 'Request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to refresh everything
  const refreshAllData = () => {
    fetchAttendance();
    fetchAttendanceSummary();
    fetchCalendarData();
  };

  // Centralized Error Handling
  const handleError = (error, action) => {
    console.error(`Error ${action}:`, error);
    let msg = 'An unexpected error occurred.';
    if (error.response?.status === 403) msg = error.response.data.message;
    else if (error.response?.data?.message) msg = error.response.data.message;
    else if (error.message) msg = error.message;
    
    setLocationError(msg);
    alert(`❌ ${action} failed: ${msg}`);
  };

  const handleModalCancel = () => {
    setShowEarlyCheckoutModal(false);
    setEarlyCheckoutReason('');
    setCurrentLocation(null);
  };

  // --- CALENDAR RENDERING ---
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { daysInMonth: lastDay.getDate(), startingDayOfWeek: firstDay.getDay() };
  };

  const getStatusForDate = (day) => {
    const dateToCheck = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    dateToCheck.setHours(0, 0, 0, 0);
    const record = calendarData.find(item => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate.getTime() === dateToCheck.getTime();
    });
    return record?.status || null;
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const status = getStatusForDate(day);
      const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth();
      days.push(
        <div key={day} className={`cal-day ${status ? `status-${status}` : ''} ${isToday ? 'today' : ''}`}>
          <span className="day-num">{day}</span>
          {status && <span className="day-dot"></span>}
        </div>
      );
    }
    return days;
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  if (loading && attendance.length === 0) return <div className="page-loader"><div className="spinner"></div> Loading Attendance...</div>;

  return (
    <div className="attendance-dashboard">
      {/* 1. Header Section: Title & Actions */}
      <header className="dash-header">
        <div className="header-title">
          <h1>Attendance</h1>
          <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div className="header-action">
          {!checkedIn ? (
            <button onClick={handleCheckIn} className="btn-action check-in" disabled={loading}>
              {loading ? 'Processing...' : '📍 Check In Now'}
            </button>
          ) : (
            <button onClick={handleCheckOut} className="btn-action check-out" disabled={loading}>
              {loading ? 'Processing...' : '👋 Check Out'}
            </button>
          )}
        </div>
      </header>

      {/* 2. Error Banner */}
      {locationError && (
        <div className="error-banner">
          <i className="icon">⚠️</i> {locationError}
        </div>
      )}

      {/* 3. Summary Stats Grid */}
      <section className="stats-grid">
        <div className="stat-card present">
          <div className="icon-box">✓</div>
          <div className="info">
            <h3>{attendanceSummary?.present || 0}</h3>
            <span>Present</span>
          </div>
        </div>
        <div className="stat-card absent">
          <div className="icon-box">✗</div>
          <div className="info">
            <h3>{attendanceSummary?.absent || 0}</h3>
            <span>Absent</span>
          </div>
        </div>
        <div className="stat-card half">
          <div className="icon-box">½</div>
          <div className="info">
            <h3>{attendanceSummary?.halfDay || 0}</h3>
            <span>Half Day</span>
          </div>
        </div>
        <div className="stat-card hours">
          <div className="icon-box">⏰</div>
          <div className="info">
            <h3>{attendanceSummary?.totalWorkingHours || 0}</h3>
            <span>Hours</span>
          </div>
        </div>
      </section>

      {/* 4. Main Content: Split View (Calendar & Location) */}
      <div className="content-split">
        {/* Calendar Card */}
        <div className="card calendar-card">
          <div className="card-header">
            <h3>Monthly Overview</h3>
            <div className="cal-nav">
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}>‹</button>
              <span>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}>›</button>
            </div>
          </div>
          <div className="cal-grid-header">
            {['S','M','T','W','T','F','S'].map(d => <span key={d}>{d}</span>)}
          </div>
          <div className="cal-grid-body">
            {renderCalendar()}
          </div>
          <div className="cal-legend">
            <span className="badge present">Present</span>
            <span className="badge absent">Absent</span>
            <span className="badge half">Half</span>
            <span className="badge leave">Leave</span>
          </div>
        </div>

        {/* Location & Info Card */}
        <div className="side-panel">
          <div className="card location-card">
            <div className="card-header">
              <h3>Office Location</h3>
            </div>
            <div className="map-placeholder">
              {/* Abstract Map visual representation */}
              <div className="radar-circle"></div>
              <div className="pin">📍</div>
            </div>
            <div className="loc-details">
              <h4>{OFFICE_LOCATION.name}</h4>
              <p>{OFFICE_LOCATION.address}</p>
              <div className="loc-meta">
                <span><strong>Radius:</strong> {OFFICE_LOCATION.radiusInMeters}m</span>
                <span><strong>Lat:</strong> {OFFICE_LOCATION.latitude.toFixed(4)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Detailed Table */}
      <section className="card table-card">
        <div className="card-header">
          <h3>Recent Logs</h3>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendance.length === 0 ? (
                <tr><td colSpan="5" className="empty-state">No records found</td></tr>
              ) : (
                attendance.slice(0, 10).map((record) => ( // Showing last 10 for cleaner UI
                  <tr key={record._id}>
                    <td>{new Date(record.date).toLocaleDateString()}</td>
                    <td>{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</td>
                    <td>
                      {record.checkOutTime 
                        ? new Date(record.checkOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                        : record.earlyCheckoutRequest?.requested ? <span className="text-warning">Pending Approval</span> : '-'}
                    </td>
                    <td>{record.workingHours || '-'}</td>
                    <td><span className={`status-pill ${record.status}`}>{record.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Modal */}
      {showEarlyCheckoutModal && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && handleModalCancel()}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Early Checkout</h2>
              <button onClick={handleModalCancel}>×</button>
            </div>
            <form onSubmit={handleEarlyCheckoutSubmit}>
              <div className="modal-body">
                <p>You are leaving before 6:30 PM. Please state your reason for approval.</p>
                <textarea
                  value={earlyCheckoutReason}
                  onChange={(e) => setEarlyCheckoutReason(e.target.value)}
                  placeholder="E.g., Doctor appointment..."
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={handleModalCancel}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Attendance;