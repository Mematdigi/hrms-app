import React, { useEffect, useState } from 'react';
import { attendanceAPI } from '../services/api';

const AllEmployeesAttendance = () => {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState(null); // Track which row is being updated
  
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    status: '',
    department: '',
  });

  // ✅ Fetch all attendance records
  const fetchAllAttendance = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.status) params.status = filters.status;

      const res = await attendanceAPI.getAllAttendance(params);
      const data = res.data.data || [];
      
      // Filter out records with null employees
      const validRecords = data.filter(record => record.employee !== null);
      
      setRecords(validRecords);
      setFilteredRecords(validRecords);
    } catch (err) {
      console.error('Error fetching all attendance:', err);
      setError('Failed to load attendance list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Handle search and filter
  useEffect(() => {
    let filtered = [...records];

    // Search by name, email, or employee ID
    if (searchQuery) {
      filtered = filtered.filter((rec) => {
        const searchLower = searchQuery.toLowerCase();
        const fullName = `${rec.employee?.firstName || ''} ${rec.employee?.lastName || ''}`.toLowerCase();
        const email = rec.employee?.email?.toLowerCase() || '';
        const empId = rec.employee?.employeeId?.toString() || '';
        
        return fullName.includes(searchLower) || 
               email.includes(searchLower) || 
               empId.includes(searchLower);
      });
    }

    // Filter by department
    if (filters.department) {
      filtered = filtered.filter(
        (rec) => rec.employee?.department?.toLowerCase() === filters.department.toLowerCase()
      );
    }

    setFilteredRecords(filtered);
  }, [searchQuery, filters.department, records]);

  // ✅ Get unique departments for filter
  const getUniqueDepartments = () => {
    const departments = records
      .map((rec) => rec.employee?.department)
      .filter((dept) => dept);
    return [...new Set(departments)];
  };

  // ✅ Calculate summary statistics
  const getSummaryStats = () => {
    const total = filteredRecords.length;
    const present = filteredRecords.filter((r) => r.status === 'present').length;
    const absent = filteredRecords.filter((r) => r.status === 'absent').length;
    const halfDay = filteredRecords.filter((r) => r.status === 'half-day').length;
    const leave = filteredRecords.filter((r) => r.status === 'leave').length;
    
    const totalWorkingHours = filteredRecords.reduce(
      (sum, rec) => sum + (rec.workingHours || 0),
      0
    );
    const avgWorkingHours = total > 0 ? (totalWorkingHours / total).toFixed(2) : 0;

    return { total, present, absent, halfDay, leave, avgWorkingHours };
  };

  const stats = getSummaryStats();

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    fetchAllAttendance();
  };

  const handleResetFilters = () => {
    setFilters({
      from: '',
      to: '',
      status: '',
      department: '',
    });
    setSearchQuery('');
    fetchAllAttendance();
  };

  // ✅ NEW: Handle status update
  const handleStatusUpdate = async (record, newStatus) => {
    try {
      setUpdatingId(record._id);
      
      await attendanceAPI.markAttendance({
        employeeId: record.employee._id,
        date: record.date,
        status: newStatus
      });

      // Update local state
      const updatedRecords = records.map(rec => 
        rec._id === record._id ? { ...rec, status: newStatus } : rec
      );
      setRecords(updatedRecords);
      
      const updatedFiltered = filteredRecords.map(rec => 
        rec._id === record._id ? { ...rec, status: newStatus } : rec
      );
      setFilteredRecords(updatedFiltered);

      // Show success message
      alert('✅ Attendance status updated successfully!');
      
    } catch (err) {
      console.error('Error updating attendance status:', err);
      alert('❌ Failed to update attendance status');
    } finally {
      setUpdatingId(null);
    }
  };

  // ✅ Export to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['S.No', 'Emp ID', 'Name', 'Department', 'Date', 'Check In', 'Check Out', 'Working Hours', 'Status', 'Notes'];
    
    const csvData = filteredRecords.map((rec, idx) => [
      idx + 1,
      rec.employee?.employeeId || '-',
      `${rec.employee?.firstName || ''} ${rec.employee?.lastName || ''}`.trim(),
      rec.employee?.department || '-',
      formatDate(rec.date),
      formatTime(rec.checkInTime),
      formatTime(rec.checkOutTime),
      rec.workingHours != null ? rec.workingHours.toFixed(2) : '-',
      formatStatus(rec.status),
      rec.notes || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatDate = (date) =>
    date ? new Date(date).toLocaleDateString('en-IN') : '-';

  const formatTime = (date) =>
    date
      ? new Date(date).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';

  const formatStatus = (status) =>
    status
      ? status.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : '-';

  const getStatusBadge = (status) => {
    const badges = {
      present: { class: 'status-present', icon: '✅', text: 'Present' },
      absent: { class: 'status-absent', icon: '❌', text: 'Absent' },
      'half-day': { class: 'status-half-day', icon: '⚠️', text: 'Half Day' },
      leave: { class: 'status-leave', icon: '🏖️', text: 'Leave' },
    };
    return badges[status] || { class: 'status-unknown', icon: '❓', text: status };
  };

  return (
    <div className="all-attendance-container">
      <div className="all-attendance-header">
        <h1>📊 All Employees Attendance</h1>
        <button className="export-btn" onClick={handleExportCSV}>
          📥 Export CSV
        </button>
      </div>

      {/* ✅ Summary Statistics */}
      <div className="attendance-stats">
        <div className="stat-card total">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Total Records</p>
          </div>
        </div>
        <div className="stat-card present">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>{stats.present}</h3>
            <p>Present</p>
          </div>
        </div>
        <div className="stat-card absent">
          <div className="stat-icon">❌</div>
          <div className="stat-info">
            <h3>{stats.absent}</h3>
            <p>Absent</p>
          </div>
        </div>
        <div className="stat-card half-day">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <h3>{stats.halfDay}</h3>
            <p>Half Day</p>
          </div>
        </div>
        <div className="stat-card leave">
          <div className="stat-icon">🏖️</div>
          <div className="stat-info">
            <h3>{stats.leave}</h3>
            <p>On Leave</p>
          </div>
        </div>
        <div className="stat-card hours">
          <div className="stat-icon">⏱️</div>
          <div className="stat-info">
            <h3>{stats.avgWorkingHours}h</h3>
            <p>Avg Hours</p>
          </div>
        </div>
      </div>

      {/* ✅ Search Bar */}
      <div className="search-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search by name, email, or employee ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ✅ Filters */}
      <form className="all-attendance-filters" onSubmit={handleApplyFilters}>
        <div className="filters-grid">
          <div className="filter-group">
            <label>📅 From Date</label>
            <input
              type="date"
              name="from"
              value={filters.from}
              onChange={handleFilterChange}
            />
          </div>
          <div className="filter-group">
            <label>📅 To Date</label>
            <input
              type="date"
              name="to"
              value={filters.to}
              onChange={handleFilterChange}
            />
          </div>
          <div className="filter-group">
            <label>📊 Status</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
            >
              <option value="">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="half-day">Half Day</option>
              <option value="leave">Leave</option>
            </select>
          </div>
          <div className="filter-group">
            <label>🏢 Department</label>
            <select
              name="department"
              value={filters.department}
              onChange={handleFilterChange}
            >
              <option value="">All Departments</option>
              {getUniqueDepartments().map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-actions">
          <button type="submit" className="filter-btn apply">
            ✓ Apply Filters
          </button>
          <button type="button" className="filter-btn reset" onClick={handleResetFilters}>
            🔄 Reset
          </button>
        </div>
      </form>

      {/* ✅ Results Summary */}
      <div className="results-summary">
        <p>
          Showing <strong>{filteredRecords.length}</strong> of <strong>{records.length}</strong> records
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {error && <div className="attendance-alert error">❌ {error}</div>}
      {loading && <div className="attendance-loading">⏳ Loading attendance...</div>}

      {!loading && !error && (
        <div className="all-attendance-table">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Working Hours</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Update Status</th> {/* NEW COLUMN */}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="11" className="no-data">
                    {searchQuery || filters.department
                      ? '🔍 No records match your search criteria'
                      : '📭 No attendance records found'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => {
                  const badge = getStatusBadge(rec.status);
                  const isUpdating = updatingId === rec._id;
                  
                  return (
                    <tr key={rec._id}>
                      <td>{idx + 1}</td>
                      <td>
                        <span className="emp-id">
                          {rec.employee?.employeeId ? `EMP00${rec.employee.employeeId}` : '-'}
                        </span>
                      </td>
                      <td className="name-cell">
                        {rec.employee
                          ? `${rec.employee.firstName || ''} ${rec.employee.lastName || ''}`.trim()
                          : '-'}
                      </td>
                      <td>{rec.employee?.department || '-'}</td>
                      <td>{formatDate(rec.date)}</td>
                      <td className="time-cell">{formatTime(rec.checkInTime)}</td>
                      <td className="time-cell">{formatTime(rec.checkOutTime)}</td>
                      <td className="hours-cell">
                        {rec.workingHours != null ? `${rec.workingHours.toFixed(2)}h` : '-'}
                      </td>
                      <td>
                        <span className={`status-badge ${badge.class}`}>
                          {badge.icon} {badge.text}
                        </span>
                      </td>
                      <td className="notes-cell">{rec.notes || '-'}</td>
                      <td className="action-cell">
                        {/* NEW STATUS UPDATE DROPDOWN */}
                        <select
                          className="status-update-dropdown"
                          value={rec.status}
                          onChange={(e) => handleStatusUpdate(rec, e.target.value)}
                          disabled={isUpdating}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            cursor: isUpdating ? 'not-allowed' : 'pointer',
                            opacity: isUpdating ? 0.6 : 1
                          }}
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="half-day">Half Day</option>
                          <option value="leave">Leave</option>
                        </select>
                        {isUpdating && <span style={{ marginLeft: '5px' }}>⏳</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AllEmployeesAttendance;