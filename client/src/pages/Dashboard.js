// src/pages/Dashboard.js

// ==============================
// 1. Imports
// ==============================
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import api, { attendanceAPI, leaveAPI, employeeAPI, performanceAPI } from "../services/api";
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
   const [punchOutTime, setPunchOutTime] = useState(null);
   const [workingHours, setWorkingHours] = useState(0);

   // Leave Modal State
   const [showLeaveModal, setShowLeaveModal] = useState(false);
   const [leaveType, setLeaveType] = useState("full"); // 'short' or 'full'
   const [leaveFormData, setLeaveFormData] = useState({
      date:     new Date().toISOString().split('T')[0],
      fromTime: '',
      toTime:   '',
      reason:   ''
   });

   // ── DYNAMIC: Leave Balance State ──
   const [leaveBalances, setLeaveBalances] = useState(null);   // { annualUsed, annualTotal, casualUsed, sickUsed, shortLeavesTaken, ... }

   // HR Stats Data
   const [stats, setStats] = useState({
      totalEmployees: 0,
      presentToday: 0,
      pendingLeaves: 0,
      payrollStatus: "Processing"
   });

   // ── DYNAMIC: Recent Leave Requests (HR) ──
   const [recentLeaves, setRecentLeaves] = useState([]);

   // ── DYNAMIC: Top Performers (HR) ──
   const [topPerformers, setTopPerformers] = useState([]);

   // Determine Role
   const role = user?.role || "employee";
   const isHR = role === 'admin' || role === 'hr'|| role === 'manager';

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

            // ── 1. ALWAYS: Fetch Personal Attendance ──
            try {
               const attRes = await attendanceAPI.getAttendance({ employeeId: user?.id });
               setAttendance(attRes.data);

               const today = attRes.data.find(
                  (a) => new Date(a.date).toDateString() === new Date().toDateString()
               );

               if (today) {
                  if (today.checkInTime) {
                     const pTime = new Date(today.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                     setPunchTime(pTime);
                  }
                  if (today.checkOutTime) {
                     const pOutTime = new Date(today.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                     setPunchOutTime(pOutTime);
                  } else {
                     setPunchOutTime(null);
                  }
                  if (today.workingHours) {
                     setWorkingHours(today.workingHours);
                  } else {
                     setWorkingHours(0);
                  }
                  if (today.checkInTime && !today.checkOutTime) {
                     setCheckedIn(true);
                  } else {
                     setCheckedIn(false);
                  }
               } else {
                  setCheckedIn(false);
                  setPunchTime(null);
                  setPunchOutTime(null);
                  setWorkingHours(0);
               }
            } catch (err) {
               console.error("Personal attendance fetch failed", err);
            }

            // ── 2. ALWAYS: Fetch Leave Balances (Employee & HR both need short leave count) ──
            try {
               const balRes = await leaveAPI.getBalances(user?.id);
               setLeaveBalances(balRes.data || null);
            } catch (err) {
               console.error("Leave balances fetch failed", err);
            }

            // ── 3. HR-Specific Data ──
            if (isHR) {

               // 3a. Total Employees count
               let totalEmp = 0;
               try {
                  const empRes = await employeeAPI.getAll();
                  const allEmp = empRes.data || [];
                  totalEmp = allEmp.length;
               } catch (err) {
                  console.error("Employees fetch failed", err);
               }

               // 3b. Today's attendance → present count & pending leaves
               let presentCount = 0;
               let pendingCount = 0;
               try {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const allAttRes = await attendanceAPI.getAllAttendance({ from: todayStr, to: todayStr });
                  const todayRecords = allAttRes.data?.data || [];
                  presentCount = todayRecords.filter(
                     r => r.status === 'present' || (r.checkInTime && !r.checkOutTime) || r.checkInTime
                  ).length;
               } catch (err) {
                  console.error("All attendance fetch failed", err);
               }

               // 3c. Pending leave requests
               try {
                  const pendingRes = await leaveAPI.getPending();
                  const pendingData = pendingRes.data || [];
                  pendingCount = Array.isArray(pendingData) ? pendingData.length : 0;
               } catch (err) {
                  console.error("Pending leaves fetch failed", err);
               }

               // 3d. Recent leave requests for the table
               try {
                  const allLeavesRes = await leaveAPI.getRequests({ role: user?.role });
                  const allLeaves = allLeavesRes.data || [];

                  // Sort by most recent, take top 5
                  const sorted = [...allLeaves].sort(
                     (a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate)
                  );
                  const recent = sorted.slice(0, 5).map((leave) => {
                     const firstName = leave.employee?.firstName || '';
                     const lastName = leave.employee?.lastName || '';
                     const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '??';
                     return {
                        id: leave._id,
                        name: `${firstName} ${lastName}`.trim() || 'Unknown',
                        type: leave.leaveType || leave.category || 'Leave',
                        days: leave.numberOfDays || 1,
                        status: leave.status
                           ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1)
                           : 'Pending',
                        avatar: initials,
                     };
                  });
                  setRecentLeaves(recent);
               } catch (err) {
                  console.error("Recent leaves fetch failed", err);
               }

               // 3e. Payroll status for current month
               let payrollStatus = "Processing";
               try {
                  const payrollRes = await employeeAPI.getPayrolls();
                  const empPayrolls = payrollRes.data?.data || [];
                  const currentMonth = new Date().getMonth() + 1;
                  const currentYear = new Date().getFullYear();

                  // Check if any payroll was processed for current month
                  const processed = empPayrolls.some(emp => {
                     const monthIdx = emp.payroll?.month?.findIndex(
                        (m, idx) => m === currentMonth && emp.payroll.year[idx] === currentYear
                     );
                     return monthIdx !== -1 && monthIdx !== undefined &&
                        emp.payroll?.status?.[monthIdx] === 'paid';
                  });
                  payrollStatus = processed ? "Processed" : "Processing";
               } catch (err) {
                  console.error("Payroll fetch failed", err);
               }

               // 3f. Top Performers from performance reviews
               try {
                  const perfRes = await performanceAPI.getReviews({});
                  const allReviews = perfRes.data || [];

                  // Group reviews by employee, average their rating
                  const empRatings = {};
                  allReviews.forEach(review => {
                     const empId = review.employee?._id || review.employee;
                     if (!empId) return;
                     if (!empRatings[empId]) {
                        empRatings[empId] = {
                           name: `${review.employee?.firstName || ''} ${review.employee?.lastName || ''}`.trim(),
                           designation: review.employee?.designation || 'Employee',
                           totalRating: 0,
                           count: 0,
                        };
                     }
                     empRatings[empId].totalRating += review.rating || 0;
                     empRatings[empId].count += 1;
                  });

                  const ranked = Object.values(empRatings)
                     .map(e => ({ ...e, avgRating: e.count > 0 ? (e.totalRating / e.count) : 0 }))
                     .sort((a, b) => b.avgRating - a.avgRating)
                     .slice(0, 3);

                  setTopPerformers(ranked);
               } catch (err) {
                  console.error("Performance reviews fetch failed", err);
               }

               // Set all HR stats together
               setStats({
                  totalEmployees: totalEmp,
                  presentToday: presentCount,
                  pendingLeaves: pendingCount,
                  payrollStatus: payrollStatus,
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
   // 4. Derived Leave Values
   // ==============================

   // Annual leave values (from API or safe defaults)
   const annualUsed = leaveBalances?.annualUsed ?? leaveBalances?.earnedUsed ?? 0;
   const annualTotal = leaveBalances?.annualTotal ?? leaveBalances?.earnedTotal ?? 14;
   const annualRemaining = annualTotal - annualUsed;
   const annualPercent = annualTotal > 0 ? Math.round((annualUsed / annualTotal) * 100) : 0;

   // Short leaves: backend may track as shortLeavesUsed, or count from leaves data
   const shortLeavesTaken = leaveBalances?.shortLeavesUsed ?? leaveBalances?.shortUsed ?? 0;
   const shortLeavesLimit = leaveBalances?.shortLeavesLimit ?? 3;

   // Attendance rate string for HR card
   const attendanceRate = stats.totalEmployees > 0
      ? `${Math.round((stats.presentToday / stats.totalEmployees) * 100)}% attendance`
      : 'N/A';

   // Current month/year label
   const monthLabel = currentTime.toLocaleString('default', { month: 'long', year: 'numeric' });

   // ==============================
   // 5. Action Handlers
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
         setPunchOutTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (error) { console.error(error); }
   };

   // --- Leave Modal Handlers ---
   const handleOpenLeaveModal = () => {
      setShowLeaveModal(true);
      setLeaveType("full");
   };

   const handleSelectLeaveType = (type) => {
      if (type === 'short' && shortLeavesTaken >= shortLeavesLimit) return;
      setLeaveType(type);
   };

   const handleSubmitLeave = async () => {
      try {
         if (!leaveFormData.reason.trim()) {
            alert('Please provide a reason for the leave.');
            return;
         }
         if (leaveType === 'short' && (!leaveFormData.fromTime || !leaveFormData.toTime)) {
            alert('Please provide from and to time for short leave.');
            return;
         }

         // ✅ FIX: Use correct DB enum values — 'casual' not 'Casual Leave'
         const payload = {
            employeeId: user?.id,
            leaveType:  'casual',
            category:   leaveType === 'short' ? 'Short' : 'Full',
            startDate:  leaveFormData.date,
            endDate:    leaveFormData.date,
            reason:     leaveFormData.reason,
            ...(leaveType === 'short' && {
               fromTime: leaveFormData.fromTime,
               toTime:   leaveFormData.toTime,
            }),
         };

         await leaveAPI.apply(payload);

         setShowLeaveModal(false);
         setLeaveFormData({
            date:     new Date().toISOString().split('T')[0],
            fromTime: '',
            toTime:   '',
            reason:   ''
         });
         setLeaveType('full');

         // Refresh balances after applying
         try {
            const balRes = await leaveAPI.getBalances(user?.id);
            setLeaveBalances(balRes.data || null);
         } catch (e) { console.error('Balance refresh failed', e); }

      } catch (err) {
         console.error('Leave submission failed:', err);
         alert(err?.response?.data?.message || 'Failed to submit leave request. Please try again.');
      }
   };

   // Helper for Animation
   const AnimatedNumber = ({ value }) => {
      return <span>{value}</span>;
   };

   // ==============================
   // 6. Render Helpers (Components)
   // ==============================

   // --- HEADER ACTION BUTTONS (Used in both dashboards) ---
// ==============================
// 6. Render Helpers (Components)
// ==============================

// --- HEADER ACTION BUTTONS (Used in both dashboards) ---
const HeaderActionButtons = () => {
    // ✅ ADDED: If the user is an admin, do not show personal attendance/leave buttons
    if (user?.role === 'admin') {
        return null;
    }

    return (
        <div className="d-flex gap-3">
            <button
                className={`btn-header-custom ${checkedIn ? 'btn-red' : 'btn-gradient-blue'}`}
                onClick={checkedIn ? handleCheckOut : handleCheckIn}
            >
                {checkedIn ? <i className="bi bi-stop-circle me-2"></i> : <i className="bi bi-box-arrow-in-right me-2"></i>}
                {checkedIn ? 'Punch Out' : 'Punch In'}
            </button>

            <button className="btn-header-custom btn-gradient-blue" onClick={handleOpenLeaveModal}>
                <i className="bi bi-calendar-plus me-2"></i> Apply Leave
            </button>
        </div>
    );
};

   const generateCalendar = () => {
      const days = [];
      const daysInMonth = new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 0).getDate();
      const firstDay = new Date(currentTime.getFullYear(), currentTime.getMonth(), 1).getDay();

      for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);

      for (let i = 1; i <= daysInMonth; i++) {
         const isToday = i === currentTime.getDate();
         const isWeekend = new Date(currentTime.getFullYear(), currentTime.getMonth(), i).getDay() % 6 === 0;

         // Use real attendance data to determine status per day
         const dayDate = new Date(currentTime.getFullYear(), currentTime.getMonth(), i).toDateString();
         const dayRecord = attendance.find(a => new Date(a.date).toDateString() === dayDate);

         let statusClass = isWeekend ? 'weekend' : (i < currentTime.getDate() ? 'absent' : '');
         if (isToday) statusClass = 'today';
         if (dayRecord?.checkInTime) statusClass = 'present';
         if (dayRecord?.status === 'short-leave') statusClass = 'short-leave';

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
   // 7. Render Views
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
               {/* Punch Card */}
               <div className="col-lg-6">
                  <div className="dashboard-card punch-card h-100">
                     <div className="d-flex justify-content-between mb-3">
                        <span className="fw-bold">Attendance</span>
                        <span className={`badge-status ${checkedIn ? 'active' : 'inactive'}`}>
                           {checkedIn ? 'PUNCHED IN' : (punchOutTime ? 'COMPLETED' : 'NOT PUNCHED IN')}
                        </span>
                     </div>

                     <div className="text-center my-4">
                        <h1 className="display-4 fw-bold mb-0">{currentTime.toLocaleTimeString([], { hour12: false })}</h1>
                        <p className="text-muted">{currentTime.toDateString()}</p>
                     </div>

                     <div className="punch-stats row mt-4 text-center">
                        <div className="col-4">
                           <div className="small text-muted mb-1"><i className="bi bi-clock"></i> Punch In</div>
                           <div className="fw-bold">{punchTime || "--:--"}</div>
                        </div>

                        <div className="col-4 border-start border-end">
                           <div className="small text-muted mb-1"><i className="bi bi-clock-history"></i> Punch Out</div>
                           <div className="fw-bold">{punchOutTime || "--:--"}</div>
                        </div>

                        <div className="col-4">
                           <div className="small text-muted mb-1"><i className="bi bi-hourglass-split"></i> Worked</div>
                           <div className="fw-bold text-success">
                              {workingHours ? `${workingHours} hrs` : "0h 0m"}
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Leave Balance — DYNAMIC */}
               <div className="col-lg-6">
                  <div className="dashboard-card h-100">
                     <div className="d-flex justify-content-between align-items-center mb-4">
                        <span className="fw-bold">Leave Balance</span>
                     </div>

                     {/* Annual / Earned Leave */}
                     <div className="leave-item mb-4">
                        <div className="d-flex justify-content-between mb-1">
                           <span className="small fw-semibold">Annual Leave</span>
                           <span className="small text-muted">
                              {annualUsed}/{annualTotal} days used
                           </span>
                        </div>
                        <div className="progress rounded-pill" style={{ height: '8px' }}>
                           <div
                              className="progress-bar bg-primary"
                              role="progressbar"
                              style={{ width: `${annualPercent}%` }}
                           ></div>
                        </div>
                        <div className="mt-1 small">
                           <span className="text-primary">● Used: {annualUsed}</span>
                           <span className="text-muted ms-2">● Remaining: {annualRemaining}</span>
                        </div>
                     </div>

                     {/* Short Leave — DYNAMIC */}
                     <div className="leave-item p-3 rounded bg-light-purple">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                           <span className="fw-semibold text-purple">
                              <i className="bi bi-clock-history me-2"></i> Short Leave (This Month)
                           </span>
                           <span className="small text-muted">
                              {shortLeavesTaken}/{shortLeavesLimit} used
                           </span>
                        </div>
                        <div className="progress rounded-pill bg-white" style={{ height: '6px' }}>
                           <div
                              className="progress-bar bg-purple"
                              role="progressbar"
                              style={{ width: `${Math.min((shortLeavesTaken / shortLeavesLimit) * 100, 100)}%` }}
                           ></div>
                        </div>
                        <p className="small text-muted mt-2 mb-0">
                           {Math.max(shortLeavesLimit - shortLeavesTaken, 0)} short leaves remaining this month
                        </p>
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
               <HeaderActionButtons />
            </div>

            {/* Top Stats Cards — DYNAMIC */}
            <div className="row g-4 mb-4">
               {/* Card 1: Total Employees */}
               <div className="col-xl-3 col-md-6">
                  <div className="stat-card-modern bg-deep-blue text-white">
                     <div className="d-flex justify-content-between align-items-start">
                        <div>
                           <div className="small opacity-75 mb-1">Total Employees</div>
                           <h2 className="fw-bold mb-0">
                              <AnimatedNumber value={stats.totalEmployees} />
                           </h2>
                           <div className="small mt-2 badge bg-white-20">Active Staff</div>
                           <div className="extra-small text-green-light mt-1">
                              Updated live
                           </div>
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
                           <h2 className="fw-bold mb-0 text-dark">
                              <AnimatedNumber value={stats.presentToday} />
                           </h2>
                           <div className="small text-muted mt-2">{attendanceRate}</div>
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
                           <h2 className="fw-bold mb-0 text-dark">
                              <AnimatedNumber value={stats.pendingLeaves} />
                           </h2>
                           <div className="small text-muted mt-2">
                              {stats.pendingLeaves > 0 ? 'Requires attention' : 'All clear'}
                           </div>
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
                           <div className="small text-muted mt-2">{monthLabel}</div>
                        </div>
                        <div className="icon-box bg-blue-light text-blue"><i className="bi bi-currency-dollar"></i></div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="row g-4">
               {/* Left: Quick Actions */}
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

               {/* Right: Recent Leaves — DYNAMIC */}
               <div className="col-lg-8">
                  <div className="dashboard-card p-0 overflow-hidden">
                     <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
                        <h6 className="fw-bold mb-0">Recent Staff Requests</h6>
                        <span className="text-primary small cursor-pointer" onClick={() => navigate('/leave')}>View all →</span>
                     </div>

                     {recentLeaves.length === 0 ? (
                        <div className="p-4 text-center text-muted small">No recent leave requests</div>
                     ) : (
                        recentLeaves.map((leave, idx) => (
                           <div
                              key={leave.id}
                              className={`leave-request-row ${idx !== recentLeaves.length - 1 ? 'border-bottom' : ''}`}
                           >
                              <div className="d-flex align-items-center gap-3">
                                 <div className="avatar-circle-sm bg-blue-light text-blue fw-bold">
                                    {leave.avatar}
                                 </div>
                                 <div>
                                    <div className="fw-bold text-dark">{leave.name}</div>
                                    <div className="small text-muted">{leave.type} • {leave.days} day{leave.days !== 1 ? 's' : ''}</div>
                                 </div>
                              </div>
                              <span className={`badge-status-pill ${leave.status.toLowerCase()}`}>
                                 {leave.status}
                              </span>
                           </div>
                        ))
                     )}
                  </div>
               </div>
            </div>

            {/* Bottom: Top Performers — DYNAMIC */}
            <div className="mt-4">
               <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="fw-bold mb-0">📈 Top Performers</h5>
                  <span className="text-primary small cursor-pointer" onClick={() => navigate('/performance')}>View all →</span>
               </div>
               <div className="dashboard-card p-3">
                  {topPerformers.length === 0 ? (
                     <div className="text-center text-muted small py-3">
                        No performance reviews found. <span className="text-primary cursor-pointer" onClick={() => navigate('/performance')}>Add reviews →</span>
                     </div>
                  ) : (
                     <div className="row g-3">
                        {topPerformers.map((performer, idx) => {
                           const rankBg = idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-deep-blue' : 'bg-dark';
                           const ratingPercent = Math.round((performer.avgRating / 5) * 100);
                           return (
                              <div key={idx} className="col-md-4">
                                 <div className="performer-card bg-light">
                                    <div className={`rank-badge ${rankBg}`}>{idx + 1}</div>
                                    <div>
                                       <div className="fw-bold">{performer.name || 'Employee'}</div>
                                       <div className="small text-muted">{performer.designation || 'Staff'}</div>
                                    </div>
                                    <div className="ms-auto text-end">
                                       <div className="fw-bold text-success">{ratingPercent}%</div>
                                       <div className="extra-small text-muted">Rating</div>
                                    </div>
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  )}
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

               {/* Step 1: Selection */}
               <div className="d-flex gap-3 mb-3">
                  <div
                     className={`leave-type-card ${leaveType === 'short' ? 'active' : ''} ${shortLeavesTaken >= shortLeavesLimit ? 'disabled' : ''}`}
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

               {/* Short Leave Info/Warning — DYNAMIC */}
               {leaveType === 'short' && shortLeavesTaken < shortLeavesLimit && (
                  <div className="alert alert-soft-purple mb-3 py-2 small">
                     <i className="bi bi-info-circle me-2"></i>
                     {shortLeavesLimit - shortLeavesTaken} short leaves remaining this month
                  </div>
               )}
               {shortLeavesTaken >= shortLeavesLimit && (
                  <div className="alert alert-soft-red mb-3 py-2 small">
                     <i className="bi bi-exclamation-circle me-2"></i>
                     You have exceeded the Short Leave limit ({shortLeavesLimit}/month). Please apply for Full Day Leave.
                  </div>
               )}

               {/* Step 2: Form */}
               <div className="leave-form">
                  <Form.Group className="mb-3">
                     <Form.Label className="small fw-semibold">Date</Form.Label>
                     <Form.Control
                        type="date"
                        value={leaveFormData.date}
                        onChange={(e) => setLeaveFormData({ ...leaveFormData, date: e.target.value })}
                     />
                  </Form.Group>

                  {leaveType === 'short' && (
                     <div className="row g-2 mb-3">
                        <div className="col-6">
                           <Form.Label className="small fw-semibold">From Time</Form.Label>
                           <Form.Control
                              type="time"
                              onChange={(e) => setLeaveFormData({ ...leaveFormData, fromTime: e.target.value })}
                           />
                        </div>
                        <div className="col-6">
                           <Form.Label className="small fw-semibold">To Time</Form.Label>
                           <Form.Control
                              type="time"
                              onChange={(e) => setLeaveFormData({ ...leaveFormData, toTime: e.target.value })}
                           />
                        </div>
                     </div>
                  )}

                  <Form.Group className="mb-3">
                     <Form.Label className="small fw-semibold">Reason</Form.Label>
                     <Form.Control
                        as="textarea"
                        rows={3}
                        placeholder="Please provide a reason for your leave..."
                        onChange={(e) => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                     />
                  </Form.Group>
               </div>
            </Modal.Body>
            <Modal.Footer className="border-0 pt-0">
               <Button variant="light" className="w-100 rounded-pill mb-2" onClick={() => setShowLeaveModal(false)}>Cancel</Button>
               <Button
                  className="w-100 rounded-pill btn-deep-blue"
                  onClick={handleSubmitLeave}
                  disabled={leaveType === 'short' && shortLeavesTaken >= shortLeavesLimit}
               >
                  Submit Application
               </Button>
            </Modal.Footer>
         </Modal>
      </div>
   );
};

export default Dashboard;