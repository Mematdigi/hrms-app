import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { leaveAPI } from '../services/api';
import {
  FileText,
  HourglassSplit,
  CheckCircle,
  XCircle,
  PersonCheck,
  Search,
  CheckLg,
  XLg,
  BriefcaseFill,
  ThermometerHalf,
  WalletFill,
  Calendar3,
  PlusLg,
  ChevronLeft,
  ChevronRight
} from 'react-bootstrap-icons';

function Leave() {

  // ── State ──
  const [leaves,        setLeaves]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState('my-leaves');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [selectedStatus,setSelectedStatus]= useState('');

  // ✅ FIX: leaveType now uses DB enum values (lowercase)
  const [formData, setFormData] = useState({
    leaveType: 'casual',   // enum: 'casual' | 'sick' | 'earned' | ...
    category:  'Full',     // 'Short' | 'Full'
    startDate: new Date().toISOString().split('T')[0],
    endDate:   new Date().toISOString().split('T')[0],
    fromTime:  '',
    toTime:    '',
    reason:    ''
  });

  const [successMessage,   setSuccessMessage]   = useState('');
  const [errorMessage,     setErrorMessage]     = useState('');
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isRejectModalOpen,setIsRejectModalOpen]= useState(false);
  const [isDetailModalOpen,setIsDetailModalOpen]= useState(false);
  const [selectedLeave,    setSelectedLeave]    = useState(null);
  const [rejectionRemark,  setRejectionRemark]  = useState('');

  const [leaveDefaults, setLeaveDefaults] = useState({ casualDefault: 8, sickDefault: 6 });
  const [balances,      setBalances]      = useState(null);
  const [settingsForm,  setSettingsForm]  = useState({ casualDefault: '', sickDefault: '' });

  const { user } = useSelector((state) => state.auth);

  // ── Init ──
  useEffect(() => {
    if (user?.role === 'hr' || user?.role === 'admin' || user?.role === 'manager') {
      setActiveTab('all');
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
    fetchLeaveDefaults();
    if (user?.role === 'employee') fetchBalances();
  }, [user]);

  // ── API calls ──
  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await leaveAPI.getRequests({ employeeId: user?.id, role: user?.role });
      setLeaves(response.data);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      setErrorMessage('Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveDefaults = async () => {
    try {
      const res = await leaveAPI.getDefaults();
      if (res?.data) {
        setLeaveDefaults(res.data);
        setSettingsForm({ casualDefault: res.data.casualDefault || '', sickDefault: res.data.sickDefault || '' });
      }
    } catch (err) { console.error('Failed to fetch leave defaults', err); }
  };

  const fetchBalances = async () => {
    if (!user?.id) return;
    try {
      const res = await leaveAPI.getBalances(user.id);
      setBalances(res.data || null);
      console.log('Fetched balances:', res.data);
    } catch (err) { console.error('Failed to fetch balances', err); }
  };

  // ── Helpers ──
  const getFilteredLeaves = () => {
    let filtered = [...leaves];
    if (searchQuery && (user?.role !== 'employee')) {
      filtered = filtered.filter(leave => {
        const fullName = `${leave.employee?.firstName} ${leave.employee?.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
      });
    }
    if (selectedStatus) filtered = filtered.filter(l => l.status === selectedStatus);
    return filtered;
  };

  const getStats = () => {
    return {
      total:    leaves.length,
      pending:  leaves.filter(l => l.status === 'pending').length,
      approved: leaves.filter(l => l.status === 'approved').length,
      rejected: leaves.filter(l => l.status === 'rejected').length,
      today:    leaves.filter(l => {
        const today = new Date().setHours(0,0,0,0);
        const start = new Date(l.startDate).setHours(0,0,0,0);
        const end   = new Date(l.endDate).setHours(0,0,0,0);
        return l.status === 'approved' && today >= start && today <= end;
      }).length
    };
  };
  const stats = getStats();

  const calculateProgress = (used, total) => {
    if (!total || total === 0) return 0;
    const pct = (used / total) * 100;
    return pct > 100 ? 100 : pct;
  };

  // ── Short leave remaining this month ──
  const shortLeavesUsed  = balances?.shortLeavesUsed  ?? 0;
  const shortLeavesLimit = balances?.shortLeavesLimit ?? 3;
  const shortLeavesLeft  = Math.max(shortLeavesLimit - shortLeavesUsed, 0);

  // ── Form Handlers ──
  const handleApplySubmit = async (e) => {
    e.preventDefault();
    try {
      // ✅ FIX: payload uses correct enum values
      const payload = {
        employeeId: user?.id,
        leaveType:  formData.leaveType,   // 'casual', 'sick', 'earned' — correct enums
        category:   formData.category,    // 'Short' | 'Full'
        startDate:  formData.startDate,
        endDate:    formData.category === 'Short' ? formData.startDate : formData.endDate,
        reason:     formData.reason,
        ...(formData.category === 'Short' && {
          fromTime: formData.fromTime,
          toTime:   formData.toTime,
        })
      };

      await leaveAPI.apply(payload);
      setSuccessMessage('✅ Leave request submitted successfully!');
      setErrorMessage('');
      setFormData({
        leaveType: 'casual',
        category:  'Full',
        startDate: new Date().toISOString().split('T')[0],
        endDate:   new Date().toISOString().split('T')[0],
        fromTime:  '',
        toTime:    '',
        reason:    ''
      });
      setIsApplyModalOpen(false);
      fetchLeaves();
      if (user?.role === 'employee') fetchBalances();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to submit leave request');
      setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  const handleApprove = async (leave) => {
    try {
      await leaveAPI.approve({
        leaveId:     leave._id,
        approverId:  user?.id,
        numberOfDays:leave.numberOfDays,
        leaveType:   leave.leaveType
      });
      fetchLeaves();
    } catch (error) { console.error(error); }
  };

  const initiateReject = (leave) => {
    setSelectedLeave(leave);
    setIsRejectModalOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectionRemark || !selectedLeave) return;
    try {
      await leaveAPI.reject({
        leaveId:         selectedLeave._id,
        numberOfDays:    selectedLeave.numberOfDays,
        leaveType:       selectedLeave.leaveType,
        rejectionReason: rejectionRemark,
        approverId:      user?.id,
      });
      setIsRejectModalOpen(false);
      setRejectionRemark('');
      fetchLeaves();
    } catch (error) { console.error(error); }
  };

  // ── Calendar ──
  const renderCalendar = () => {
    const today          = new Date();
    const currentMonth   = today.getMonth();
    const currentYear    = today.getFullYear();
    const daysInMonth    = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth= new Date(currentYear, currentMonth, 1).getDay();

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="cal-cell empty"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daysLeave  = leaves.find(l => {
        const start = new Date(l.startDate);
        const end   = new Date(l.endDate);
        const curr  = new Date(dateString);
        return curr >= start && curr <= end;
      });

      let statusClass = '';
      if (daysLeave) {
        if      (daysLeave.status === 'approved') statusClass = 'dot-green';
        else if (daysLeave.status === 'pending')  statusClass = 'dot-orange';
        else if (daysLeave.status === 'rejected') statusClass = 'dot-red';
      }

      const isToday = d === today.getDate() ? 'today' : '';
      days.push(
        <div key={d} className={`cal-cell ${isToday}`}>
          <span>{d}</span>
          {statusClass && <div className={`status-dot ${statusClass}`}></div>}
        </div>
      );
    }
    return days;
  };

  const filteredLeaves = getFilteredLeaves();

  const holidays = [
    { name: 'Holi',       date: '10 Mar 2026', day: 'Tuesday'  },
    { name: 'Good Friday',date: '03 Apr 2026', day: 'Friday'   },
    { name: 'Eid ul-Fitr',date: '21 Mar 2026', day: 'Saturday' },
  ];

  const isHR = user?.role === 'hr' || user?.role === 'admin' || user?.role === 'manager';

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="leave-dashboard">

      {/* ── Toast Messages ── */}
      {successMessage && <div className="toast-success">{successMessage}</div>}
      {errorMessage   && <div className="toast-error">{errorMessage}</div>}

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div>
          <h1>Leave Management</h1>
          <p>Track and manage employee leave requests</p>
        </div>
        <div className="header-actions">
          {user?.role !== 'admin' && (
            <button className="btn-apply-main" onClick={() => setIsApplyModalOpen(true)}>
              <PlusLg style={{ marginRight: '8px' }} /> Apply Leave
            </button>
          )}
          <div className="date-display">
            <Calendar3 style={{ marginRight: '8px' }} />
            Current Period: <strong>{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>
          </div>
        </div>
      </header>

      {/* ── HR Stats Cards ── */}
      {isHR && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="icon-box blue"><FileText size={22} /></div>
            <div className="info"><h3>{stats.total}</h3><span>Total Requests</span></div>
          </div>
          <div className="stat-card">
            <div className="icon-box orange"><HourglassSplit size={22} /></div>
            <div className="info"><h3>{stats.pending}</h3><span>Pending</span></div>
          </div>
          <div className="stat-card">
            <div className="icon-box green"><CheckCircle size={22} /></div>
            <div className="info"><h3>{stats.approved}</h3><span>Approved</span></div>
          </div>
          <div className="stat-card">
            <div className="icon-box red"><XCircle size={22} /></div>
            <div className="info"><h3>{stats.rejected}</h3><span>Rejected</span></div>
          </div>
          <div className="stat-card">
            <div className="icon-box purple"><PersonCheck size={22} /></div>
            <div className="info"><h3>{stats.today}</h3><span>On Leave Today</span></div>
          </div>
        </div>
      )}

      {/* ── Employee Balance Cards ── */}
      {user?.role === 'employee' && (
        <div className="balance-section">
          <div className="b-card">
            <div className="icon"><WalletFill className="c-green" /></div>
            <div className="b-info">
              <small>Short Leave</small>
              <div className="count-row">
                <strong>{balances?.shortLeavesUsed ?? 0}</strong>
                <span> / {leaveDefaults.shortLeavesLimit || 3} used</span>
              </div>
              <div className="progress">
                <div style={{ width: `${calculateProgress(balances?.shortLeavesUsed ?? 0, leaveDefaults.shortLeavesLimit || 3)}%` }} className="green"></div>
              </div>
            </div>
          </div>
          <div className="b-card">
            <div className="icon"><BriefcaseFill className="c-blue" /></div>
            <div className="b-info">
              <small>Casual Leave</small>
              <div className="count-row">
                <strong>{balances?.casualUsed ?? 0}</strong>
                <span> / {leaveDefaults.casualDefault || 8} used</span>
              </div>
              <div className="progress">
                <div style={{ width: `${calculateProgress(balances?.casualUsed ?? 0, leaveDefaults.casualDefault || 8)}%` }} className="blue"></div>
              </div>
            </div>
          </div>
          <div className="b-card">
            <div className="icon"><ThermometerHalf className="c-red" /></div>
            <div className="b-info">
              <small>Sick Leave</small>
              <div className="count-row">
                <strong>{balances?.sickUsed ?? 0}</strong>
                <span> / {leaveDefaults.sickDefault || 6} used</span>
              </div>
              <div className="progress">
                <div style={{ width: `${calculateProgress(balances?.sickUsed ?? 0, leaveDefaults.sickDefault || 6)}%` }} className="red"></div>
              </div>
            </div>
          </div>
          {/* <div className="b-card">
            <div className="icon"><WalletFill className="c-green" /></div>
            <div className="b-info">
              <small>Earned Leave</small>
              <div className="count-row">
                <strong>{balances?.earnedUsed ?? 0}</strong>
                <span> / 14 used</span>
              </div>
              <div className="progress">
                <div style={{ width: `${calculateProgress(balances?.earnedUsed ?? 0, 14)}%` }} className="green"></div>
              </div>
            </div>
          </div> */}
        </div>
      )}

      {/* ── Main Content Grid ── */}
      <div className="dashboard-grid">

        {/* Left: Table */}
        <div className="main-section">
          <div className="section-header">
            <h2>{user?.role === 'employee' ? 'My Leave History' : 'All Leave Requests'}</h2>
            <div className="controls">
              <div className="search-box">
                <Search className="search-icon" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {isHR && (
                <select
                  className="dept-select"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              )}
            </div>
          </div>

          <div className="table-container">
            {loading ? (
              <div className="loading-state">Loading...</div>
            ) : filteredLeaves.length === 0 ? (
              <div className="empty-state">No leave requests found.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    {isHR && <th>Employee</th>}
                    <th>Type</th>
                    <th>Date / Duration</th>
                    {isHR && <th>Applied On</th>}
                    <th>Status</th>
                    <th>Reason</th>
                    {isHR && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.map(leave => (
                    <tr
                      key={leave._id}
                      onClick={() => { setSelectedLeave(leave); setIsDetailModalOpen(true); }}
                      style={{ cursor: 'pointer' }}
                    >
                      {isHR && (
                        <td className="col-employee">
                          <div className="avatar">{leave.employee?.firstName?.charAt(0)}</div>
                          <div>
                            <div className="name">{leave.employee?.firstName} {leave.employee?.lastName}</div>
                            <div className="dept">{leave.employee?.department || 'N/A'}</div>
                          </div>
                        </td>
                      )}

                      <td className="col-type">
                        <span className={`type-tag ${leave.leaveType}`}>
                          {leave.leaveType?.charAt(0).toUpperCase() + leave.leaveType?.slice(1)}
                        </span>
                        {leave.category === 'Short' && <span className="sub-text"> (Short)</span>}
                      </td>

                      <td>
                        <div className="date-range">
                          {new Date(leave.startDate).toLocaleDateString()}
                          {leave.endDate && leave.endDate !== leave.startDate
                            ? ` → ${new Date(leave.endDate).toLocaleDateString()}`
                            : ''}
                        </div>
                        <div className="duration-text">{leave.numberOfDays} Day{leave.numberOfDays !== 1 ? 's' : ''}</div>
                      </td>

                      {isHR && (
                        <td><div className="applied-date">{new Date(leave.createdAt).toLocaleDateString()}</div></td>
                      )}

                      <td>
                        <span className={`status-badge ${leave.status}`}>
                          {leave.status === 'approved' && <><CheckCircle size={10} style={{ marginRight: 4 }} /> Approved</>}
                          {leave.status === 'pending'  && <><HourglassSplit size={10} style={{ marginRight: 4 }} /> Pending</>}
                          {leave.status === 'rejected' && <><XCircle size={10} style={{ marginRight: 4 }} /> Rejected</>}
                        </span>
                      </td>

                      <td className="col-reason">{leave.reason}</td>

                      {isHR && (
                        <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                          {leave.status === 'pending' && (
                            <>
                              <button className="btn-icon check" onClick={() => handleApprove(leave)} title="Approve">
                                <CheckLg size={16} />
                              </button>
                              <button className="btn-icon cross" onClick={() => initiateReject(leave)} title="Reject">
                                <XLg size={16} />
                              </button>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="sidebar">

          {/* Today's Leaves (HR only) */}
          {isHR && (
            <div className="widget">
              <h3>Today's Leaves</h3>
              <div className="today-list">
                {leaves.filter(l => {
                  const today = new Date().setHours(0, 0, 0, 0);
                  const start = new Date(l.startDate).setHours(0, 0, 0, 0);
                  const end   = new Date(l.endDate).setHours(0, 0, 0, 0);
                  return l.status === 'approved' && today >= start && today <= end;
                }).length === 0 ? (
                  <div className="no-data">No leaves today</div>
                ) : (
                  leaves.filter(l => {
                    const today = new Date().setHours(0, 0, 0, 0);
                    const start = new Date(l.startDate).setHours(0, 0, 0, 0);
                    const end   = new Date(l.endDate).setHours(0, 0, 0, 0);
                    return l.status === 'approved' && today >= start && today <= end;
                  }).map(l => (
                    <div key={l._id} className="list-item">
                      <div>
                        <strong>{l.employee?.firstName} {l.employee?.lastName}</strong>
                        <span>{l.leaveType} • {l.category || 'Full Day'}</span>
                      </div>
                      <span className="badge green">Approved</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Calendar Widget */}
          <div className="widget calendar-widget">
            <div className="cal-widget-header"><h3>Leave Calendar</h3></div>
            <div className="mini-calendar">
              <div className="month-nav">
                <div className="month-label">
                  {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </div>
                <div className="nav-arrows">
                  <ChevronLeft size={12} />
                  <ChevronRight size={12} />
                </div>
              </div>
              <div className="cal-header">
                <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
              </div>
              <div className="cal-grid">
                {renderCalendar()}
              </div>
            </div>
            <div className="cal-legend">
              <span><span className="dot dot-green"></span> Approved</span>
              <span><span className="dot dot-orange"></span> Pending</span>
              <span><span className="dot dot-red"></span> Rejected</span>
            </div>
          </div>

          {/* Holidays Widget */}
          <div className="widget">
            <h3>📅 Upcoming Holidays</h3>
            <div className="holiday-list">
              {holidays.map((h, i) => (
                <div key={i} className="holiday-item">
                  <div>
                    <strong>{h.name}</strong>
                    <span>{h.day}</span>
                  </div>
                  <span className="h-date">{h.date}</span>
                </div>
              ))}
            </div>
          </div>

        </aside>
      </div>

      {/* ══════════════════════════════ */}
      {/* MODAL 1: APPLY LEAVE          */}
      {/* ══════════════════════════════ */}
      {isApplyModalOpen && (
        <div className="modal-overlay" onClick={() => setIsApplyModalOpen(false)}>
          <div className="modal-content apply-modal" onClick={(e) => e.stopPropagation()}>

            <div className="modal-header">
              <h2>Apply for Leave</h2>
              <button className="close-btn" onClick={() => setIsApplyModalOpen(false)}><XLg /></button>
            </div>

            <form onSubmit={handleApplySubmit}>

              {/* Short / Full Day Toggle */}
              <div className="leave-type-toggle">
                <button
                  type="button"
                  className={`toggle-card ${formData.category === 'Short' ? 'active' : ''} ${shortLeavesLeft === 0 ? 'disabled' : ''}`}
                  onClick={() => {
                    if (shortLeavesLeft === 0) return;
                    setFormData({ ...formData, category: 'Short', leaveType: 'casual' });
                  }}
                >
                  <span className="toggle-icon">🕐</span>
                  <div className="fw-bold">Short Leave</div>
                  <div className="small text-muted">Hour-based</div>
                </button>

                <button
                  type="button"
                  className={`toggle-card ${formData.category === 'Full' ? 'active' : ''}`}
                  onClick={() => setFormData({ ...formData, category: 'Full' })}
                >
                  <span className="toggle-icon">📅</span>
                  <div className="fw-bold">Full Day Leave</div>
                  <div className="small text-muted">Day-based</div>
                </button>
              </div>

              {/* Short Leave Info */}
              {formData.category === 'Short' && shortLeavesLeft > 0 && (
                <div className="info-banner">
                  ℹ️ {shortLeavesLeft} short leave{shortLeavesLeft !== 1 ? 's' : ''} remaining this month
                </div>
              )}
              {shortLeavesLeft === 0 && (
                <div className="warning-banner">
                  ⚠️ Short leave limit reached ({shortLeavesLimit}/month). Please apply for Full Day Leave.
                </div>
              )}

              {/* ✅ FIX: Leave Type dropdown uses correct enum values */}
              {formData.category === 'Full' && (
                <>
                  <label>Leave Category</label>
                  <select
                    value={formData.leaveType}
                    onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                    required
                  >
                    <option value="casual">Casual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="earned">Earned Leave</option>
                    <option value="maternity">Maternity Leave</option>
                    <option value="paternity">Paternity Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                  </select>
                </>
              )}

              {/* Date Picker */}
              <label>Date{formData.category === 'Full' ? ' (From)' : ''}</label>
              <input
                type="date"
                value={formData.startDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />

              {/* End Date — only for Full Day multi-day */}
              {formData.category === 'Full' && (
                <>
                  <label>Date (To)</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    min={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </>
              )}

              {/* Time Fields — Short Leave only */}
              {formData.category === 'Short' && (
                <div className="time-row">
                  <div>
                    <label>From Time</label>
                    <input
                      type="time"
                      value={formData.fromTime}
                      onChange={(e) => setFormData({ ...formData, fromTime: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label>To Time</label>
                    <input
                      type="time"
                      value={formData.toTime}
                      onChange={(e) => setFormData({ ...formData, toTime: e.target.value })}
                      required
                    />
                  </div>
                </div>
              )}

              <label>Reason</label>
              <textarea
                placeholder="Please provide a reason for your leave..."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
              />

              <div className="modal-footer-btns">
                <button type="button" className="btn-cancel" onClick={() => setIsApplyModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit-leave">Submit Application</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════ */}
      {/* MODAL 2: REJECT LEAVE         */}
      {/* ══════════════════════════════ */}
      {isRejectModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRejectModalOpen(false)}>
          <div className="modal-content reject-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reject Leave</h2>
              <button className="close-btn" onClick={() => setIsRejectModalOpen(false)}><XLg /></button>
            </div>
            <div className="modal-body">
              <p>Employee: <strong>{selectedLeave?.employee?.firstName} {selectedLeave?.employee?.lastName}</strong></p>
              <p>Leave Type: <strong>{selectedLeave?.leaveType}</strong> | Days: <strong>{selectedLeave?.numberOfDays}</strong></p>
              <textarea
                className="reject-textarea"
                placeholder="Add a remark / reason for rejection..."
                value={rejectionRemark}
                onChange={(e) => setRejectionRemark(e.target.value)}
                required
              />
              <button
                className="reject-confirm-btn"
                onClick={confirmReject}
                disabled={!rejectionRemark.trim()}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════ */}
      {/* MODAL 3: LEAVE DETAIL (click on row)  */}
      {/* ══════════════════════════════════════ */}
      {isDetailModalOpen && selectedLeave && (
        <div className="modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn-abs" onClick={() => setIsDetailModalOpen(false)}><XLg /></button>

            <div className="user-header">
              <h2>{selectedLeave.employee?.firstName} {selectedLeave.employee?.lastName}</h2>
              <span className="tag">{selectedLeave.employee?.department || 'N/A'}</span>
            </div>

            {/* Balance cards from history */}
            <div className="balance-cards">
              <div className="b-card">
                <div className="icon"><BriefcaseFill className="c-blue" /></div>
                <div className="b-info">
                  <small>Casual Leave</small>
                  <strong>{selectedLeave.casualLeave ?? leaveDefaults.casualDefault}</strong>
                  <div className="progress"><div style={{ width: `${calculateProgress(
                    (leaveDefaults.casualDefault - (selectedLeave.casualLeave ?? leaveDefaults.casualDefault)),
                    leaveDefaults.casualDefault
                  )}%` }} className="blue"></div></div>
                </div>
              </div>
              <div className="b-card">
                <div className="icon"><ThermometerHalf className="c-red" /></div>
                <div className="b-info">
                  <small>Sick Leave</small>
                  <strong>{selectedLeave.sickLeave ?? leaveDefaults.sickDefault}</strong>
                  <div className="progress"><div style={{ width: `${calculateProgress(
                    (leaveDefaults.sickDefault - (selectedLeave.sickLeave ?? leaveDefaults.sickDefault)),
                    leaveDefaults.sickDefault
                  )}%` }} className="red"></div></div>
                </div>
              </div>
            </div>

            <h3>Leave History</h3>
            <table className="history-table">
              <thead>
                <tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {(selectedLeave.employeeLeaveHistory || [selectedLeave])
                  .filter(l => l.status !== 'left')
                  .slice(0, 10)
                  .map((lv, i) => (
                    <tr key={i}>
                      <td>{lv.leaveType}</td>
                      <td>{lv.startDate ? new Date(lv.startDate).toLocaleDateString() : '—'}</td>
                      <td>{lv.endDate   ? new Date(lv.endDate).toLocaleDateString()   : '—'}</td>
                      <td>{lv.numberOfDays}</td>
                      <td><span className={`status-badge ${lv.status}`}>{lv.status}</span></td>
                      <td>{lv.reason}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

export default Leave;