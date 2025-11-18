import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { leaveAPI } from '../services/api';

function Leave() {
  const [leaves, setLeaves] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my-leaves');
  const [formData, setFormData] = useState({
    leaveType: 'casual',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { user } = useSelector((state) => state.auth);

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
    fetchLeaveDefaults(); // default casual + sick
    if (user?.role === 'hr') {
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

  // --- GET default casual & sick leaves from backend ---
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

  // --- GET employee leave balances (casualRemaining, sickRemaining) ---
  const fetchBalances = async () => {
    if (!user?.id) return;
    try {
      const res = await leaveAPI.getBalances(user.id);
      setBalances(res.data || null);
    } catch (err) {
      console.error('Failed to fetch balances', err);
    }
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

  const handleApproveLeave = async (leaveId) => {
    try {
      await leaveAPI.approve({
        leaveId,
        approverId: user?.id,
      });
      setSuccessMessage('✅ Leave request approved!');
      setTimeout(() => setSuccessMessage(''), 5000);
      fetchPendingLeaves();
      fetchLeaves();
      fetchBalances();
    } catch (error) {
      console.error('Error approving leave:', error);
      setErrorMessage('Failed to approve leave request');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const handleRejectLeave = async (leaveId) => {
    const rejectionReason = prompt('Enter rejection reason:');
    if (!rejectionReason) return;
    try {
      await leaveAPI.reject({
        leaveId,
        rejectionReason,
        approverId: user?.id,
      });
      setSuccessMessage('✅ Leave request rejected!');
      setTimeout(() => setSuccessMessage(''), 5000);
      fetchPendingLeaves();
      fetchLeaves();
      fetchBalances();
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

  // --- SAVE default casual & sick leaves from HR settings tab ---
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

      {/* HR Tabs */}
      {user?.role === 'hr' && (
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
            📊 All Requests
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
      {user?.role === 'hr' && activeTab === 'settings' && (
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
                  onChange={(e) => setSettingsForm({ ...settingsForm, casualDefault: e.target.value })}
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
                  onChange={(e) => setSettingsForm({ ...settingsForm, sickDefault: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="submit-btn">Save Defaults</button>
            </div>
          </form>
          <div className="current-defaults">
            <h4>Current defaults</h4>
            <p>Casual: {leaveDefaults.casualDefault ?? '—'}</p>
            <p>Sick: {leaveDefaults.sickDefault ?? '—'}</p>
          </div>
        </div>
      )}

      {/* All Leaves Table (Employee / HR All tab) */}
      {(user?.role === 'employee' || (user?.role === 'hr' && activeTab === 'all')) && (
        <div className="leaves-section">
          <h2>{user?.role === 'employee' ? 'My Leave Requests' : 'All Leave Requests'}</h2>
          {leaves.length === 0 ? (
            <div className="no-data">No leave requests found</div>
          ) : (
            <div className="leaves-table-wrapper">
              <table className="leaves-table">
                <thead>
                  <tr>
                    <th>S.no</th>
                    {user?.role === 'hr' && <th>Employee</th>}
                    <th>Leave Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Days</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Remaining Casual Leave</th>
                    <th>Remaining Sick Leave</th>
                    {user?.role === 'hr' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((leave, index) => {
                    const badge = getStatusBadge(leave.status);
                    return (
                      <tr key={leave._id} className={`row-${leave.status}`}>
                        <td>{index + 1}</td>
                        {user?.role === 'hr' && (
                          <td>{leave.employee?.firstName} {leave.employee?.lastName}</td>
                        )}
                        <td>{leave.leaveType}</td>
                        <td>{new Date(leave.startDate).toLocaleDateString()}</td>
                        <td>{new Date(leave.endDate).toLocaleDateString()}</td>
                        <td>{leave.numberOfDays}</td>
                        <td>
                          <span className={`status-badge ${badge.class}`}>
                            {badge.text}
                          </span>
                        </td>
                        <td>{leave.reason}</td>
                        <td>{leave.casualLeave !== undefined ? leave.casualLeave : '—'}</td>
                        <td>{leave.sickLeave !== undefined ? leave.sickLeave : '—'}</td>
                        {user?.role === 'hr' && leave.status === 'pending' && (
                          <td>
                            <button 
                              className="action-btn approve"
                              onClick={() => handleApproveLeave(leave._id)}
                              title="Approve"
                            >
                              ✅
                            </button>
                            <button 
                              className="action-btn reject"
                              onClick={() => handleRejectLeave(leave._id)}
                              title="Reject"
                            >
                              ❌
                            </button>
                          </td>
                        )}
                        {user?.role === 'hr' && leave.status !== 'pending' && (
                          <td>-</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Leave;
