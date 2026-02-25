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
import { json } from 'react-router-dom';

function Leave() {

  // ── State ──
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my-leaves');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // ✅ FIX: leaveType now uses DB enum values (lowercase)
  const [formData, setFormData] = useState({
    leaveType: 'casual',   // enum: 'casual' | 'sick' | 'earned' | ...
    category: 'Full',     // 'Short' | 'Full'
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    fromTime: '',
    toTime: '',
    reason: ''
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [rejectionRemark, setRejectionRemark] = useState('');

  const [leaveDefaults, setLeaveDefaults] = useState({ casualDefault: 8, sickDefault: 6, shortLeaveDefault: 3 });
  const [balances, setBalances] = useState(null);
  const [settingsForm, setSettingsForm] = useState({ casualDefault: '', sickDefault: '' });

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
      total: leaves.length,
      pending: leaves.filter(l => l.status === 'pending').length,
      approved: leaves.filter(l => l.status === 'approved').length,
      rejected: leaves.filter(l => l.status === 'rejected').length,
      today: leaves.filter(l => {
        const today = new Date().setHours(0, 0, 0, 0);
        const start = new Date(l.startDate).setHours(0, 0, 0, 0);
        const end = new Date(l.endDate).setHours(0, 0, 0, 0);
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
  const shortLeavesUsed = balances?.shortLeavesUsed ?? 0;
  const shortLeavesLimit = balances?.shortLeavesLimit ?? 3;
  const shortLeavesLeft = Math.max(shortLeavesLimit - shortLeavesUsed, 0);

  // ── Monthly casual / sick limits (1 each per month) ──
  const CASUAL_MONTHLY_LIMIT = 1;
  const SICK_MONTHLY_LIMIT = 1;

  const currentMonthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const casualUsedThisMonth = leaves.filter(l => {
    const leaveMonth = new Date(l.startDate).toISOString().slice(0, 7);
    return l.leaveType === 'casual' && l.status !== 'rejected' && leaveMonth === currentMonthYear;
  }).length;

  const sickUsedThisMonth = leaves.filter(l => {
    const leaveMonth = new Date(l.startDate).toISOString().slice(0, 7);
    return l.leaveType === 'sick' && l.status !== 'rejected' && leaveMonth === currentMonthYear;
  }).length;

  const isCasualLimitReached = casualUsedThisMonth >= CASUAL_MONTHLY_LIMIT;
  const isSickLimitReached = sickUsedThisMonth >= SICK_MONTHLY_LIMIT;

  // Build a message for whichever limits are reached
  const getLimitWarning = () => {
    const msgs = [];
    if (isCasualLimitReached) msgs.push('Casual Leave');
    if (isSickLimitReached) msgs.push('Sick Leave');
    if (shortLeavesLeft === 0) msgs.push('Short Leave');
    if (msgs.length === 0) return '';
    return `⚠️ Your limit for ${msgs.join(', ')} is full for this month.`;
  };
  const limitWarning = getLimitWarning();

  // ── Form Handlers ──
  const handleApplySubmit = async (e) => {
    e.preventDefault();

    // Guard: block if monthly limit reached for the chosen type
    if (formData.category !== 'Short') {
      if (formData.leaveType === 'casual' && isCasualLimitReached) {
        setErrorMessage('⚠️ Your Casual Leave limit is full for this month.');
        setTimeout(() => setErrorMessage(''), 4000);
        return;
      }
      if (formData.leaveType === 'sick' && isSickLimitReached) {
        setErrorMessage('⚠️ Your Sick Leave limit is full for this month.');
        setTimeout(() => setErrorMessage(''), 4000);
        return;
      }
    }
    if (formData.category === 'Short' && shortLeavesLeft === 0) {
      setErrorMessage('⚠️ Your Short Leave limit is full for this month.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }

    try {
      // ✅ FIX: payload uses correct enum values
      const payload = {
        employeeId: user?.id,
        leaveType: formData.leaveType,   // 'casual', 'sick', 'earned' — correct enums
        category: formData.category,   // 'Short' | 'Full'
        startDate: formData.startDate,
        endDate: formData.category === 'Short' ? formData.startDate : formData.endDate,
        reason: formData.reason,
        ...(formData.category === 'Short' && {
          fromTime: formData.fromTime,
          toTime: formData.toTime,
          leaveType: 'short', // Override to 'short' for short leave category
          category: 'Full'   // No need to send category to backend
        })
      };

      await leaveAPI.apply(payload);
      setSuccessMessage('✅ Leave request submitted successfully!');
      setErrorMessage('');
      setFormData({
        leaveType: 'casual',
        category: 'Full',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        fromTime: '',
        toTime: '',
        reason: ''
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
        leaveId: leave._id,
        approverId: user?.id,
        numberOfDays: leave.numberOfDays,
        leaveType: leave.leaveType
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
        leaveId: selectedLeave._id,
        numberOfDays: selectedLeave.numberOfDays,
        leaveType: selectedLeave.leaveType,
        rejectionReason: rejectionRemark,
        approverId: user?.id,
      });
      setIsRejectModalOpen(false);
      setRejectionRemark('');
      fetchLeaves();
    } catch (error) { console.error(error); }
  };

  // ── Calendar ──
  const renderCalendar = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="cal-cell empty"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daysLeave = leaves.find(l => {
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        const curr = new Date(dateString);
        return curr >= start && curr <= end;
      });

      let statusClass = '';
      if (daysLeave) {
        if (daysLeave.status === 'approved') statusClass = 'dot-green';
        else if (daysLeave.status === 'pending') statusClass = 'dot-orange';
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

  // ── Holiday Management State ──────────────────────────────────────────────
  const [holidays, setHolidays] = useState([
    { id: 1, name: 'New Year', date: '1st January 2026', day: 'Thursday' },
    { id: 2, name: 'Republic Day', date: '26th January 2026', day: 'Monday' },
    { id: 3, name: 'Mahashivratri', date: '15th February 2026', day: 'Sunday' },
    { id: 4, name: 'Holi', date: '4th March 2026', day: 'Wednesday' },
    { id: 5, name: 'Independence Day', date: '15th August 2026', day: 'Saturday' },
    { id: 6, name: 'Rakshabandhan', date: '28th August 2026', day: 'Thursday' },
    { id: 7, name: 'Janmashtami', date: '4th September 2026', day: 'Friday' },
    { id: 8, name: 'Gandhi Jayanti', date: '2nd October 2026', day: 'Friday' },
    { id: 9, name: 'Dussehra (Vijayadashami)', date: '20th October 2026', day: 'Tuesday' },
    { id: 10, name: 'Diwali', date: '8th – 11th November 2026', day: 'Sunday – Wednesday' },
    { id: 11, name: 'Govardhan Puja', date: '8th – 11th November 2026', day: 'Sunday – Wednesday' },
    { id: 12, name: 'Bhai Dooj', date: '8th – 11th November 2026', day: 'Sunday – Wednesday' },
    { id: 13, name: 'Christmas Day', date: '25th December 2026', day: 'Friday' },
  ]);

  const [showHolidayView, setShowHolidayView] = useState(false);
  const [showHolidayEdit, setShowHolidayEdit] = useState(false);
  const [showHolidayUpload, setShowHolidayUpload] = useState(false);
  const [editHolidays, setEditHolidays] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const openHolidayEdit = () => {
    setEditHolidays(holidays.map(h => ({ ...h })));
    setShowHolidayEdit(true);
  };

  const handleEditHolidayChange = (id, field, value) => {
    setEditHolidays(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h));
  };

  const handleAddHolidayRow = () => {
    const newId = Math.max(0, ...editHolidays.map(h => h.id)) + 1;
    setEditHolidays(prev => [...prev, { id: newId, name: '', date: '', day: '' }]);
  };

  const handleDeleteHolidayRow = (id) => {
    setEditHolidays(prev => prev.filter(h => h.id !== id));
  };

  const saveEditedHolidays = () => {
    setHolidays(editHolidays.filter(h => h.name.trim()));
    setShowHolidayEdit(false);
  };

  const handleHolidayFileUpload = (e) => {
    setUploadError('');
    setUploadSuccess('');
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'json') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          const arr = Array.isArray(parsed) ? parsed : parsed.holidays || [];
          if (!arr.length) { setUploadError('No holidays found in JSON.'); return; }
          const mapped = arr.map((h, i) => ({
            id: i + 1,
            name: h.name || h.holiday || h.Holiday || '',
            date: h.date || h.Date || '',
            day: h.day || h.Day || '',
          }));
          setHolidays(mapped);
          setUploadSuccess('\u2705 ' + mapped.length + ' holidays imported from JSON!');
        } catch { setUploadError('Invalid JSON format.'); }
      };
      reader.readAsText(file);
    } else if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const lines = ev.target.result.split('\n').filter(l => l.trim());
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
          const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('holiday'));
          const dateIdx = headers.findIndex(h => h.includes('date'));
          const dayIdx = headers.findIndex(h => h.includes('day'));
          const rows = lines.slice(1).map((line, i) => {
            const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
            return { id: i + 1, name: cols[nameIdx] || '', date: cols[dateIdx] || '', day: cols[dayIdx] || '' };
          }).filter(r => r.name);
          setHolidays(rows);
          setUploadSuccess('\u2705 ' + rows.length + ' holidays imported from CSV!');
        } catch { setUploadError('Failed to parse CSV.'); }
      };
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      setUploadError('For Excel files, please convert to CSV or JSON first, then re-upload.');
    } else {
      setUploadError('Unsupported file. Upload .xlsx, .csv, or .json');
    }
    e.target.value = '';
  };

  const isHR = user?.role === 'hr' || user?.role === 'admin' || user?.role === 'manager';

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="leave-dashboard">

      {/* ── Toast Messages ── */}
      {successMessage && <div className="toast-success">{successMessage}</div>}
      {errorMessage && <div className="toast-error">{errorMessage}</div>}

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div>
          <h1>Leave Management</h1>
          <p>Track and manage employee leave requests</p>
        </div>
        <div className="header-actions">
          {user?.role !== 'admin' && (
            <button className="btn-apply-main" onClick={() => {
              // Pre-select a valid leave type when opening modal
              const defaultType = !isCasualLimitReached ? 'casual' : !isSickLimitReached ? 'sick' : 'unpaid';
              setFormData(prev => ({ ...prev, leaveType: defaultType, category: 'Full' }));
              setIsApplyModalOpen(true);
            }}>
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
                    <th>Applied Reason</th>
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
                          {leave.status === 'pending' && <><HourglassSplit size={10} style={{ marginRight: 4 }} /> Pending</>}
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
                  const end = new Date(l.endDate).setHours(0, 0, 0, 0);
                  return l.status === 'approved' && today >= start && today <= end;
                }).length === 0 ? (
                  <div className="no-data">No leaves today</div>
                ) : (
                  leaves.filter(l => {
                    const today = new Date().setHours(0, 0, 0, 0);
                    const start = new Date(l.startDate).setHours(0, 0, 0, 0);
                    const end = new Date(l.endDate).setHours(0, 0, 0, 0);
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
            <h3 className='m-3 text-center'>📅 Upcoming Holidays</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 20, borderBottom: '1px solid #eee' }} className='d-flex justify-content-center'>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  title="Upload Holidays"
                  onClick={() => { setUploadError(''); setUploadSuccess(''); setShowHolidayUpload(true); }}
                  style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >⬆ Upload</button>
                <button
                  title="View All Holidays"
                  onClick={() => setShowHolidayView(true)}
                  style={{ background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >👁 View</button>
                <button
                  title="Edit Holidays"
                  onClick={openHolidayEdit}
                  style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >✏️ Edit</button>
              </div>
            </div>
            <div className="holiday-list">
              {holidays.slice(0, 5).map((h) => (
                <div key={h.id} className="holiday-item">
                  <div>
                    <strong>{h.name}</strong>
                    <span>{h.day}</span>
                  </div>
                  <span className="h-date">{h.date}</span>
                </div>
              ))}
              {holidays.length > 5 && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <button onClick={() => setShowHolidayView(true)} style={{ background: 'none', border: 'none', color: '#1565c0', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    +{holidays.length - 5} more holidays →
                  </button>
                </div>
              )}
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

              {/* ── Limit warning banner ── */}
              {limitWarning && (
                <div className="warning-banner limit-warning">
                  {limitWarning}
                </div>
              )}

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
                    <option value="casual" disabled={isCasualLimitReached}>
                      Casual Leave{isCasualLimitReached ? ' (Limit reached)' : ''}
                    </option>
                    <option value="sick" disabled={isSickLimitReached}>
                      Sick Leave{isSickLimitReached ? ' (Limit reached)' : ''}
                    </option>
                    <option value="unpaid">Unpaid Leave</option>
                  </select>
                  {/* Per-type inline messages */}
                  {formData.leaveType === 'casual' && isCasualLimitReached && (
                    <div className="warning-banner mt-1">
                      ⚠️ You have already used your Casual Leave for this month.
                    </div>
                  )}
                  {formData.leaveType === 'sick' && isSickLimitReached && (
                    <div className="warning-banner mt-1">
                      ⚠️ You have already used your Sick Leave for this month.
                    </div>
                  )}
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
                  <div className="progress">
                    <div style={{ width: `${calculateProgress(balances?.casualUsed ?? 0, leaveDefaults.casualDefault || 8)}%` }} className="blue"></div>
                  </div>
                </div>
              </div>
              <div className="b-card">
                <div className="icon"><ThermometerHalf className="c-red" /></div>
                <div className="b-info">
                  <small>Sick Leave</small>
                  <strong>{selectedLeave.sickLeave ?? leaveDefaults.sickDefault}</strong>
                  <div className="progress">
                    <div style={{ width: `${calculateProgress(balances?.sickUsed ?? 0, leaveDefaults.sickDefault || 6)}%` }} className="red"></div>
                  </div>
                </div>
              </div>
            </div>

            <h3>Leave History</h3>
            <table className="history-table">
              <thead>
                <tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Rejection Reason</th></tr>
              </thead>
              <tbody>
                {(selectedLeave.employeeLeaveHistory || [selectedLeave])
                  .filter(l => l.status !== 'left')
                  .slice(0, 10)
                  .map((lv, i) => (
                    <tr key={i}>
                      <td>{lv.leaveType}</td>
                      <td>{lv.startDate ? new Date(lv.startDate).toLocaleDateString() : '—'}</td>
                      <td>{lv.endDate ? new Date(lv.endDate).toLocaleDateString() : '—'}</td>
                      <td>{lv.numberOfDays}</td>
                      <td><span className={`status-badge ${lv.status}`}>{lv.status}</span></td>
                      <td className='text-danger'>{lv.rejectionReason}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* ═══════════════════════════════════════ */}
      {/* MODAL: VIEW ALL HOLIDAYS                */}
      {/* ═══════════════════════════════════════ */}
      {showHolidayView && (
        <div className="modal-overlay" onClick={() => setShowHolidayView(false)}>
          <div className="modal-content" style={{ maxWidth: 700, width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#1a237e', color: 'white', borderRadius: '8px 8px 0 0' }}>
              <h2 style={{ margin: 0, fontSize: 17 }} className='text-white p-3'>📅 Holiday Calendar 2026</h2>
              <button className="close-btn m-2" style={{ color: '#1a237e' }} onClick={() => setShowHolidayView(false)}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '16px 20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#e8eaf6' }}>
                    {['#', 'Holiday Name', 'Date', 'Day'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#1a237e', borderBottom: '2px solid #c5cae9', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h, i) => (
                    <tr key={h.id} style={{ background: i % 2 === 0 ? '#fff' : '#f5f5ff' }}>
                      <td style={{ padding: '9px 12px', color: '#888', width: 36 }}>{i + 1}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1a237e' }}>{h.name}</td>
                      <td style={{ padding: '9px 12px', color: '#374151' }}>{h.date}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ background: '#e8eaf6', color: '#3949ab', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{h.day}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, fontSize: 12, color: '#888', textAlign: 'center' }}>
                Total: <strong>{holidays.length}</strong> holidays
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowHolidayView(false)} style={{ background: '#1a237e', color: 'white', border: 'none', borderRadius: 7, padding: '8px 20px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* MODAL: EDIT HOLIDAYS                    */}
      {/* ═══════════════════════════════════════ */}
      {showHolidayEdit && (
        <div className="modal-overlay" onClick={() => setShowHolidayEdit(false)}>
          <div className="modal-content" style={{ maxWidth: 760, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#e65100', color: 'white', borderRadius: '8px 8px 0 0' }}>
              <h2 style={{ margin: 0, fontSize: 17 }} className='text-white p-3'>✏️ Edit Holiday Calendar</h2>
              <button className="close-btn m-2" style={{ color: '#e65100' }} onClick={() => setShowHolidayEdit(false)}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '16px 20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fff3e0' }}>
                    {['#', 'Holiday Name', 'Date', 'Day', ''].map((h, i) => (
                      <th key={i} style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 700, color: '#e65100', borderBottom: '2px solid #ffcc80' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editHolidays.map((h, i) => (
                    <tr key={h.id} style={{ background: i % 2 === 0 ? '#fff' : '#fffde7' }}>
                      <td style={{ padding: '6px 8px', color: '#aaa', width: 30 }}>{i + 1}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          value={h.name}
                          onChange={e => handleEditHolidayChange(h.id, 'name', e.target.value)}
                          placeholder="Holiday name"
                          style={{ width: '100%', border: '1px solid #ddd', borderRadius: 5, padding: '5px 8px', fontSize: 13, outline: 'none' }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          value={h.date}
                          onChange={e => handleEditHolidayChange(h.id, 'date', e.target.value)}
                          placeholder="e.g. 1st January 2026"
                          style={{ width: '100%', border: '1px solid #ddd', borderRadius: 5, padding: '5px 8px', fontSize: 13, outline: 'none' }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          value={h.day}
                          onChange={e => handleEditHolidayChange(h.id, 'day', e.target.value)}
                          placeholder="e.g. Monday"
                          style={{ width: '120px', border: '1px solid #ddd', borderRadius: 5, padding: '5px 8px', fontSize: 13, outline: 'none' }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteHolidayRow(h.id)}
                          title="Delete row"
                          style={{ background: '#fde8e8', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={handleAddHolidayRow}
                style={{ marginTop: 12, background: '#f3f4f6', color: '#374151', border: '1px dashed #9ca3af', borderRadius: 7, padding: '7px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >+ Add Row</button>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowHolidayEdit(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, padding: '8px 18px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveEditedHolidays} style={{ background: '#e65100', color: 'white', border: 'none', borderRadius: 7, padding: '8px 22px', fontWeight: 600, cursor: 'pointer' }}>💾 Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* MODAL: BULK UPLOAD HOLIDAYS             */}
      {/* ═══════════════════════════════════════ */}
      {showHolidayUpload && (
        <div className="modal-overlay" onClick={() => setShowHolidayUpload(false)}>
          <div className="modal-content" style={{ maxWidth: 520, width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#2e7d32', color: 'white', borderRadius: '8px 8px 0 0' }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>⬆ Bulk Upload Holidays</h2>
              <button className="close-btn" style={{ color: 'white' }} onClick={() => setShowHolidayUpload(false)}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {uploadError && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 7, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>❌ {uploadError}</div>}
              {uploadSuccess && <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: 7, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>{uploadSuccess}</div>}

              <p style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>
                Upload your holiday list as <strong>CSV</strong> or <strong>JSON</strong>. Your current holidays will be replaced.
              </p>

              {/* Upload zone */}
              <label style={{ display: 'block', border: '2px dashed #a5d6a7', borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: '#f1f8f2', marginBottom: 18 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                <div style={{ fontWeight: 600, color: '#2e7d32', marginBottom: 4 }}>Click to browse file</div>
                <div style={{ fontSize: 12, color: '#888' }}>Accepts .csv or .json files</div>
                <input type="file" accept=".csv,.json,.xlsx,.xls" style={{ display: 'none' }} onChange={handleHolidayFileUpload} />
              </label>

              {/* Format guide */}
              <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#555' }}>
                <strong style={{ display: 'block', marginBottom: 6, color: '#2e7d32' }}>📋 Expected Format</strong>
                <div style={{ marginBottom: 8 }}>
                  <strong>CSV columns:</strong> <code>name, date, day</code>
                  <pre style={{ margin: '4px 0', background: '#eee', padding: '6px 10px', borderRadius: 5, overflowX: 'auto' }}>{`name,date,day
Holi,4th March 2026,Wednesday`}</pre>
                </div>
                <div>
                  <strong>JSON format:</strong>
                  <pre style={{ margin: '4px 0', background: '#eee', padding: '6px 10px', borderRadius: 5, overflowX: 'auto' }}>{`[{"name":"Holi","date":"4th March 2026","day":"Wednesday"}]`}</pre>
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 24px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowHolidayUpload(false); setUploadError(''); setUploadSuccess(''); }}
                style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 7, padding: '8px 20px', fontWeight: 600, cursor: 'pointer' }}
              >Done</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Leave;