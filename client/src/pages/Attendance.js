import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { attendanceAPI } from '../services/api';

function Attendance() {
  // Hardcoded Office Coordinates
  const OFFICE_LOCATION = {
    name: 'Main Office',
    latitude: 28.570419,
    longitude: 77.453722,
    radiusInMeters: 100,
    address: 'N 28° 34\' 13.509\'\' E 77° 27\' 13.397\'\''
  };

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

  useEffect(() => {
    fetchAttendance();
    fetchAttendanceSummary();
    fetchCalendarData();
  }, []);

  useEffect(() => {
    fetchCalendarData();
  }, [currentDate]);

  const fetchAttendance = async () => {
    try {
      const response = await attendanceAPI.getAttendance({
        employeeId: user?.id,
      });
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
      const currentDate = new Date();
      const response = await attendanceAPI.getAttendanceSummary({
        employeeId: user?.id,
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear()
      });
      setAttendanceSummary(response.data.data);
    } catch (error) {
      console.error('Error fetching attendance summary:', error);
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
      console.error('Error fetching calendar data:', error);
      setCalendarData(attendance || []);
    }
  };

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Check if current location is within office premises
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
        reject(new Error('Geolocation is not supported by your browser'));
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (error) => {
            reject(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      }
    });
  };

  const handleCheckIn = async () => {
    try {
      setLocationError('');
      setLoading(true);
      
      const location = await getCurrentLocation();
      console.log('Current location for check-in:', location);
      // // Check if within office premises
      // const locationCheck = isWithinOffice(location.latitude, location.longitude);
      
      // if (!locationCheck.isWithin) {
      //   const distanceKm = (locationCheck.distance / 1000).toFixed(2);
      //   const distanceM = locationCheck.distance.toFixed(0);
      //   setLocationError(`You are ${distanceKm}km (${distanceM}m) away from office. You must be within ${OFFICE_LOCATION.radiusInMeters}m radius to check in.`);
      //   alert(`❌ Check-in failed!\n\nYou are ${distanceKm}km away from the office.\nYou must be within ${OFFICE_LOCATION.radiusInMeters}m radius to check in.`);
      //   setLoading(false);
      //   return;
      // }

      const response = await attendanceAPI.checkIn({ 
        employeeId: user?.id,
        latitude: location.latitude,
        longitude: location.longitude
      });
      console.log('Check-in response:', response);

      if (response.data.success || response.data.attendance) {
        setCheckedIn(true);
        fetchAttendance();
        fetchAttendanceSummary();
        fetchCalendarData();
        
        const checkInTime = new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        
        const distanceM = locationCheck.distance.toFixed(0);
        alert(`✅ Check-in successful!\n\nTime: ${checkInTime}\nDistance from office: ${distanceM}m`);
      }
    } catch (error) {
      console.error('Error checking in:', error);
      if (error.response?.status === 403) {
        const errorData = error.response.data;
        setLocationError(errorData.message);
        alert(`❌ Check-in failed!\n\n${errorData.message}\n\nYour distance: ${errorData.distanceKm}km\nRequired: Within ${errorData.requiredRadius}m`);
      } else if (error.response?.status === 400) {
        setLocationError(error.response.data.message);
        alert(`❌ ${error.response.data.message}`);
      } else if (error.message) {
        setLocationError(error.message);
        alert(`❌ Location error: ${error.message}`);
      } else {
        setLocationError('Failed to check in. Please try again.');
      }
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
      
      // Check if within office premises
      const locationCheck = isWithinOffice(location.latitude, location.longitude);
      
      if (!locationCheck.isWithin) {
        const distanceKm = (locationCheck.distance / 1000).toFixed(2);
        const distanceM = locationCheck.distance.toFixed(0);
        setLocationError(`You are ${distanceKm}km (${distanceM}m) away from office. You must be within ${OFFICE_LOCATION.radiusInMeters}m radius to check out.`);
        alert(`❌ Check-out failed!\n\nYou are ${distanceKm}km away from the office.\nYou must be within ${OFFICE_LOCATION.radiusInMeters}m radius to check out.`);
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
        fetchAttendance();
        fetchAttendanceSummary();
        fetchCalendarData();
        
        const checkOutTime = new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        
        const workingHours = response.data.workingHours || response.data.attendance?.workingHours || 0;
        const status = response.data.status || response.data.attendance?.status || 'checked-out';
        
        alert(`✅ Check-out successful!\n\nTime: ${checkOutTime}\nWorking Hours: ${workingHours} hrs\nStatus: ${status}`);
      }
    } catch (error) {
      console.error('Error checking out:', error);
      
      if (error.response?.data?.requiresApproval) {
        // Early checkout detected - show modal
        setShowEarlyCheckoutModal(true);
      } else if (error.response?.status === 403) {
        const errorData = error.response.data;
        setLocationError(errorData.message);
        alert(`❌ Check-out failed!\n\n${errorData.message}\n\nYour distance: ${errorData.distanceKm}km\nRequired: Within ${errorData.requiredRadius}m`);
      } else if (error.response?.status === 400) {
        setLocationError(error.response.data.message);
        alert(`❌ ${error.response.data.message}`);
      } else if (error.message) {
        setLocationError(error.message);
        alert(`❌ Location error: ${error.message}`);
      } else {
        setLocationError('Failed to check out. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEarlyCheckoutSubmit = async (e) => {
    e.preventDefault();
    
    if (earlyCheckoutReason.trim() === '') {
      alert('Please provide a reason for early checkout');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await attendanceAPI.requestEarlyCheckout({
        employeeId: user?.id,
        reason: earlyCheckoutReason,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      });
      
      if (response.data.success) {
        setShowEarlyCheckoutModal(false);
        setEarlyCheckoutReason('');
        setCurrentLocation(null);
        fetchAttendance();
        fetchAttendanceSummary();
        fetchCalendarData();
        alert('✅ Early checkout request submitted successfully!\n\nYour request has been sent to HR for approval.\nYou will be notified once it is reviewed.');
      }
    } catch (error) {
      console.error('Error requesting early checkout:', error);
      
      if (error.response?.status === 403) {
        const errorData = error.response.data;
        setLocationError(errorData.message);
        alert(`❌ Request failed!\n\n${errorData.message}\n\nYour distance: ${errorData.distanceKm}km\nRequired: Within ${errorData.requiredRadius}m`);
        setShowEarlyCheckoutModal(false);
      } else if (error.response?.data?.message) {
        alert(`❌ Request failed!\n\n${error.response.data.message}`);
      } else {
        alert('Failed to submit early checkout request. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalCancel = () => {
    setShowEarlyCheckoutModal(false);
    setEarlyCheckoutReason('');
    setCurrentLocation(null);
  };

  // Calendar Functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const getStatusForDate = (day) => {
    const dateToCheck = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day
    );
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

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="mini-calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const status = getStatusForDate(day);
      const isToday = 
        day === new Date().getDate() &&
        currentDate.getMonth() === new Date().getMonth() &&
        currentDate.getFullYear() === new Date().getFullYear();

      days.push(
        <div
          key={day}
          className={`mini-calendar-day ${status ? `status-${status}` : ''} ${isToday ? 'today' : ''}`}
          title={status ? `${day} - ${status}` : `${day}`}
        >
          <span className="day-number">{day}</span>
        </div>
      );
    }

    return days;
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (loading && attendance.length === 0) {
    return <div className="loading">⏳ Loading...</div>;
  }

  return (
    <div className="attendance-container">
      <div className="attendance-header">
        <h1>My Attendance</h1>
      </div>

      {/* Top Section: Summary Cards and Calendar Side by Side */}
      <div className="top-section">
        {/* Left: Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card summary-present">
            <div className="summary-icon">✓</div>
            <div className="summary-content">
              <h3>{attendanceSummary?.present || 0}</h3>
              <p>Days Present</p>
            </div>
          </div>
          
          <div className="summary-card summary-absent">
            <div className="summary-icon">✗</div>
            <div className="summary-content">
              <h3>{attendanceSummary?.absent || 0}</h3>
              <p>Days Absent</p>
            </div>
          </div>
          
          <div className="summary-card summary-halfday">
            <div className="summary-icon">½</div>
            <div className="summary-content">
              <h3>{attendanceSummary?.halfDay || 0}</h3>
              <p>Half Days</p>
            </div>
          </div>
          
          <div className="summary-card summary-hours">
            <div className="summary-icon">⏰</div>
            <div className="summary-content">
              <h3>{attendanceSummary?.totalWorkingHours || 0}</h3>
              <p>Total Hours</p>
            </div>
          </div>
        </div>

        {/* Right: Mini Calendar */}
        <div className="mini-calendar-wrapper">
          <div className="mini-calendar-container">
            <div className="mini-calendar-header">
              <button onClick={previousMonth} className="mini-nav-btn">‹</button>
              <h3 className="mini-calendar-month">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              <button onClick={nextMonth} className="mini-nav-btn">›</button>
            </div>

            <div className="mini-calendar-grid">
              <div className="mini-calendar-day-header">S</div>
              <div className="mini-calendar-day-header">M</div>
              <div className="mini-calendar-day-header">T</div>
              <div className="mini-calendar-day-header">W</div>
              <div className="mini-calendar-day-header">T</div>
              <div className="mini-calendar-day-header">F</div>
              <div className="mini-calendar-day-header">S</div>
              {renderCalendar()}
            </div>

            <div className="mini-calendar-legend">
              <div className="mini-legend-item">
                <span className="mini-legend-dot status-present"></span>
                <span>Present</span>
              </div>
              <div className="mini-legend-item">
                <span className="mini-legend-dot status-absent"></span>
                <span>Absent</span>
              </div>
              <div className="mini-legend-item">
                <span className="mini-legend-dot status-half-day"></span>
                <span>Half</span>
              </div>
              <div className="mini-legend-item">
                <span className="mini-legend-dot status-leave"></span>
                <span>Leave</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Office Location Info */}
      <div className="office-location-card">
        <div className="location-header">
          <span className="location-icon">📍</span>
          <h3>{OFFICE_LOCATION.name}</h3>
        </div>
        <div className="location-details">
          <p><strong>Latitude:</strong> {OFFICE_LOCATION.latitude}° N</p>
          <p><strong>Longitude:</strong> {OFFICE_LOCATION.longitude}° E</p>
          <p><strong>Check-in Radius:</strong> {OFFICE_LOCATION.radiusInMeters}m</p>
          <p><strong>Coordinates:</strong> {OFFICE_LOCATION.address}</p>
        </div>
      </div>
      
      {locationError && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {locationError}
        </div>
      )}

      <div className="attendance-actions">
        {!checkedIn ? (
          <button 
            onClick={handleCheckIn} 
            className="check-in-btn"
            disabled={loading}
          >
            {loading ? '⏳ Processing...' : '✓ Check In'}
          </button>
        ) : (
          <button 
            onClick={handleCheckOut}
            className="check-out-btn"
            disabled={loading}
          >
            {loading ? '⏳ Processing...' : '✗ Check Out'}
          </button>
        )}
      </div>

      {/* Attendance List Table */}
      <div className="attendance-table">
        <h2 className="table-heading">Attendance Records</h2>
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Date</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Working Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">No attendance records found</td>
              </tr>
            ) : (
              attendance.map((record, index) => (
                <tr key={record._id}>
                  <td>{index + 1}</td>
                  <td>{new Date(record.date).toLocaleDateString()}</td>
                  <td>
                    {record.checkInTime 
                      ? new Date(record.checkInTime).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        }) 
                      : '-'}
                  </td>
                  <td>
                    {record.checkOutTime 
                      ? new Date(record.checkOutTime).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        }) 
                      : record.earlyCheckoutRequest?.requested 
                        ? `Pending (${record.earlyCheckoutRequest.status})`
                        : '-'}
                  </td>
                  <td>{record.workingHours ? `${record.workingHours} hrs` : '-'}</td>
                  <td>
                    <span className={`status-badge status-${record.status}`}>
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Early Checkout Modal */}
      {showEarlyCheckoutModal && (
        <div className="modal-overlay" onClick={() => !isSubmitting && handleModalCancel()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>⏰ Early Checkout Request</h2>
            <p className="modal-description">
              You are checking out before 6:30 PM. Please provide a valid reason for early checkout. 
              Your request will be sent to HR for approval.
            </p>
            
            <form onSubmit={handleEarlyCheckoutSubmit}>
              <div className="form-group">
                <label htmlFor="reason">Reason for Early Checkout: <span className="required">*</span></label>
                <textarea
                  id="reason"
                  value={earlyCheckoutReason}
                  onChange={(e) => setEarlyCheckoutReason(e.target.value)}
                  rows="5"
                  placeholder="Enter your reason here (e.g., medical appointment, family emergency, personal matter, etc.)..."
                  required
                  disabled={isSubmitting}
                  maxLength={500}
                />
                <small className="char-count">{earlyCheckoutReason.length}/500 characters</small>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={handleModalCancel} 
                  className="cancel-btn"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '⏳ Submitting...' : '📤 Submit Request'}
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