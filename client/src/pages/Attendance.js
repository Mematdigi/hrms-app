import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { attendanceAPI } from '../services/api';
import '../styles/Attendance.css';

function Attendance() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      const response = await attendanceAPI.getAttendance({
        employeeId: user?.id,
      });
      setAttendance(response.data);
      const today = response.data.find(
        (a) => new Date(a.date).toDateString() === new Date().toDateString()
      );
      setCheckedIn(!!today?.checkInTime);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      await attendanceAPI.checkIn({ employeeId: user?.id });
      setCheckedIn(true);
      fetchAttendance();
    } catch (error) {
      console.error('Error checking in:', error);
    }
  };

  const handleCheckOut = async () => {
    try {
      await attendanceAPI.checkOut({ employeeId: user?.id });
      setCheckedIn(false);
      fetchAttendance();
    } catch (error) {
      console.error('Error checking out:', error);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="attendance-container">
      <h1>Attendance</h1>
      
      <div className="attendance-actions">
        {!checkedIn ? (
          <button onClick={handleCheckIn} className="check-in-btn">
            Check In
          </button>
        ) : (
          <button onClick={handleCheckOut} className="check-out-btn">
            Check Out
          </button>
        )}
      </div>

      <div className="attendance-table">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Working Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((record) => (
              <tr key={record._id}>
                <td>{new Date(record.date).toLocaleDateString()}</td>
                <td>{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : '-'}</td>
                <td>{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString() : '-'}</td>
                <td>{record.workingHours || '-'}</td>
                <td>{record.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Attendance;
