import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { leaveAPI } from '../services/api';

function Leave() {
  const [leaves, setLeaves] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my-leaves');
  const [actionTaken, setActionTaken] = useState('');
  
  // ✅ NEW: Filter and Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedStatus, setSelectedStatus] = useState('');
  
  const [formData, setFormData] = useState({
    leaveType: 'casual',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (user?.role === 'hr' || user?.role === 'admin') {
      setActiveTab("all");
    }
  }, []);

  // --- DEFAULT LEAVES & BALANCES (Casual + Sick) ---
  const [leaveDefaults, setLeaveDefaults] = useState({
    casualDefault: 0,
    sickDefault: 0,
  });
  const [balances, setBalances] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    casualDefault: '',
    sickDefault: '',
  });

  useEffect(() => {
    fetchLeaves();
    fetchLeaveDefaults();
    if (user?.role === 'hr' || user?.role === 'admin') {
      fetchPendingLeaves();
    } else if (user?.role === 'employee') {
      fetchBalances();
    }
  }, [user]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await leaveAPI.getRequests({
        employeeId: user?.id,
        role: user?.role,
      });
      setLeaves(response.data);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      setErrorMessage('Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingLeaves = async () => {
    try {
      const response = await leaveAPI.getPending();
      setPendingLeaves(response.data);
    } catch (error) {
      console.error('Error fetching pending leaves:', error);
    }
  };

  const fetchLeaveDefaults = async () => {
    try {
      const res = await leaveAPI.getDefaults();
      if (res?.data) {
        setLeaveDefaults(res.data);
        setSettingsForm({
          casualDefault: res.data.casualDefault || '',
          sickDefault: res.data.sickDefault || '',
        });
      }
    } catch (err) {
      console.error('Failed to fetch leave defaults', err);
    }
  };

  const fetchBalances = async () => {
    if (!user?.id) return;
    try {
      const res = await leaveAPI.getBalances(user.id);
      setBalances(res.data || null);
    } catch (err) {
      console.error('Failed to fetch balances', err);
    }
  };

  // ✅ NEW: Filter and Search Logic
  const getFilteredLeaves = () => {
    let filtered = [...leaves];

    // 1. Search by employee name (for HR/Admin)
    if (searchQuery && (user?.role === 'hr' || user?.role === 'admin')) {
      filtered = filtered.filter((leave) => {
        const fullName = `${leave.employee?.firstName} ${leave.employee?.lastName}`.toLowerCase();
        const email = leave.employee?.email?.toLowerCase() || '';
        return fullName.includes(searchQuery.toLowerCase()) || 
               email.includes(searchQuery.toLowerCase());
      });
    }

    // 2. Filter by Month
    if (selectedMonth) {
      filtered = filtered.filter((leave) => {
        const leaveDate = new Date(leave.startDate);
        const leaveMonth = (leaveDate.getMonth() + 1).toString().padStart(2, '0');
        return leaveMonth === selectedMonth;
      });
    }

    // 3. Filter by Year
    if (selectedYear) {
      filtered = filtered.filter((leave) => {
        const leaveDate = new Date(leave.startDate);
        return leaveDate.getFullYear().toString() === selectedYear;
      });
    }

    // 4. Filter by Status
    if (selectedStatus) {
      filtered = filtered.filter((leave) => leave.status === selectedStatus);
    }

    return filtered;
  };

  // ✅ NEW: Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedMonth('');
    setSelectedYear(new Date().getFullYear().toString());
    setSelectedStatus('');
  };

  // ✅ NEW: Get available years from leave data
  const getAvailableYears = () => {
    const years = new Set();
    leaves.forEach((leave) => {
      const year = new Date(leave.startDate).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await leaveAPI.apply({
        employeeId: user?.id,
        ...formData,
      });

      setSuccessMessage('✅ Leave request submitted successfully! HR will review your request.');
      setFormData({
        leaveType: 'casual',
        startDate: '',
        endDate: '',
        reason: '',
      });
      setShowForm(false);

      setTimeout(() => setSuccessMessage(''), 5000);
      fetchLeaves();
      if (user?.role === 'employee') fetchBalances();
    } catch (error) {
      console.error('Error applying leave:', error);
      setErrorMessage('Failed to submit leave request');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const handleApproveLeave = async (leaveId, leaveType, numberOfDays) => {
    try {
      await leaveAPI.approve({
        leaveId,
        approverId: user?.id,
        numberOfDays: numberOfDays,
        leaveType: leaveType
      });
      setSuccessMessage('✅ Leave request approved!');
      setTimeout(() => setSuccessMessage(''), 5000);
      fetchPendingLeaves();
      fetchLeaves();
      fetchBalances();
      setActionTaken('approved');
    } catch (error) {
      console.error('Error approving leave:', error);
      setErrorMessage('Failed to approve leave request');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const handleRejectLeave = async (leaveId, leaveType, numberOfDays) => {
    const rejectionReason = prompt('Enter rejection reason:');
    if (!rejectionReason) return;
    try {
      await leaveAPI.reject({
        leaveId,
        numberOfDays,
        leaveType,
        rejectionReason,
        approverId: user?.id,
      });
      setSuccessMessage('✅ Leave request rejected!');
      setTimeout(() => setSuccessMessage(''), 5000);
      fetchPendingLeaves();
      fetchLeaves();
      fetchBalances();
      setActionTaken('rejected');
    } catch (error) {
      console.error('Error rejecting leave:', error);
      setErrorMessage('Failed to reject leave request');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'status-pending', text: '⏳ Pending' },
      approved: { class: 'status-approved', text: '✅ Approved' },
      rejected: { class: 'status-rejected', text: '❌ Rejected' },
    };
    return badges[status] || { class: 'status-pending', text: status };
  };

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    try {
      await leaveAPI.updateDefaults({
        casualDefault: Number(settingsForm.casualDefault),
        sickDefault: Number(settingsForm.sickDefault),
      });
      setSuccessMessage('✅ Leave defaults updated');
      fetchLeaveDefaults();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Failed to update defaults', err);
      setErrorMessage('Failed to update defaults');
      setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  // ✅ Get filtered leaves for display
  const filteredLeaves = getFilteredLeaves();

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="leave-container">
      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

      <div className="leave-header">
        <h1>Leave Management</h1>
        {user?.role === 'employee' && (
          <button onClick={() => setShowForm(!showForm)} className="apply-btn">
            {showForm ? '✕ Cancel' : '+ Apply Leave'}
          </button>
        )}
      </div>

      {/* EMPLOYEE: Default & Remaining leave balances */}
      {user?.role === 'employee' && (
        <div className="balances-summary">
          <h3>Your Leave Balances</h3>
          <p>Casual Leave (default per year): {leaveDefaults.casualDefault ?? '—'}</p>
          <p>Sick Leave (default per year): {leaveDefaults.sickDefault ?? '—'}</p>
          {balances ? (
            <div>
              <p>Casual remaining: {balances.casualRemaining ?? '—'}</p>
              <p>Sick remaining: {balances.sickRemaining ?? '—'}</p>
            </div>
          ) : (
            <p className="muted">Remaining balances not available</p>
          )}
        </div>
      )}

      {/* Leave Application Form */}
      {showForm && user?.role === 'employee' && (
        <form onSubmit={handleSubmit} className="leave-form">
          <h2>Apply for Leave</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Leave Type *</label>
              <select name="leaveType" value={formData.leaveType} onChange={handleChange} required>
                <option value="casual">Casual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="earned">Earned Leave</option>
                <option value="maternity">Maternity Leave</option>
                <option value="paternity">Paternity Leave</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>
            <div className="form-group">
              <label>Start Date *</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>End Date *</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Reason for Leave *</label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Please provide a reason for your leave request..."
              required
              rows="4"
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="submit-btn">Submit Request</button>
            <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <p className="form-info">ℹ️ Your leave request will be sent to HR for approval.</p>
        </form>
      )}

      {/* HR Tabs */}
      {(user?.role === 'hr' || user?.role === 'admin') && (
        <div className="leave-tabs">
          <button
            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            📋 Pending Requests ({pendingLeaves.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            📊 All Leaves
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Leave Settings
          </button>
        </div>
      )}

      {/* HR: Leave Settings (Default Casual + Sick) */}
      {(user?.role === 'hr' || user?.role === 'admin') && activeTab === 'settings' && (
        <div className="settings-section">
          <h2>Leave Defaults / Policy</h2>
          <p>Set default annual allowances for Casual and Sick leaves.</p>
          <form onSubmit={handleSettingsSave} className="settings-form">
            <div className="form-row">
              <div className="form-group">
                <label>Casual Leave (per year)</label>
                <input
                  type="number"
                  min="0"
                  name="casualDefault"
                  value={settingsForm.casualDefault}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, casualDefault: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Sick Leave (per year)</label>
                <input
                  type="number"
                  min="0"
                  name="sickDefault"
                  value={settingsForm.sickDefault}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, sickDefault: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="submit-btn">
                Save Defaults
              </button>
            </div>
          </form>
          <div className="current-defaults">
            <h4>Current defaults</h4>
            <p>Casual: {leaveDefaults.casualDefault ?? '—'}</p>
            <p>Sick: {leaveDefaults.sickDefault ?? '—'}</p>
          </div>
        </div>
      )}

      {/* ✅ NEW: Filter Section - Shows in All Leaves Tab */}
      {(user?.role === 'employee' ||
        ((user?.role === 'hr' || user?.role === 'admin') && activeTab === 'all')) && (
        <>
          <div className="filters-section">
            <h3>🔍 Filter & Search</h3>
            <div className="filters-grid">
              {/* Search by Employee Name (HR/Admin only) */}
              {(user?.role === 'hr' || user?.role === 'admin') && (
                <div className="filter-group">
                  <label>🔎 Search Employee</label>
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="filter-input"
                  />
                </div>
              )}

              {/* Filter by Month */}
              <div className="filter-group">
                <label>📅 Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Months</option>
                  <option value="01">January</option>
                  <option value="02">February</option>
                  <option value="03">March</option>
                  <option value="04">April</option>
                  <option value="05">May</option>
                  <option value="06">June</option>
                  <option value="07">July</option>
                  <option value="08">August</option>
                  <option value="09">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>

              {/* Filter by Year */}
              <div className="filter-group">
                <label>📆 Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Years</option>
                  {getAvailableYears().map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter by Status */}
              <div className="filter-group">
                <label>📊 Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Reset Button */}
              <div className="filter-group">
                <label>&nbsp;</label>
                <button onClick={handleResetFilters} className="add-btn">
                  🔄 Reset Filters
                </button>
              </div>
            </div>

            {/* Results Summary */}
            <div className="filter-results">
              <p>
                Showing <strong>{filteredLeaves.length}</strong> of <strong>{leaves.length}</strong> leaves
                {searchQuery && ` matching "${searchQuery}"`}
                {selectedMonth && ` in ${new Date(2000, parseInt(selectedMonth) - 1).toLocaleString('default', { month: 'long' })}`}
                {selectedYear && ` ${selectedYear}`}
                {selectedStatus && ` with status: ${selectedStatus}`}
              </p>
            </div>
          </div>

          {/* All Leaves Table */}
          <div className="leaves-section">
            <h2>{user?.role === 'employee' ? 'My Leave Requests' : 'All Leave Requests'}</h2>
            {filteredLeaves.length === 0 ? (
              <div className="no-data">
                {leaves.length === 0 
                  ? 'No leave requests found' 
                  : 'No leaves match the selected filters'}
              </div>
            ) : (
              <div className="leaves-table-wrapper">
                <table className="leaves-table">
                  <thead>
                    <tr>
                      <th>S.no</th>
                      {(user?.role === 'hr' || user?.role === 'admin') && <th>Employee Name</th>}
                      <th>Leave Type</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Days</th>
                      <th>Status</th>
                      <th>Reason</th>
                      <th>Casual Leave</th>
                      <th>Sick Leave</th>
                      {(user?.role === 'hr' || user?.role === 'admin') && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaves.map((leave, index) => {
                      const badge = getStatusBadge(leave.status);
                      return (
                        <tr key={leave._id} className={`row-${leave.status}`}>
                          <td>{index + 1}</td>

                          {(user?.role === 'hr' || user?.role === 'admin') && (
                            <td>
                              {leave.employee?.firstName} {leave.employee?.lastName}
                            </td>
                          )}

                          <td>{leave.leaveType}</td>
                          <td>{new Date(leave.startDate).toLocaleDateString()}</td>
                          <td>{new Date(leave.endDate).toLocaleDateString()}</td>
                          <td>{leave.numberOfDays}</td>
                          <td>
                            <span className={`status-badge ${badge.class}`}>{badge.text}</span>
                          </td>
                          <td>{leave.reason}</td>
                          <td>
                            {leave.casualLeave !== undefined ? leave.casualLeave : '—'}
                          </td>
                          <td>
                            {leave.sickLeave !== undefined ? leave.sickLeave : '—'}
                          </td>

                          {(user?.role === 'hr' || user?.role === 'admin') && (
                            <td>
                              <button
                                className="action-btn approve"
                                onClick={() => handleApproveLeave(leave._id, leave.leaveType, leave.numberOfDays)}
                                title="Approve"
                                disabled={leave.status !== 'pending'}
                              >
                                ✅
                              </button>
                              <button
                                className="action-btn reject"
                                onClick={() => handleRejectLeave(leave._id, leave.leaveType, leave.numberOfDays)}
                                title="Reject"
                                disabled={leave.status !== 'pending'}
                              >
                                ❌
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Leave;