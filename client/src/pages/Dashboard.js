// src/pages/Dashboard.js

// ==============================
// 1. Imports
// ==============================
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import api, { attendanceAPI } from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css"; 
import { Modal, Button, Form } from "react-bootstrap"; 

// ==============================
// 2. Main Component: Dashboard
// ==============================
const Dashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  // --- State Management ---
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Attendance State
  const [attendance, setAttendance] = useState([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [punchTime, setPunchTime] = useState(null);

  // Leave Modal State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState("full"); // 'short' or 'full'
  const [shortLeavesTaken, setShortLeavesTaken] = useState(1); // Mock: User taken 1/3
  const [leaveFormData, setLeaveFormData] = useState({
     date: new Date().toISOString().split('T')[0],
     fromTime: "",
     toTime: "",
     reason: ""
  });

  // HR Stats Data
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    pendingLeaves: 0,
    payrollStatus: "Processed"
  });

  const [recentLeaves, setRecentLeaves] = useState([]);

  // Determine Role
  const role = user?.role || "employee";
  const isHR = role === 'admin' || role === 'hr';

  // ==============================
  // 3. Effects
  // ==============================

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Data based on Role
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. ALWAYS Fetch Personal Attendance (For both HR and Employee to support Punching)
        try {
            const attRes = await attendanceAPI.getAttendance({ employeeId: user?.id });
            setAttendance(attRes.data);
            
            // Check today's status to set CheckedIn State
            const today = attRes.data.find(
              (a) => new Date(a.date).toDateString() === new Date().toDateString()
            );
            
            if (today?.checkInTime && !today?.checkOutTime) {
                setCheckedIn(true);
                // Format the time for display
                const pTime = new Date(today.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                setPunchTime(pTime);
            }
        } catch (err) {
            console.error("Personal attendance fetch failed", err);
        }

        // 2. HR Specific Data Fetching
        if (isHR) {
          const empRes = await api.get("/employees");
          const allEmp = empRes.data || [];
          
          // Mocking Leave Data for UI
          const mockLeaves = [
             { id: 1, name: "Sarah Wilson", type: "Sick Leave", days: 2, status: "Pending", avatar: "SW" },
             { id: 2, name: "Mike Johnson", type: "Annual Leave", days: 5, status: "Approved", avatar: "MJ" },
             { id: 3, name: "Emily Chen", type: "Personal Leave", days: 1, status: "Pending", avatar: "EC" },
          ];
          setRecentLeaves(mockLeaves);

          setStats({
            totalEmployees: allEmp.length,
            presentToday: Math.floor(allEmp.length * 0.93), // Mock calc
            pendingLeaves: 12,
            payrollStatus: "Processed"
          });
        } 
        
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, isHR]);

  // ==============================
  // 4. Action Handlers
  // ==============================
  const handleCheckIn = async () => {
    try {
      await attendanceAPI.checkIn({ employeeId: user?.id });
      setCheckedIn(true);
      setPunchTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (error) { console.error(error); }
  };

  const handleCheckOut = async () => {
    try {
      await attendanceAPI.checkOut({ employeeId: user?.id });
      setCheckedIn(false);
      setPunchTime(null);
    } catch (error) { console.error(error); }
  };

  // --- Leave Modal Handlers ---
  const handleOpenLeaveModal = () => {
      setShowLeaveModal(true);
      setLeaveType("full"); // Default to full
  };

  const handleSelectLeaveType = (type) => {
      // Prevent selecting short leave if limit reached
      if (type === 'short' && shortLeavesTaken >= 3) return;
      setLeaveType(type);
  };

  const handleSubmitLeave = () => {
      console.log("Submitting Leave:", { type: leaveType, ...leaveFormData });
      setShowLeaveModal(false);
      // API call would go here
  };

  // Helper for Animation
  const AnimatedNumber = ({ value }) => {
    return <span>{value}</span>; 
  };

  // ==============================
  // 5. Render Helpers (Components)
  // ==============================

  // --- HEADER ACTION BUTTONS (Used in both dashboards) ---
  const HeaderActionButtons = () => (
    <div className="d-flex gap-3">
        {/* Punch Button */}
        <button 
            className={`btn-header-custom ${checkedIn ? 'btn-red' : 'btn-gradient-blue'}`} 
            onClick={checkedIn ? handleCheckOut : handleCheckIn}
        >
            {checkedIn ? <i className="bi bi-stop-circle me-2"></i> : <i className="bi bi-box-arrow-in-right me-2"></i>}
            {checkedIn ? 'Punch Out' : 'Punch In'}
        </button>

        {/* Apply Leave Button */}
        <button className="btn-header-custom btn-gradient-blue" onClick={handleOpenLeaveModal}>
            <i className="bi bi-calendar-plus me-2"></i> Apply Leave
        </button>
    </div>
  );

  const generateCalendar = () => {
      const days = [];
      const daysInMonth = new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 0).getDate();
      const firstDay = new Date(currentTime.getFullYear(), currentTime.getMonth(), 1).getDay();
      
      for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
      
      for (let i = 1; i <= daysInMonth; i++) {
        const isToday = i === currentTime.getDate();
        const isWeekend = new Date(currentTime.getFullYear(), currentTime.getMonth(), i).getDay() % 6 === 0;
        let statusClass = isWeekend ? 'weekend' : 'absent';
        if (isToday) statusClass = 'today';
        if (i < currentTime.getDate() && !isWeekend) statusClass = i % 2 === 0 ? 'present' : 'short-leave';

        days.push(
          <div key={i} className={`calendar-day ${statusClass} ${isToday ? 'active' : ''}`}>
            <span>{i}</span>
            {!isWeekend && <span className="status-dot"></span>}
          </div>
        );
      }
      return days;
  };

  // ==============================
  // 6. Render Views
  // ==============================

  // --- EMPLOYEE DASHBOARD ---
  const renderEmployeeDashboard = () => {
    return (
      <div className="employee-dashboard fade-in">
        {/* Header with Buttons */}
        <div className="d-flex justify-content-between align-items-end mb-4">
          <div>
             <h2 className="fw-bold text-dark mb-1">Welcome back, {user?.firstName}</h2>
             <p className="text-muted small mb-0">Here's what's happening with your work today.</p>
          </div>
          {/* Header Buttons inserted here */}
          <HeaderActionButtons />
        </div>

        {/* Quick Pills */}
        <div className="d-flex gap-3 mb-4 flex-wrap">
          {['My Attendance', 'View Payroll', 'Performance', 'My Profile'].map((item, idx) => (
             <button key={idx} className="btn-pill-nav" onClick={() => navigate('#')}>
                {idx === 0 && <i className="bi bi-clock me-2"></i>}
                {idx === 1 && <i className="bi bi-cash-stack me-2"></i>}
                {item}
             </button>
          ))}
        </div>

        <div className="row g-4">
          {/* Punch Card (Display Only - Buttons Moved to Header) */}
          <div className="col-lg-6">
            <div className="dashboard-card punch-card h-100">
               <div className="d-flex justify-content-between mb-3">
                 <span className="fw-bold">Attendance</span>
                 <span className={`badge-status ${checkedIn ? 'active' : 'inactive'}`}>
                   {checkedIn ? 'PUNCHED IN' : 'NOT PUNCHED IN'}
                 </span>
               </div>
               
               <div className="text-center my-4">
                 <h1 className="display-4 fw-bold mb-0">{currentTime.toLocaleTimeString([], { hour12: false })}</h1>
                 <p className="text-muted">{currentTime.toDateString()}</p>
               </div>

               <div className="punch-stats row mt-4 text-center">
                 <div className="col-4">
                   <div className="small text-muted mb-1"><i className="bi bi-clock"></i> Punch In</div>
                   <div className="fw-bold">{checkedIn ? punchTime : "--:--"}</div>
                 </div>
                 <div className="col-4 border-start border-end">
                    <div className="small text-muted mb-1"><i className="bi bi-clock-history"></i> Punch Out</div>
                    <div className="fw-bold">--:--</div>
                 </div>
                 <div className="col-4">
                    <div className="small text-muted mb-1"><i className="bi bi-hourglass-split"></i> Worked</div>
                    <div className="fw-bold text-success">0h 0m</div>
                 </div>
               </div>
            </div>
          </div>

          {/* Leave Balance */}
          <div className="col-lg-6">
            <div className="dashboard-card h-100">
              <div className="d-flex justify-content-between align-items-center mb-4">
                 <span className="fw-bold">Leave Balance</span>
              </div>
              <div className="leave-item mb-4">
                <div className="d-flex justify-content-between mb-1">
                  <span className="small fw-semibold">Annual Leave</span>
                  <span className="small text-muted">8/24 days used</span>
                </div>
                <div className="progress rounded-pill" style={{height: '8px'}}>
                  <div className="progress-bar bg-primary" role="progressbar" style={{width: '33%'}}></div>
                </div>
                <div className="mt-1 small">
                  <span className="text-primary">● Used: 8</span> <span className="text-muted ms-2">● Remaining: 16</span>
                </div>
              </div>
              <div className="leave-item p-3 rounded bg-light-purple">
                 <div className="d-flex justify-content-between align-items-center mb-2">
                   <span className="fw-semibold text-purple"><i className="bi bi-clock-history me-2"></i> Short Leave (This Month)</span>
                   <span className="small text-muted">{shortLeavesTaken}/3 used</span>
                 </div>
                 <div className="progress rounded-pill bg-white" style={{height: '6px'}}>
                   <div className="progress-bar bg-purple" role="progressbar" style={{width: `${(shortLeavesTaken/3)*100}%`}}></div>
                 </div>
                 <p className="small text-muted mt-2 mb-0">{3 - shortLeavesTaken} short leaves remaining this month</p>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
             <div className="dashboard-card h-100">
               <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="fw-bold">Attendance Calendar</span>
                  <div className="text-muted small">February 2026 <i className="bi bi-chevron-right ms-1"></i></div>
               </div>
               <div className="calendar-grid">
                  <div className="cal-head">S</div><div className="cal-head">M</div><div className="cal-head">T</div><div className="cal-head">W</div><div className="cal-head">T</div><div className="cal-head">F</div><div className="cal-head">S</div>
                  {generateCalendar()}
               </div>
               <div className="d-flex gap-3 mt-3 justify-content-center">
                  <span className="small"><span className="legend-dot green"></span> Present</span>
                  <span className="small"><span className="legend-dot yellow"></span> Short Leave</span>
                  <span className="small"><span className="legend-dot red"></span> Absent</span>
                  <span className="small"><span className="legend-dot gray"></span> Weekend</span>
               </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  // --- HR DASHBOARD ---
  const renderHRDashboard = () => {
    return (
      <div className="hr-dashboard fade-in">
        {/* Header with Buttons */}
        <div className="d-flex justify-content-between align-items-end mb-4">
             <div>
                <h2 className="fw-bold text-dark mb-1">Good morning, {user?.firstName || 'Admin'}</h2>
                <p className="text-muted small mb-0">Here's what's happening with your team today.</p>
             </div>
             {/* Header Buttons inserted here for HR as well */}
             <HeaderActionButtons />
        </div>

        {/* Top Stats Cards */}
        <div className="row g-4 mb-4">
           {/* Card 1: Total Employees (Blue) */}
           <div className="col-xl-3 col-md-6">
              <div className="stat-card-modern bg-deep-blue text-white">
                 <div className="d-flex justify-content-between align-items-start">
                    <div>
                       <div className="small opacity-75 mb-1">Total Employees</div>
                       <h2 className="fw-bold mb-0">{stats.totalEmployees}</h2>
                       <div className="small mt-2 badge bg-white-20">12 new this month</div>
                       <div className="extra-small text-green-light mt-1">+8.2% vs last month</div>
                    </div>
                    <div className="icon-box bg-white-20"><i className="bi bi-people"></i></div>
                 </div>
              </div>
           </div>

           {/* Card 2: Present Today */}
           <div className="col-xl-3 col-md-6">
              <div className="stat-card-modern bg-white border">
                 <div className="d-flex justify-content-between align-items-start">
                    <div>
                       <div className="small text-muted mb-1">Present Today</div>
                       <h2 className="fw-bold mb-0 text-dark">{stats.presentToday}</h2>
                       <div className="small text-muted mt-2">93% attendance</div>
                    </div>
                    <div className="icon-box bg-green-light text-green"><i className="bi bi-person-check"></i></div>
                 </div>
              </div>
           </div>

           {/* Card 3: Pending Leaves */}
           <div className="col-xl-3 col-md-6">
              <div className="stat-card-modern bg-white border">
                 <div className="d-flex justify-content-between align-items-start">
                    <div>
                       <div className="small text-muted mb-1">Pending Leaves</div>
                       <h2 className="fw-bold mb-0 text-dark">{stats.pendingLeaves}</h2>
                       <div className="small text-muted mt-2">Requires attention</div>
                    </div>
                    <div className="icon-box bg-orange-light text-orange"><i className="bi bi-calendar-event"></i></div>
                 </div>
              </div>
           </div>

           {/* Card 4: Payroll Status */}
           <div className="col-xl-3 col-md-6">
              <div className="stat-card-modern bg-white border">
                 <div className="d-flex justify-content-between align-items-start">
                    <div>
                       <div className="small text-muted mb-1">Payroll Status</div>
                       <h2 className="fw-bold mb-0 text-dark">{stats.payrollStatus}</h2>
                       <div className="small text-muted mt-2">Feb 2026</div>
                    </div>
                    <div className="icon-box bg-blue-light text-blue"><i className="bi bi-currency-dollar"></i></div>
                 </div>
              </div>
           </div>
        </div>

        <div className="row g-4">
           {/* Left: Quick Actions (Cleaned up for HR) */}
           <div className="col-lg-4">
              <h5 className="fw-bold mb-3">Quick Actions</h5>
              <div className="dashboard-card p-3">
                 <button className="btn-quick-action" onClick={() => navigate('/employees')}>
                    <span className="icon-wrapper dark"><i className="bi bi-person-plus"></i></span>
                    <span className="fw-semibold">Add Employee</span>
                 </button>
                 <button className="btn-quick-action" onClick={() => navigate('/leave')}>
                    <span className="icon-wrapper purple"><i className="bi bi-check2-circle"></i></span>
                    <span className="fw-semibold">Approve Staff Leave</span>
                 </button>
                 <button className="btn-quick-action" onClick={() => navigate('/payroll')}>
                    <span className="icon-wrapper dark"><i className="bi bi-file-earmark-text"></i></span>
                    <span className="fw-semibold">Generate Payslip</span>
                 </button>
              </div>
           </div>

           {/* Right: Recent Leaves */}
           <div className="col-lg-8">
              <div className="dashboard-card p-0 overflow-hidden">
                 <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
                    <h6 className="fw-bold mb-0">Recent Staff Requests</h6>
                    <span className="text-primary small cursor-pointer" onClick={() => navigate('/leave')}>View all →</span>
                 </div>
                 {recentLeaves.map((leave, idx) => (
                    <div key={leave.id} className={`leave-request-row ${idx !== recentLeaves.length-1 ? 'border-bottom' : ''}`}>
                       <div className="d-flex align-items-center gap-3">
                          <div className="avatar-circle-sm bg-blue-light text-blue fw-bold">{leave.avatar}</div>
                          <div>
                             <div className="fw-bold text-dark">{leave.name}</div>
                             <div className="small text-muted">{leave.type} • {leave.days} days</div>
                          </div>
                       </div>
                       <span className={`badge-status-pill ${leave.status.toLowerCase()}`}>{leave.status}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Bottom: Top Performers */}
        <div className="mt-4">
           <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold mb-0">📈 Top Performers</h5>
              <span className="text-primary small cursor-pointer" onClick={() => navigate('/performance')}>View all →</span>
           </div>
           <div className="dashboard-card p-3">
              <div className="row g-3">
                 <div className="col-md-4">
                    <div className="performer-card bg-light">
                       <div className="rank-badge bg-primary">1</div>
                       <div>
                          <div className="fw-bold">Alex Thompson</div>
                          <div className="small text-muted">Senior Developer</div>
                       </div>
                       <div className="ms-auto text-end">
                          <div className="fw-bold text-success">98%</div>
                          <div className="extra-small text-muted">Attendance</div>
                       </div>
                    </div>
                 </div>
                 <div className="col-md-4">
                    <div className="performer-card bg-light">
                       <div className="rank-badge bg-deep-blue">2</div>
                       <div>
                          <div className="fw-bold">Jessica Lee</div>
                          <div className="small text-muted">Product Manager</div>
                       </div>
                       <div className="ms-auto text-end">
                          <div className="fw-bold text-success">96%</div>
                          <div className="extra-small text-muted">Attendance</div>
                       </div>
                    </div>
                 </div>
                 <div className="col-md-4">
                    <div className="performer-card bg-light">
                       <div className="rank-badge bg-dark">3</div>
                       <div>
                          <div className="fw-bold">David Kim</div>
                          <div className="small text-muted">UX Designer</div>
                       </div>
                       <div className="ms-auto text-end">
                          <div className="fw-bold text-success">95%</div>
                          <div className="extra-small text-muted">Attendance</div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-5 text-center">Loading Dashboard...</div>;

  return (
    <div className="hr-page">
       <main className="container-fluid p-4">
          {isHR ? renderHRDashboard() : renderEmployeeDashboard()}
       </main>

       {/* ======================= */}
       {/* APPLY LEAVE MODAL       */}
       {/* ======================= */}
       <Modal show={showLeaveModal} onHide={() => setShowLeaveModal(false)} centered className="leave-modal">
          <Modal.Header closeButton className="border-0 pb-0">
             <Modal.Title className="fw-bold fs-5">Apply for Leave</Modal.Title>
          </Modal.Header>
          <Modal.Body className="pt-2">
             
             {/* Step 1: Selection (Always visible at top for context) */}
             <div className="d-flex gap-3 mb-3">
                <div 
                   className={`leave-type-card ${leaveType === 'short' ? 'active' : ''} ${shortLeavesTaken >= 3 ? 'disabled' : ''}`}
                   onClick={() => handleSelectLeaveType('short')}
                >
                   <div className="icon"><i className="bi bi-clock"></i></div>
                   <div className="fw-bold">Short Leave</div>
                   <div className="small text-muted">Hour-based</div>
                </div>

                <div 
                   className={`leave-type-card ${leaveType === 'full' ? 'active' : ''}`}
                   onClick={() => handleSelectLeaveType('full')}
                >
                   <div className="icon"><i className="bi bi-calendar-event"></i></div>
                   <div className="fw-bold">Full Day Leave</div>
                   <div className="small text-muted">Day-based</div>
                </div>
             </div>

             {/* Short Leave Warning/Info */}
             {leaveType === 'short' && (
                 <div className="alert alert-soft-purple mb-3 py-2 small">
                    <i className="bi bi-info-circle me-2"></i>
                    {3 - shortLeavesTaken} short leaves remaining this month
                 </div>
             )}
             {shortLeavesTaken >= 3 && (
                 <div className="alert alert-soft-red mb-3 py-2 small">
                    <i className="bi bi-exclamation-circle me-2"></i>
                    You have exceeded the Short Leave limit (3/month). Please apply for Full Day Leave.
                 </div>
             )}

             {/* Step 2: Form */}
             <div className="leave-form">
                <Form.Group className="mb-3">
                   <Form.Label className="small fw-semibold">Date</Form.Label>
                   <Form.Control type="date" value={leaveFormData.date} onChange={(e) => setLeaveFormData({...leaveFormData, date: e.target.value})} />
                </Form.Group>

                {leaveType === 'short' && (
                   <div className="row g-2 mb-3">
                      <div className="col-6">
                         <Form.Label className="small fw-semibold">From Time</Form.Label>
                         <Form.Control type="time" onChange={(e) => setLeaveFormData({...leaveFormData, fromTime: e.target.value})} />
                      </div>
                      <div className="col-6">
                         <Form.Label className="small fw-semibold">To Time</Form.Label>
                         <Form.Control type="time" onChange={(e) => setLeaveFormData({...leaveFormData, toTime: e.target.value})} />
                      </div>
                   </div>
                )}

                <Form.Group className="mb-3">
                   <Form.Label className="small fw-semibold">Reason</Form.Label>
                   <Form.Control 
                      as="textarea" 
                      rows={3} 
                      placeholder="Please provide a reason for your leave..."
                      onChange={(e) => setLeaveFormData({...leaveFormData, reason: e.target.value})}
                   />
                </Form.Group>
             </div>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
             <Button variant="light" className="w-100 rounded-pill mb-2" onClick={() => setShowLeaveModal(false)}>Cancel</Button>
             <Button 
                className="w-100 rounded-pill btn-deep-blue" 
                onClick={handleSubmitLeave}
                disabled={leaveType === 'short' && shortLeavesTaken >= 3}
             >
                Submit Application
             </Button>
          </Modal.Footer>
       </Modal>
    </div>
  );
};

export default Dashboard;