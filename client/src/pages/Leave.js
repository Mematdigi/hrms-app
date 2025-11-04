import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { leaveAPI } from '../services/api';
import '../styles/Leave.css';

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

  useEffect(() => {
    fetchLeaves();
    if (user?.role === 'hr') {
      fetchPendingLeaves();
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await leaveAPI.apply({
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

      {/* Tabs for HR */}
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

      {/* Pending Leaves for HR */}
      {user?.role === 'hr' && activeTab === 'pending' && (
        <div className="leaves-section">
          <h2>Pending Leave Requests for Approval</h2>
          {pendingLeaves.length === 0 ? (
            <div className="no-data">No pending leave requests</div>
          ) : (
            <div className="leaves-grid">
              {pendingLeaves.map((leave) => (
                <div key={leave._id} className="leave-card pending-card">
                  <div className="card-header">
                    <h3>{leave.employee?.firstName} {leave.employee?.lastName}</h3>
                    <span className="badge badge-pending">⏳ Pending</span>
                  </div>
                  <div className="card-body">
                    <p><strong>Department:</strong> {leave.employee?.department || 'N/A'}</p>
                    <p><strong>Leave Type:</strong> {leave.leaveType}</p>
                    <p><strong>Start Date:</strong> {new Date(leave.startDate).toLocaleDateString()}</p>
                    <p><strong>End Date:</strong> {new Date(leave.endDate).toLocaleDateString()}</p>
                    <p><strong>Days:</strong> {leave.numberOfDays}</p>
                    <p><strong>Reason:</strong> {leave.reason}</p>
                  </div>
                  <div className="card-actions">
                    <button 
                      className="approve-btn"
                      onClick={() => handleApproveLeave(leave._id)}
                    >
                      ✅ Approve
                    </button>
                    <button 
                      className="reject-btn"
                      onClick={() => handleRejectLeave(leave._id)}
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Leaves Table */}
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
                    {user?.role === 'hr' && <th>Employee</th>}
                    <th>Leave Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Days</th>
                    <th>Status</th>
                    <th>Reason</th>
                    {user?.role === 'hr' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((leave) => {
                    const badge = getStatusBadge(leave.status);
                    return (
                      <tr key={leave._id} className={`row-${leave.status}`}>
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
