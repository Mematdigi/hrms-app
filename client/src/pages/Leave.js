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
  Funnel,
  PlusLg,
  ChevronLeft,
  ChevronRight
} from 'react-bootstrap-icons';

function Leave() {
  
  // --- EXISTING STATE ---
  const [leaves, setLeaves] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my-leaves');
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  
  // Form States
  const [formData, setFormData] = useState({
    leaveType: 'Casual Leave',
    startDate: '',
    endDate: '',
    reason: '',
    category: 'Casual Leave'
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // --- UI STATES ---
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [rejectionRemark, setRejectionRemark] = useState('');

  const { user } = useSelector((state) => state.auth);

  // --- EXISTING EFFECTS ---
  useEffect(() => {
    if (user?.role === 'hr' || user?.role === 'admin') {
      setActiveTab("all");
    }
  }, []);

  const [leaveDefaults, setLeaveDefaults] = useState({ casualDefault: 0, sickDefault: 0 });
  const [balances, setBalances] = useState(null);
  const [settingsForm, setSettingsForm] = useState({ casualDefault: '', sickDefault: '' });

  useEffect(() => {
    fetchLeaves();
    fetchLeaveDefaults();
    if (user?.role === 'hr' || user?.role === 'admin') {
      fetchPendingLeaves();
    } else if (user?.role === 'employee') {
      fetchBalances();
    }
  }, [user]);

  // --- EXISTING API FUNCTIONS ---
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
    } catch (err) { console.error('Failed to fetch leave defaults', err); }
  };

  const fetchBalances = async () => {
    if (!user?.id) return;
    try {
      const res = await leaveAPI.getBalances(user.id);
      setBalances(res.data || null);
    } catch (err) { console.error('Failed to fetch balances', err); }
  };

  // --- LOGIC HELPERS ---
  const getFilteredLeaves = () => {
    let filtered = [...leaves];
    if (searchQuery && (user?.role === 'hr' || user?.role === 'admin')) {
      filtered = filtered.filter((leave) => {
        const fullName = `${leave.employee?.firstName} ${leave.employee?.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
      });
    }
    if (selectedStatus) filtered = filtered.filter(l => l.status === selectedStatus);
    return filtered;
  };

  const getStats = () => {
    const list = leaves; 
    return {
      total: list.length,
      pending: list.filter(l => l.status === 'pending').length,
      approved: list.filter(l => l.status === 'approved').length,
      rejected: list.filter(l => l.status === 'rejected').length,
      today: list.filter(l => {
        const today = new Date().setHours(0,0,0,0);
        const start = new Date(l.startDate).setHours(0,0,0,0);
        const end = new Date(l.endDate).setHours(0,0,0,0);
        return l.status === 'approved' && today >= start && today <= end;
      }).length
    };
  };
  const stats = getStats();

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    try {
      await leaveAPI.apply({ employeeId: user?.id, ...formData });
      setSuccessMessage('✅ Leave request submitted!');
      setFormData({ leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '', category: 'Casual Leave' });
      setIsApplyModalOpen(false);
      fetchLeaves();
      if (user?.role === 'employee') fetchBalances();
    } catch (error) {
      setErrorMessage('Failed to submit leave request');
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
      fetchPendingLeaves();
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
      fetchPendingLeaves();
    } catch (error) { console.error(error); }
  };

  // --- CALENDAR LOGIC ---
  const renderCalendar = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun

    const days = [];
    // Empty slots for previous month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="cal-cell empty"></div>);
    }

    // Days with data logic
    for (let d = 1; d <= daysInMonth; d++) {
      const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      // Check if any leave falls on this date
      const daysLeave = leaves.find(l => {
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        const current = new Date(dateString);
        return current >= start && current <= end;
      });

      let statusClass = '';
      if (daysLeave) {
        if(daysLeave.status === 'approved') statusClass = 'dot-green';
        else if(daysLeave.status === 'pending') statusClass = 'dot-orange';
        else if(daysLeave.status === 'rejected') statusClass = 'dot-red';
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
    { name: "Holi", date: "2026-03-10", day: "Tuesday" },
    { name: "Good Friday", date: "2026-04-03", day: "Friday" },
    { name: "Eid ul-Fitr", date: "2026-03-21", day: "Saturday" },
  ];

  // Helper to calculate percentage for progress bars
  const calculateProgress = (used, total) => {
     if (!total || total === 0) return 0;
     const pct = (used / total) * 100;
     return pct > 100 ? 100 : pct;
  };

  // --- JSX RENDER ---
  return (
    <div className="leave-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div>
          <h1>Leave Management</h1>
          <p>Track and manage employee leave requests</p>
        </div>
        <div className="header-actions">
           <div className="view-toggle">
              <span>{user?.role === 'hr' ? '🛡️ HR View' : '👤 Employee View'}</span>
           </div>
           <div className="date-display">
             <Calendar3 style={{marginRight: '8px'}} />
             Current Period: <strong>February 2026</strong>
           </div>
        </div>
      </header>

      {/* HR VIEW: Stats Cards */}
      {(user?.role === 'hr' || user?.role === 'admin') && (
        <div className="stats-row">
            <div className="stat-card">
            <div className="icon-box blue"><FileText size={22} /></div>
            <div className="info">
                <h3>{stats.total}</h3>
                <span>Total Requests</span>
            </div>
            </div>
            <div className="stat-card">
            <div className="icon-box orange"><HourglassSplit size={22} /></div>
            <div className="info">
                <h3>{stats.pending}</h3>
                <span>Pending</span>
            </div>
            </div>
            <div className="stat-card">
            <div className="icon-box green"><CheckCircle size={22} /></div>
            <div className="info">
                <h3>{stats.approved}</h3>
                <span>Approved</span>
            </div>
            </div>
            <div className="stat-card">
            <div className="icon-box red"><XCircle size={22} /></div>
            <div className="info">
                <h3>{stats.rejected}</h3>
                <span>Rejected</span>
            </div>
            </div>
            <div className="stat-card">
            <div className="icon-box purple"><PersonCheck size={22} /></div>
            <div className="info">
                <h3>{stats.today}</h3>
                <span>On Leave Today</span>
            </div>
            </div>
        </div>
      )}

      {/* EMPLOYEE VIEW: Balance Cards */}
      {user?.role === 'employee' && (
         <div className="balance-section">
            <div className="b-card">
                <div className="icon"><BriefcaseFill className="c-blue"/></div>
                <div className="b-info">
                    <small>Casual Leave</small>
                    <div className="count-row">
                        <strong>{balances?.casualUsed || 0}</strong>
                        <span> / {leaveDefaults.casualDefault || 12} used</span>
                    </div>
                    <div className="progress">
                        <div 
                           style={{width: `${calculateProgress(balances?.casualUsed || 0, leaveDefaults.casualDefault || 12)}%`}} 
                           className="blue"
                        ></div>
                    </div>
                </div>
            </div>
            <div className="b-card">
                <div className="icon"><ThermometerHalf className="c-red"/></div>
                <div className="b-info">
                    <small>Sick Leave</small>
                    <div className="count-row">
                        <strong>{balances?.sickUsed || 0}</strong>
                        <span> / {leaveDefaults.sickDefault || 8} used</span>
                    </div>
                    <div className="progress">
                        <div 
                           style={{width: `${calculateProgress(balances?.sickUsed || 0, leaveDefaults.sickDefault || 8)}%`}} 
                           className="red"
                        ></div>
                    </div>
                </div>
            </div>
            <div className="b-card">
                <div className="icon"><WalletFill className="c-green"/></div>
                <div className="b-info">
                    <small>Paid Leave</small>
                    <div className="count-row">
                        <strong>{balances?.paidUsed || 0}</strong>
                        <span> / 15 used</span> {/* Mock total for Paid */}
                    </div>
                    <div className="progress">
                        <div 
                           style={{width: `${calculateProgress(balances?.paidUsed || 0, 15)}%`}} 
                           className="green"
                        ></div>
                    </div>
                </div>
            </div>
         </div>
      )}

      <div className="dashboard-grid">
        {/* Left Column: Table */}
        <div className="main-section">
          <div className="section-header">
            <h2>{user?.role === 'employee' ? 'Leave History' : 'All Leave Requests'}</h2>
            
            {/* Show filters mainly for HR view, or simplified for Employee */}
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
              
              {(user?.role === 'hr' || user?.role === 'admin') && (
                <div className="filter-dropdown">
                    <select className="dept-select">
                    <option>All Departments</option>
                    <option>Engineering</option>
                    <option>HR</option>
                    </select>
                    <ChevronLeft className="dropdown-arrow" size={12} style={{transform: 'rotate(-90deg)'}}/>
                </div>
              )}
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {/* Hide Employee Name column for Employee View */}
                  {(user?.role === 'hr' || user?.role === 'admin') && <th>Employee</th>}
                  <th>Type</th>
                  <th>Date / Duration</th>
                  {(user?.role === 'hr' || user?.role === 'admin') && <th>Applied</th>}
                  <th>Status</th>
                  <th>Reason</th>
                  {(user?.role === 'hr' || user?.role === 'admin') && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map(leave => (
                  <tr key={leave._id} onClick={() => { setSelectedLeave(leave); setIsDetailModalOpen(true); }}>
                    
                    {/* Employee Name Cell */}
                    {(user?.role === 'hr' || user?.role === 'admin') && (
                        <td className="col-employee">
                        <div className="avatar">{leave.employee?.firstName?.charAt(0)}</div>
                        <div>
                            <div className="name">{leave.employee?.firstName} {leave.employee?.lastName}</div>
                            <div className="dept">Engineering</div>
                        </div>
                        </td>
                    )}

                    <td className="col-type">
                      <span className={`type-tag ${leave.leaveType === 'Sick Leave' ? 'sick' : 'casual'}`}>
                        {leave.leaveType.split(' ')[0]}
                      </span>
                      <span className="sub-text">Leave</span>
                    </td>
                    <td>
                      <div className="date-range">
                        {new Date(leave.startDate).toLocaleDateString()}
                        {leave.endDate !== leave.startDate && ` → ${new Date(leave.endDate).toLocaleDateString()}`}
                      </div>
                      <div className="duration-text">{leave.numberOfDays} Days</div>
                    </td>
                    
                    {(user?.role === 'hr' || user?.role === 'admin') && (
                        <td><div className="applied-date">2026-02-08</div></td>
                    )}

                    <td>
                      <span className={`status-badge ${leave.status}`}>
                        {leave.status === 'approved' && <><CheckCircle size={10} style={{marginRight:4}}/> Approved</>}
                        {leave.status === 'pending' && <><HourglassSplit size={10} style={{marginRight:4}}/> Pending</>}
                        {leave.status === 'rejected' && <><XCircle size={10} style={{marginRight:4}}/> Rejected</>}
                      </span>
                    </td>
                    <td className="col-reason">{leave.reason}</td>
                    
                    {(user?.role === 'hr' || user?.role === 'admin') && (
                      <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                        {leave.status === 'pending' && (
                          <>
                            <button className="btn-icon check" onClick={() => handleApprove(leave)}>
                                <CheckLg size={16} />
                            </button>
                            <button className="btn-icon cross" onClick={() => initiateReject(leave)}>
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
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="sidebar">
          <button className="btn-apply-main" onClick={() => setIsApplyModalOpen(true)}>
            <PlusLg style={{marginRight: '8px'}} /> Apply Leave
          </button>

          {/* Today's Leaves Widget - ONLY FOR HR */}
          {(user?.role === 'hr' || user?.role === 'admin') && (
            <div className="widget">
                <h3>Today's Leaves</h3>
                <div className="today-list">
                <div className="list-item">
                    <div>
                    <strong>Rahul Verma</strong>
                    <span>Sick Leave • Full Day</span>
                    </div>
                    <span className="badge green">Approved</span>
                </div>
                {/* ... more items ... */}
                </div>
            </div>
          )}

          {/* CALENDAR WIDGET */}
          <div className="widget calendar-widget">
            <div className="cal-widget-header">
                <h3>Leave Calendar</h3>
            </div>
            <div className="mini-calendar">
              <div className="month-nav">
                  <div className="month-label">February 2026</div>
                  <div className="nav-arrows">
                      <ChevronLeft size={12}/>
                      <ChevronRight size={12}/>
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

      {/* --- MODALS --- */}

      {/* 1. APPLY LEAVE MODAL */}
      {isApplyModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content apply-modal">
            <div className="modal-header">
              <h2>Apply for Leave</h2>
              <button className="close-btn" onClick={() => setIsApplyModalOpen(false)}><XLg /></button>
            </div>
            <form onSubmit={handleApplySubmit}>
              <label>Leave Type</label>
              <div className="radio-group">
                <button 
                  type="button" 
                  className={formData.category === 'Short' ? 'active' : ''}
                  onClick={() => setFormData({...formData, category: 'Short'})}
                >Short Leave</button>
                <button 
                  type="button" 
                  className={formData.category !== 'Short' ? 'active' : ''}
                  onClick={() => setFormData({...formData, category: 'Full'})}
                >Full Day Leave</button>
              </div>

              <label>Category</label>
              <select 
                 value={formData.leaveType} 
                 onChange={(e) => setFormData({...formData, leaveType: e.target.value})}
              >
                <option>Casual Leave</option>
                <option>Sick Leave</option>
                <option>Earned Leave</option>
              </select>

              <div className="row">
                <div>
                  <label>From Date</label>
                  <input type="date" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} required />
                </div>
                <div>
                  <label>To Date</label>
                  <input type="date" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} required />
                </div>
              </div>

              <label>Reason</label>
              <textarea 
                placeholder="Enter your reason..." 
                value={formData.reason} 
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
              />

              <button type="submit" className="submit-full-btn">Submit Request</button>
            </form>
          </div>
        </div>
      )}

      {/* 2. REJECT MODAL */}
      {isRejectModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content reject-modal">
            <div className="modal-header">
              <h2>Reject Leave</h2>
              <button className="close-btn" onClick={() => setIsRejectModalOpen(false)}><XLg /></button>
            </div>
            <div className="modal-body">
              <textarea 
                className="reject-textarea"
                placeholder="Add a remark for rejection..." 
                value={rejectionRemark}
                onChange={(e) => setRejectionRemark(e.target.value)}
              />
              <button className="reject-confirm-btn" onClick={confirmReject}>Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. DETAILS MODAL */}
      {isDetailModalOpen && selectedLeave && (
        <div className="modal-overlay">
          <div className="modal-content detail-modal">
            <button className="close-btn-abs" onClick={() => setIsDetailModalOpen(false)}><XLg /></button>
            <div className="user-header">
               <h2>{selectedLeave.employee?.firstName} {selectedLeave.employee?.lastName}</h2>
               <span className="tag">Engineering</span>
            </div>
            
            <div className="balance-cards">
              <div className="b-card">
                 <div className="icon"><BriefcaseFill className="c-blue"/></div>
                 <div className="b-info">
                   <small>Casual Leave</small>
                   <strong>{balances?.casualUsed || 9} <span>3/12 used</span></strong>
                   <div className="progress"><div style={{width: '25%'}} className="blue"></div></div>
                 </div>
              </div>
              <div className="b-card">
                 <div className="icon"><ThermometerHalf className="c-red"/></div>
                 <div className="b-info">
                   <small>Sick Leave</small>
                   <strong>{balances?.sickUsed || 7} <span>1/8 used</span></strong>
                   <div className="progress"><div style={{width: '12%'}} className="red"></div></div>
                 </div>
              </div>
              <div className="b-card">
                 <div className="icon"><WalletFill className="c-green"/></div>
                 <div className="b-info">
                   <small>Paid Leave</small>
                   <strong>{balances?.paidUsed || 10} <span>5/15 used</span></strong>
                   <div className="progress"><div style={{width: '33%'}} className="green"></div></div>
                 </div>
              </div>
            </div>

            <h3>Leave History</h3>
            <table className="history-table">
               <thead>
                 <tr><th>Type</th><th>Date</th><th>Duration</th><th>Status</th><th>Reason</th></tr>
               </thead>
               <tbody>
                 <tr>
                   <td>{selectedLeave.leaveType}</td>
                   <td>{new Date(selectedLeave.startDate).toLocaleDateString()}</td>
                   <td>Full Day</td>
                   <td><span className="status-badge approved">Approved</span></td>
                   <td>{selectedLeave.reason}</td>
                 </tr>
               </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

export default Leave;