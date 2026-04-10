// src/pages/Dashboard.js

// ==============================
// 1. Imports
// ==============================
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import api, { attendanceAPI, leaveAPI, employeeAPI, performanceAPI, resignationAPI } from "../services/api";
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
   const [selectedLeaveCategory, setSelectedLeaveCategory] = useState("casual"); // 'casual' | 'sick' | 'unpaid'
   const [leaveFormData, setLeaveFormData] = useState({
      date: new Date().toISOString().split('T')[0],
      fromTime: '',
      toTime: '',
      reason: ''
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

   // ── Performance Review Modal (Dashboard quick-create) ──
   const [showReviewModal, setShowReviewModal] = useState(false);
   const [reviewFormData, setReviewFormData] = useState({
      employee_id: '', reviewPeriodStart: '', reviewPeriodEnd: '',
      rating: 3, strengths: '', areasForImprovement: '', goals: '', comments: '',
   });
   const [reviewSubmitting, setReviewSubmitting] = useState(false);
   const [reviewSuccess, setReviewSuccess] = useState(false);

   // ── Employee's own performance reviews ──
   const [myReviews, setMyReviews] = useState([]);

   // ── HR: All reviews table + employee list for dropdown ──
   const [allReviews, setAllReviews] = useState([]);
   const [allEmployees, setAllEmployees] = useState([]);
   const [expandedReview, setExpandedReview] = useState(null); // review _id expanded in employee view

   // ── Resignation State ──
   const [myResignation, setMyResignation]               = useState(null);   // Employee's own resignation
   const [showResignModal, setShowResignModal]           = useState(false);
   const [resignFormData, setResignFormData]             = useState({ managerName: '', resignationReason: '' });
   const [resignSubmitting, setResignSubmitting]         = useState(false);

   // HR: all resignations panel
   const [allResignations, setAllResignations]           = useState([]);
   const [showHRResignPanel, setShowHRResignPanel]       = useState(false);

   // HR: reject modal
   const [showRejectModal, setShowRejectModal]           = useState(false);
   const [rejectingId, setRejectingId]                   = useState(null);
   const [rejectionReason, setRejectionReason]           = useState('');
   const [resignActionLoading, setResignActionLoading]   = useState(false);

   // Determine Role
   const role = user?.role || "employee";
   const isHR = role === 'admin' || role === 'hr' || role === 'manager';

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

            // ── 2b. Fetch performance reviews ──
            try {
               const perfRes = await performanceAPI.getReviews({});
               const allRevData = perfRes.data || [];
               
               
               const empId = String(user?.employeeId || user?.id);

               const mine = allRevData.filter(
                  r => String(r.employeeId) === empId
               );
               

               setAllReviews(allRevData);
               setMyReviews(mine);

            } catch (err) {
               console.error("My reviews fetch failed", err);
            }

            // ── 2c. Fetch all employees for review dropdown ──
            try {
               const empRes = await employeeAPI.getAll();
               setAllEmployees(empRes.data || []);
            } catch (err) {
               console.error("Employees fetch for dropdown failed", err);
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
                        reason: leave.reason || '',
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

               // 3f. Top Performers from performance reviews (current month only)
               try {
                  const perfRes = await performanceAPI.getReviews({});
                  const allReviews = perfRes.data || [];

                  // Filter to current month
                  const now = new Date();
                  const currentMonthReviews = allReviews.filter(review => {
                     const created = new Date(review.createdAt);
                     return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                  });

                  // Group reviews by employeeId, average their rating
                  const empRatings = {};
                  currentMonthReviews.forEach(review => {
                     const empId = review.employeeId;
                     if (!empId) return;
                     if (!empRatings[empId]) {
                        empRatings[empId] = {
                           name: review.fullName || `${review.firstName || ''} ${review.lastName || ''}`.trim() || 'Employee',
                           designation: review.designation || 'Staff',
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

            // ── 4. ALWAYS: Fetch my resignation status ──
            try {
               const resRes = await resignationAPI.getMine();
               setMyResignation(resRes.data?.data || null);
            } catch (err) {
               console.error("Resignation fetch failed", err);
            }

            // ── 5. HR: Fetch all resignations ──
            if (isHR) {
               try {
                  const allResRes = await resignationAPI.getAll();
                  setAllResignations(allResRes.data?.data || []);
               } catch (err) {
                  console.error("All resignations fetch failed", err);
               }
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
   const annualUsed = leaveBalances?.casualUsed + leaveBalances?.sickUsed ?? leaveBalances?.earnedUsed ?? 0;
   const annualTotal = leaveBalances?.annualTotal ?? leaveBalances?.earnedTotal ?? 14;
   const annualRemaining = annualTotal - annualUsed;
   const annualPercent = annualTotal > 0 ? Math.round((annualUsed / annualTotal) * 100) : 0;

   // Short leaves: backend may track as shortLeavesUsed, or count from leaves data
   const shortLeavesTaken = leaveBalances?.shortLeavesUsed ?? leaveBalances?.shortUsed ?? 0;
   const shortLeavesLimit = leaveBalances?.shortLeavesLimit ?? 3;

   // ── Monthly casual / sick limits (1 each per month) ──
   const CASUAL_MONTHLY_LIMIT = 1;
   const SICK_MONTHLY_LIMIT = 1;

   const currentMonthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

   // We compute from leaveBalances — backend tracks casualUsed/sickUsed for current month
   // casualUsed / sickUsed from balances reflect this month's usage
   const casualUsedThisMonth = leaveBalances?.casualUsed ?? 0;
   const sickUsedThisMonth = leaveBalances?.sickUsed ?? 0;

   const isCasualLimitReached = casualUsedThisMonth >= CASUAL_MONTHLY_LIMIT;
   const isSickLimitReached = sickUsedThisMonth >= SICK_MONTHLY_LIMIT;

   // Combined warning message for the modal banner
   const getMonthlyLimitWarning = () => {
      const msgs = [];
      if (isCasualLimitReached) msgs.push('Casual Leave');
      if (isSickLimitReached) msgs.push('Sick Leave');
      if (shortLeavesTaken >= shortLeavesLimit) msgs.push('Short Leave');
      if (msgs.length === 0) return '';
      return `⚠️ Your limit for ${msgs.join(', ')} is full for this month.`;
   };
   const monthlyLimitWarning = getMonthlyLimitWarning();

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
      // Pre-select the first available full-day leave type
      const defaultCategory = !isCasualLimitReached ? 'casual' : !isSickLimitReached ? 'sick' : 'unpaid';
      setSelectedLeaveCategory(defaultCategory);
      setLeaveType("full");
      setShowLeaveModal(true);
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

         // ── Monthly limit guards ──
         if (leaveType === 'short' && shortLeavesTaken >= shortLeavesLimit) {
            alert('⚠️ Your Short Leave limit is full for this month.');
            return;
         }
         if (leaveType === 'full' && selectedLeaveCategory === 'casual' && isCasualLimitReached) {
            alert('⚠️ Your Casual Leave limit is full for this month.');
            return;
         }
         if (leaveType === 'full' && selectedLeaveCategory === 'sick' && isSickLimitReached) {
            alert('⚠️ Your Sick Leave limit is full for this month.');
            return;
         }

         // ✅ FIX: Use correct DB enum values — 'casual' not 'Casual Leave'
         const payload = {
            employeeId: user?.id,
            leaveType: leaveType === 'short' ? 'short' : selectedLeaveCategory,
            category: leaveType === 'short' ? 'Full' : 'Full',
            startDate: leaveFormData.date,
            endDate: leaveFormData.date,
            reason: leaveFormData.reason,
            ...(leaveType === 'short' && {
               fromTime: leaveFormData.fromTime,
               toTime: leaveFormData.toTime,
            }),
         };

         await leaveAPI.apply(payload);

         setShowLeaveModal(false);
         setLeaveFormData({
            date: new Date().toISOString().split('T')[0],
            fromTime: '',
            toTime: '',
            reason: ''
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

   // ── Resignation Handlers ──
   const handleSubmitResignation = async () => {
      if (!resignFormData.managerName.trim() || !resignFormData.resignationReason.trim()) {
         alert('Please fill in all required fields.');
         return;
      }
      try {
         setResignSubmitting(true);
         const res = await resignationAPI.submit({
            managerName: resignFormData.managerName.trim(),
            resignationReason: resignFormData.resignationReason.trim(),
         });
         setMyResignation(res.data?.data || null);
         setShowResignModal(false);
         setResignFormData({ managerName: '', resignationReason: '' });
      } catch (err) {
         alert(err?.response?.data?.message || 'Failed to submit resignation. Please try again.');
      } finally {
         setResignSubmitting(false);
      }
   };

   const handleHRAccept = async (id) => {
      try {
         setResignActionLoading(true);
         await resignationAPI.accept(id);
         const updated = await resignationAPI.getAll();
         setAllResignations(updated.data?.data || []);
      } catch (err) {
         alert(err?.response?.data?.message || 'Action failed.');
      } finally {
         setResignActionLoading(false);
      }
   };

   const openRejectModal = (id) => {
      setRejectingId(id);
      setRejectionReason('');
      setShowRejectModal(true);
   };

   const handleHRReject = async () => {
      if (!rejectionReason.trim()) {
         alert('Please enter a rejection reason.');
         return;
      }
      try {
         setResignActionLoading(true);
         await resignationAPI.reject(rejectingId, { rejectionReason: rejectionReason.trim() });
         const updated = await resignationAPI.getAll();
         setAllResignations(updated.data?.data || []);
         setShowRejectModal(false);
         setRejectingId(null);
         setRejectionReason('');
      } catch (err) {
         alert(err?.response?.data?.message || 'Rejection failed.');
      } finally {
         setResignActionLoading(false);
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
            <button
               className="btn-header-custom"
               style={{ background: 'linear-gradient(135deg, #dc3545, #c82333)', color: '#fff', border: 'none' }}
               onClick={() => setShowResignModal(true)}
            >
               <i className="bi bi-box-arrow-right me-2"></i> Resign
            </button>
            {
               isHR && (
                  <button className="btn-header-custom btn-gradient-blue" onClick={() => setShowReviewModal(true)}>
                     <i className="bi bi-stars me-2"></i>Add Performance Review
                  </button>
               )
            }
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
                  {/* <p className="text-muted small mb-0">Here's what's happening with your work today.</p> */}
               </div>
               <HeaderActionButtons />
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
                        <p className="small text-muted mb-0">
                           {Math.max(shortLeavesLimit - shortLeavesTaken, 0)} short leaves remaining this month
                        </p>
                     </div>
                  </div>
               </div>
            </div>

            {/* ── My Performance Reviews ── */}
            <div className="mt-4">
               <div className="d-flex justify-content-between align-items-center mb-3">
                  {
                     isHR && (
                        <span className="text-primary small cursor-pointer" onClick={() => navigate('/performance')}>View all →</span>
                     )
                  }
               </div>
               <div className="dashboard-card p-3">
                  <h5 className="fw-bold mb-4">⭐ My Performance Reviews</h5>
                  {myReviews.length === 0 ? (
                     <div className="text-center py-4">
                        <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>📊</div>
                        <div className="text-muted small mt-2">No performance reviews yet.</div>
                     </div>
                  ) : (
                     <div className="row g-3">
                        {myReviews.map((review, idx) => {
                           const ratingColors = ['', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#27ae60'];
                           const ratingLabels = ['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'];
                           const col = ratingColors[review.rating] || '#999';
                           const isExpanded = expandedReview === review._id;
                           return (
                              <div key={review._id} className="col-md-6 col-lg-4">
                                 <div
                                    style={{ border: `1.5px solid ${col}44`, borderRadius: 12, overflow: 'hidden', background: '#fff', boxShadow: isExpanded ? `0 4px 16px ${col}22` : 'none', transition: 'box-shadow 0.2s' }}
                                 >
                                    {/* Card Header */}
                                    <div
                                       style={{ background: `linear-gradient(135deg, ${col}18, ${col}06)`, padding: '12px 14px', borderBottom: `1px solid ${col}22`, cursor: 'pointer' }}
                                       onClick={() => setExpandedReview(isExpanded ? null : review._id)}
                                    >
                                       <div className="d-flex justify-content-between align-items-center">
                                          <span style={{ background: col + '22', color: col, border: `1px solid ${col}55`, borderRadius: 12, padding: '3px 10px', fontWeight: 700, fontSize: '0.78rem' }}>
                                             {'⭐'.repeat(review.rating)} {ratingLabels[review.rating]}
                                          </span>
                                          <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} small text-muted`}></i>
                                       </div>
                                       <div className="fw-semibold small mt-2">{review.reviewPeriod}</div>
                                       <div className="extra-small text-muted">{review.createdAt ? review.createdAt.substring(0, 10).split('-').reverse().join('-') : '—'}</div>
                                    </div>
                                    {/* Expandable Body */}
                                    {isExpanded && (
                                       <div style={{ padding: '12px 14px' }} className="small">
                                          {review.strengths && (
                                             <div className="mb-2">
                                                <div className="fw-semibold text-success mb-1">💪 Strengths</div>
                                                <div className="text-muted">{review.strengths}</div>
                                             </div>
                                          )}
                                          {review.areasForImprovement && (
                                             <div className="mb-2">
                                                <div className="fw-semibold text-warning mb-1">📈 Improvements</div>
                                                <div className="text-muted">{review.areasForImprovement}</div>
                                             </div>
                                          )}
                                          {review.goals && (
                                             <div className="mb-2">
                                                <div className="fw-semibold text-primary mb-1">🎯 Goals</div>
                                                <div className="text-muted">{review.goals}</div>
                                             </div>
                                          )}
                                          {review.comments && (
                                             <div className="mb-0">
                                                <div className="fw-semibold text-secondary mb-1">💬 Comments</div>
                                                <div className="text-muted">{review.comments}</div>
                                             </div>
                                          )}
                                          {!review.strengths && !review.areasForImprovement && !review.goals && !review.comments && (
                                             <div className="text-muted text-center py-2">No details added.</div>
                                          )}
                                       </div>
                                    )}
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  )}
               </div>
            </div>

            {/* ── My Resignation Status Card (Employee) ── */}
            {myResignation && (
               <div className="mt-4">
                  <div className="dashboard-card p-3">
                     <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="fw-bold mb-0">📋 My Resignation</h5>
                        {myResignation.status === 'pending' && (
                           <span className="badge rounded-pill" style={{ background: '#fff3cd', color: '#856404', border: '1px solid #ffc107', fontSize: '0.78rem', padding: '5px 14px' }}>
                              ⏳ Pending Approval by HR
                           </span>
                        )}
                        {myResignation.status === 'accepted' && (
                           <span className="badge rounded-pill" style={{ background: '#d1e7dd', color: '#0a3622', border: '1px solid #198754', fontSize: '0.78rem', padding: '5px 14px' }}>
                              ✅ Accepted
                           </span>
                        )}
                        {myResignation.status === 'rejected' && (
                           <span className="badge rounded-pill" style={{ background: '#f8d7da', color: '#842029', border: '1px solid #dc3545', fontSize: '0.78rem', padding: '5px 14px' }}>
                              ❌ Rejected
                           </span>
                        )}
                     </div>

                     <div className="row g-3">
                        <div className="col-md-4">
                           <div className="small text-muted mb-1">Employee Name</div>
                           <div className="fw-semibold">{myResignation.employeeName}</div>
                        </div>
                        <div className="col-md-4">
                           <div className="small text-muted mb-1">Manager / TL</div>
                           <div className="fw-semibold">{myResignation.managerName}</div>
                        </div>
                        <div className="col-md-4">
                           <div className="small text-muted mb-1">Submitted On</div>
                           <div className="fw-semibold">{new Date(myResignation.createdAt).toLocaleDateString('en-IN')}</div>
                        </div>
                        <div className="col-12">
                           <div className="small text-muted mb-1">Reason for Resignation</div>
                           <div className="p-2 rounded" style={{ background: '#f8f9fa', fontSize: '0.875rem', lineHeight: 1.6 }}>
                              {myResignation.resignationReason}
                           </div>
                        </div>

                        {/* HR rejection reason */}
                        {myResignation.status === 'rejected' && myResignation.rejectionReason && (
                           <div className="col-12">
                              <div className="alert mb-0 p-3" style={{ background: '#f8d7da', border: '1px solid #f1aeb5', borderRadius: 10 }}>
                                 <div className="fw-semibold small text-danger mb-1">
                                    <i className="bi bi-info-circle me-1"></i>HR Rejection Reason:
                                 </div>
                                 <div className="small">{myResignation.rejectionReason}</div>
                              </div>
                           </div>
                        )}

                        {/* Re-apply option */}
                        {myResignation.canReapply && myResignation.status === 'rejected' && (
                           <div className="col-12">
                              <button
                                 className="btn btn-sm rounded-pill px-4 fw-semibold"
                                 style={{ background: 'linear-gradient(135deg, #0d6efd, #0a58ca)', color: '#fff', border: 'none' }}
                                 onClick={() => {
                                    setResignFormData({ managerName: myResignation.managerName, resignationReason: '' });
                                    setShowResignModal(true);
                                 }}
                              >
                                 <i className="bi bi-arrow-repeat me-2"></i>Apply Again
                              </button>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            )}
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
                  {/* <p className="text-muted small mb-0">Here's what's happening with your team today.</p> */}
               </div>
               <HeaderActionButtons />
            </div>

            {/* Top Stats Cards — DYNAMIC */}
            <div className="row g-4 mb-4">
               {/* Card 1: Total Employees */}
               <div className="col-xl-3 col-md-6">
                  <div className="stat-card-modern bg-deep-blue text-white" onClick={() => navigate('/employees')}>
                     <div className="d-flex justify-content-between align-items-start">
                        <div>
                           <div className="small opacity-75 mb-1">Total Employees</div>
                           <h2 className="fw-bold mb-0">
                              <AnimatedNumber value={stats.totalEmployees} />
                           </h2>
                           <div className="small mt-2 badge bg-white-20">Active Staff</div>
                        </div>
                        <div className="icon-box bg-white-20"><i className="bi bi-people"></i></div>
                     </div>
                  </div>
               </div>

               {/* Card 2: Present Today */}
               <div className="col-xl-3 col-md-6">
                  <div className="stat-card-modern bg-white border" onClick={() => navigate('/attendance')}>
                     <div className="d-flex justify-content-between align-items-start">
                        <div>
                           <div className="small text-muted mb-1">Present Today</div>
                           <h2 className="fw-bold mb-0 text-dark">
                              <AnimatedNumber value={stats.presentToday} />
                           </h2>
                           <div className="small text-muted">{attendanceRate}</div>
                        </div>
                        <div className="icon-box bg-green-light text-green"><i className="bi bi-person-check"></i></div>
                     </div>
                  </div>
               </div>

               {/* Card 3: Pending Leaves */}
               <div className="col-xl-3 col-md-6" >
                  <div className="stat-card-modern bg-white border" onClick={() => navigate('/leave')}>
                     <div className="d-flex justify-content-between align-items-start">
                        <div>
                           <div className="small text-muted mb-1">Pending Leaves</div>
                           <h2 className="fw-bold mb-0 text-dark">
                              <AnimatedNumber value={stats.pendingLeaves} />
                           </h2>
                           <div className="small text-muted">
                              {stats.pendingLeaves > 0 ? 'Requires attention' : 'All clear'}
                           </div>
                        </div>
                        <div className="icon-box bg-orange-light text-orange"><i className="bi bi-calendar-event"></i></div>
                     </div>
                  </div>
               </div>

               {/* Card 4: Payroll Status */}
               <div className="col-xl-3 col-md-6">
                  <div className="stat-card-modern bg-white border" onClick={() => navigate('/payroll')}>
                     <div className="d-flex justify-content-between align-items-start">
                        <div>
                           <div className="small text-muted mb-1">Payroll Status</div>
                           <h2 className="fw-bold mb-0 text-dark">{stats.payrollStatus}</h2>
                           <div className="small text-muted">{monthLabel}</div>
                        </div>
                        <div className="icon-box bg-blue-light text-blue"><i className="bi bi-currency-dollar"></i></div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="row g-4">
               {/* Left: Quick Actions */}
               <div className="col-lg-3">
                  <div className="dashboard-card p-3">
                     <h5 className="fw-bold mb-3">Quick Actions</h5>
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
                     {/* <button className="btn-quick-action" onClick={() => setShowReviewModal(true)}>
                        <span className="icon-wrapper" style={{ background: '#e8f5e9' }}><i className="bi bi-star" style={{ color: '#2e7d32' }}></i></span>
                        <span className="fw-semibold">Add Review</span>
                     </button> */}
                  </div>
               </div>

               {/* Right: Recent Leaves — DYNAMIC */}
               <div className="col-lg-9">
                  <div className="dashboard-card p-0 overflow-hidden">
                     <div className="p-3 border-bottom d-flex justify-content-between align-items-center max-sm-flex-column gap-2">
                        <h6 className="fw-bold mb-0">Recent Staff Requests</h6>
                        <span className="text-primary small cursor-pointer" onClick={() => navigate('/leave')}>View all →</span>
                     </div>

                     {recentLeaves.length === 0 ? (
                        <div className="p-4 text-center text-muted small">No recent leave requests</div>
                     ) : (
                        recentLeaves.slice(0, 3).map((leave, idx) => (
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
                                 <div>
                                    <div className="text-muted extra-small mt-1 border rounded px-2 py-1" style={{ background: '#f8f9fa' }}>
                                       {leave.reason}
                                    </div>
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
               <div className="dashboard-card p-3">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                     <h5 className="fw-bold mb-0">🏆 Top Performers — {monthLabel}</h5>
                     <span className="text-primary small cursor-pointer" onClick={() => navigate('/performance')}>View all →</span>
                  </div>
                  {topPerformers.length === 0 ? (
                     <div className="text-center text-muted small py-3">
                        No reviews this month yet. <span className="text-primary cursor-pointer" onClick={() => setShowReviewModal(true)}>Add a review →</span>
                     </div>
                  ) : (
                     <div className="row g-3">
                        {topPerformers.map((performer, idx) => {
                           const rankBg = idx === 0 ? 'bg-warning text-dark' : idx === 1 ? 'bg-secondary' : 'bg-dark';
                           const ratingPercent = Math.round((performer.avgRating / 5) * 100);
                           const medals = ['🥇', '🥈', '🥉'];
                           return (
                              <div key={idx} className="col-md-4">
                                 <div className="performer-card bg-light" style={{ borderLeft: `4px solid ${idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : '#78716c'}` }}>
                                    <div className="fs-4 me-2">{medals[idx]}</div>
                                    <div>
                                       <div className="fw-bold">{performer.name || 'Employee'}</div>
                                       <div className="small text-muted">{performer.designation || 'Staff'}</div>
                                    </div>
                                    <div className="ms-auto text-end">
                                       <div className="fw-bold text-success">{ratingPercent}%</div>
                                       <div className="extra-small text-muted">{performer.count} review{performer.count !== 1 ? 's' : ''}</div>
                                    </div>
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  )}
               </div>
            </div>

            {/* ── Resignation Requests Panel (HR) ── */}
            <div className="mt-4">
               <div className="dashboard-card p-0 overflow-hidden">
                  <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
                     <div className="d-flex align-items-center gap-2">
                        <h6 className="fw-bold mb-0">📋 Resignation Requests</h6>
                        {allResignations.filter(r => r.status === 'pending').length > 0 && (
                           <span
                              className="badge rounded-pill"
                              style={{ background: '#dc3545', color: '#fff', fontSize: '0.72rem', padding: '3px 9px' }}
                           >
                              {allResignations.filter(r => r.status === 'pending').length} pending
                           </span>
                        )}
                     </div>
                     <button
                        className="btn btn-sm rounded-pill px-3"
                        style={{ border: '1.5px solid #dee2e6', background: '#fff', fontSize: '0.8rem' }}
                        onClick={() => setShowHRResignPanel(v => !v)}
                     >
                        {showHRResignPanel ? <><i className="bi bi-chevron-up me-1"></i>Hide</> : <><i className="bi bi-chevron-down me-1"></i>View All</>}
                     </button>
                  </div>

                  {showHRResignPanel && (
                     allResignations.length === 0 ? (
                        <div className="p-4 text-center text-muted small">
                           <div style={{ fontSize: '2rem', opacity: 0.3 }}>📋</div>
                           <div className="mt-2">No resignation requests found.</div>
                        </div>
                     ) : (
                        <div className="table-responsive">
                           <table className="table table-hover mb-0" style={{ fontSize: '0.85rem' }}>
                              <thead className="table-light">
                                 <tr>
                                    <th className="ps-3">Employee</th>
                                    <th>Manager / TL</th>
                                    <th style={{ maxWidth: 220 }}>Reason</th>
                                    <th>Submitted</th>
                                    <th>Status</th>
                                    <th className="pe-3">Action</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {allResignations.map(r => (
                                    <tr key={r._id}>
                                       <td className="ps-3">
                                          <div className="fw-semibold">{r.employeeName}</div>
                                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>{r.employeeId}</div>
                                       </td>
                                       <td className="align-middle">{r.managerName}</td>
                                       <td className="align-middle" style={{ maxWidth: 220 }}>
                                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}
                                             title={r.resignationReason}>
                                             {r.resignationReason}
                                          </div>
                                          {r.status === 'rejected' && r.rejectionReason && (
                                             <div className="text-danger mt-1" style={{ fontSize: '0.73rem' }}>
                                                <i className="bi bi-reply me-1"></i>Rejected: {r.rejectionReason}
                                             </div>
                                          )}
                                       </td>
                                       <td className="align-middle text-muted">
                                          {new Date(r.createdAt).toLocaleDateString('en-IN')}
                                       </td>
                                       <td className="align-middle">
                                          {r.status === 'pending' && (
                                             <span className="badge rounded-pill" style={{ background: '#fff3cd', color: '#856404', border: '1px solid #ffc107', padding: '4px 10px' }}>⏳ Pending</span>
                                          )}
                                          {r.status === 'accepted' && (
                                             <span className="badge rounded-pill" style={{ background: '#d1e7dd', color: '#0a3622', border: '1px solid #198754', padding: '4px 10px' }}>✅ Accepted</span>
                                          )}
                                          {r.status === 'rejected' && (
                                             <span className="badge rounded-pill" style={{ background: '#f8d7da', color: '#842029', border: '1px solid #dc3545', padding: '4px 10px' }}>❌ Rejected</span>
                                          )}
                                       </td>
                                       <td className="align-middle pe-3">
                                          {r.status === 'pending' ? (
                                             <div className="d-flex gap-2">
                                                <button
                                                   className="btn btn-sm rounded-pill px-3 fw-semibold"
                                                   style={{ background: '#198754', color: '#fff', border: 'none', fontSize: '0.78rem' }}
                                                   disabled={resignActionLoading}
                                                   onClick={() => handleHRAccept(r._id)}
                                                >
                                                   <i className="bi bi-check-lg me-1"></i>Accept
                                                </button>
                                                <button
                                                   className="btn btn-sm rounded-pill px-3 fw-semibold"
                                                   style={{ background: '#dc3545', color: '#fff', border: 'none', fontSize: '0.78rem' }}
                                                   disabled={resignActionLoading}
                                                   onClick={() => openRejectModal(r._id)}
                                                >
                                                   <i className="bi bi-x-lg me-1"></i>Reject
                                                </button>
                                             </div>
                                          ) : (
                                             <span className="text-muted small">
                                                {r.reviewedAt ? `Reviewed ${new Date(r.reviewedAt).toLocaleDateString('en-IN')}` : '—'}
                                             </span>
                                          )}
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     )
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

               {/* ── Monthly limit warning banner ── */}
               {monthlyLimitWarning && (
                  <div className="alert alert-soft-red mb-3 py-2 small">
                     <i className="bi bi-exclamation-triangle me-2"></i>
                     {monthlyLimitWarning}
                  </div>
               )}

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

               {/* Leave Category Dropdown — Full Day only */}
               {leaveType === 'full' && (
                  <Form.Group className="mb-3">
                     <Form.Label className="small fw-semibold">Leave Category</Form.Label>
                     <Form.Select
                        value={selectedLeaveCategory}
                        onChange={(e) => setSelectedLeaveCategory(e.target.value)}
                     >
                        <option value="casual" disabled={isCasualLimitReached}>
                           Casual Leave{isCasualLimitReached ? ' (Limit reached)' : ''}
                        </option>
                        <option value="sick" disabled={isSickLimitReached}>
                           Sick Leave{isSickLimitReached ? ' (Limit reached)' : ''}
                        </option>
                        <option value="unpaid">Unpaid Leave</option>
                     </Form.Select>
                     {selectedLeaveCategory === 'casual' && isCasualLimitReached && (
                        <div className="alert alert-soft-red mt-2 py-2 small mb-0">
                           <i className="bi bi-exclamation-circle me-2"></i>
                           You have already used your Casual Leave for this month.
                        </div>
                     )}
                     {selectedLeaveCategory === 'sick' && isSickLimitReached && (
                        <div className="alert alert-soft-red mt-2 py-2 small mb-0">
                           <i className="bi bi-exclamation-circle me-2"></i>
                           You have already used your Sick Leave for this month.
                        </div>
                     )}
                  </Form.Group>
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
                  disabled={
                     (leaveType === 'short' && shortLeavesTaken >= shortLeavesLimit) ||
                     (leaveType === 'full' && selectedLeaveCategory === 'casual' && isCasualLimitReached) ||
                     (leaveType === 'full' && selectedLeaveCategory === 'sick' && isSickLimitReached)
                  }
               >
                  Submit Application
               </Button>
            </Modal.Footer>
         </Modal>

         {/* =============================== */}
         {/* CREATE PERFORMANCE REVIEW MODAL */}
         {/* =============================== */}
         <Modal show={showReviewModal} onHide={() => { setShowReviewModal(false); setReviewSuccess(false); }} centered size="lg" className="leave-modal">
            <Modal.Header closeButton className="border-0 pb-0">
               <Modal.Title className="fw-bold fs-5">
                  <i className="bi bi-star me-2 text-warning"></i>Create Performance Review
               </Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-2">
               {reviewSuccess ? (
                  <div className="text-center py-4">
                     <div style={{ fontSize: '3rem' }}>✅</div>
                     <h5 className="fw-bold mt-3">Review Submitted!</h5>
                     <p className="text-muted small">Performance review has been saved successfully.</p>
                     <Button className="btn-deep-blue rounded-pill px-4" onClick={() => { setShowReviewModal(false); setReviewSuccess(false); }}>Done</Button>
                  </div>
               ) : (
                  <>
                     <div className="row g-3">
                        <div className="col-md-6">
                           <Form.Group>
                              <Form.Label className="small fw-semibold">Employee</Form.Label>
                              <Form.Select
                                 value={reviewFormData.employee_id}
                                 onChange={(e) => setReviewFormData({ ...reviewFormData, employee_id: e.target.value })}
                              >
                                 <option value="">-- Select Employee --</option>
                                 {allEmployees.map(emp => (
                                    <option key={emp._id} value={emp.employeeId}>
                                       {emp.firstName} {emp.lastName}
                                    </option>
                                 ))}
                              </Form.Select>
                           </Form.Group>
                        </div>
                        <div className="col-md-3">
                           <Form.Group>
                              <Form.Label className="small fw-semibold">Period From</Form.Label>
                              <Form.Control
                                 type="date"
                                 value={reviewFormData.reviewPeriodStart}
                                 onChange={(e) => setReviewFormData({ ...reviewFormData, reviewPeriodStart: e.target.value })}
                              />
                           </Form.Group>
                        </div>
                        <div className="col-md-3">
                           <Form.Group>
                              <Form.Label className="small fw-semibold">Period To</Form.Label>
                              <Form.Control
                                 type="date"
                                 value={reviewFormData.reviewPeriodEnd}
                                 onChange={(e) => setReviewFormData({ ...reviewFormData, reviewPeriodEnd: e.target.value })}
                              />
                           </Form.Group>
                        </div>
                        <div className="col-12">
                           <Form.Label className="small fw-semibold d-block">Rating</Form.Label>
                           <div className="d-flex gap-2">
                              {[1, 2, 3, 4, 5].map(r => (
                                 <button
                                    key={r}
                                    type="button"
                                    onClick={() => setReviewFormData({ ...reviewFormData, rating: r })}
                                    style={{
                                       padding: '6px 14px', borderRadius: '20px', border: '1.5px solid',
                                       borderColor: reviewFormData.rating >= r ? '#f59e0b' : '#dee2e6',
                                       background: reviewFormData.rating >= r ? '#fef3c7' : 'white',
                                       color: reviewFormData.rating >= r ? '#b45309' : '#6c757d',
                                       fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
                                    }}
                                 >
                                    {'⭐'.repeat(r)} {['', 'Poor', 'Below Avg', 'Average', 'Good', 'Excellent'][r]}
                                 </button>
                              ))}
                           </div>
                        </div>
                        <div className="col-md-6">
                           <Form.Group>
                              <Form.Label className="small fw-semibold">💪 Strengths</Form.Label>
                              <Form.Control
                                 as="textarea" rows={2}
                                 placeholder="Key strengths..."
                                 value={reviewFormData.strengths}
                                 onChange={(e) => setReviewFormData({ ...reviewFormData, strengths: e.target.value })}
                              />
                           </Form.Group>
                        </div>
                        <div className="col-md-6">
                           <Form.Group>
                              <Form.Label className="small fw-semibold">📈 Areas for Improvement</Form.Label>
                              <Form.Control
                                 as="textarea" rows={2}
                                 placeholder="Areas to improve..."
                                 value={reviewFormData.areasForImprovement}
                                 onChange={(e) => setReviewFormData({ ...reviewFormData, areasForImprovement: e.target.value })}
                              />
                           </Form.Group>
                        </div>
                        <div className="col-md-6">
                           <Form.Group>
                              <Form.Label className="small fw-semibold">🎯 Goals</Form.Label>
                              <Form.Control
                                 as="textarea" rows={2}
                                 placeholder="Goals for next period..."
                                 value={reviewFormData.goals}
                                 onChange={(e) => setReviewFormData({ ...reviewFormData, goals: e.target.value })}
                              />
                           </Form.Group>
                        </div>
                        <div className="col-md-6">
                           <Form.Group>
                              <Form.Label className="small fw-semibold">💬 Comments</Form.Label>
                              <Form.Control
                                 as="textarea" rows={2}
                                 placeholder="Additional comments..."
                                 value={reviewFormData.comments}
                                 onChange={(e) => setReviewFormData({ ...reviewFormData, comments: e.target.value })}
                              />
                           </Form.Group>
                        </div>
                     </div>
                  </>
               )}
            </Modal.Body>
            {!reviewSuccess && (
               <Modal.Footer className="border-0 pt-0">
                  <Button variant="light" className="rounded-pill px-4" onClick={() => setShowReviewModal(false)}>Cancel</Button>
                  <Button
                     className="rounded-pill btn-deep-blue px-4"
                     disabled={reviewSubmitting || !reviewFormData.employee_id || !reviewFormData.reviewPeriodStart}
                     onClick={async () => {
                        setReviewSubmitting(true);
                        try {
                           const reviewPeriod = reviewFormData.reviewPeriodStart && reviewFormData.reviewPeriodEnd
                              ? `${reviewFormData.reviewPeriodStart} to ${reviewFormData.reviewPeriodEnd}`
                              : reviewFormData.reviewPeriodStart;
                           await performanceAPI.create({
                              ...reviewFormData,
                              reviewPeriod,
                              reviewer_id: user?.id,
                              rating: parseInt(reviewFormData.rating),
                           });
                           setReviewSuccess(true);
                           setReviewFormData({ employee_id: '', reviewPeriodStart: '', reviewPeriodEnd: '', rating: 3, strengths: '', areasForImprovement: '', goals: '', comments: '' });
                           // Refresh reviews data
                           const perfRes = await performanceAPI.getReviews({});
                           const allRevData = perfRes.data || [];
                           const now = new Date();
                           const curr = allRevData.filter(r => {
                              const c = new Date(r.createdAt);
                              return c.getMonth() === now.getMonth() && c.getFullYear() === now.getFullYear();
                           });
                           const empRatings = {};
                           curr.forEach(r => {
                              const id = r.employeeId;
                              if (!id) return;
                              if (!empRatings[id]) empRatings[id] = { name: r.fullName || 'Employee', designation: r.designation || 'Staff', totalRating: 0, count: 0 };
                              empRatings[id].totalRating += r.rating || 0;
                              empRatings[id].count += 1;
                           });
                           const ranked = Object.values(empRatings).map(e => ({ ...e, avgRating: e.count > 0 ? e.totalRating / e.count : 0 })).sort((a, b) => b.avgRating - a.avgRating).slice(0, 3);
                           setTopPerformers(ranked);
                           setAllReviews(allRevData);
                        } catch (err) {
                           alert(err?.response?.data?.message || 'Failed to submit review.');
                        } finally {
                           setReviewSubmitting(false);
                        }
                     }}
                  >
                     {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                  </Button>
               </Modal.Footer>
            )}
         </Modal>

         {/* ========================== */}
         {/* SUBMIT RESIGNATION MODAL   */}
         {/* ========================== */}
         <Modal show={showResignModal} onHide={() => setShowResignModal(false)} centered className="leave-modal">
            <Modal.Header closeButton className="border-0 pb-0">
               <Modal.Title className="fw-bold fs-5">
                  <i className="bi bi-box-arrow-right me-2 text-danger"></i>Submit Resignation
               </Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-2">
               <div className="alert py-2 small mb-3" style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8 }}>
                  <i className="bi bi-exclamation-triangle me-2 text-warning"></i>
                  Your resignation will be sent to HR for review. Status will show as <strong>Pending Approval</strong> until acted upon.
               </div>

               {/* Employee name — auto-filled, read-only */}
               <Form.Group className="mb-3">
                  <Form.Label className="small fw-semibold">Employee Name</Form.Label>
                  <Form.Control
                     type="text"
                     value={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
                     disabled
                     style={{ background: '#f8f9fa', color: '#495057' }}
                  />
               </Form.Group>

               {/* Manager / TL — filled by employee */}
               <Form.Group className="mb-3">
                  <Form.Label className="small fw-semibold">
                     Manager / TL Name <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                     type="text"
                     placeholder="Enter your reporting manager or TL name"
                     value={resignFormData.managerName}
                     onChange={e => setResignFormData({ ...resignFormData, managerName: e.target.value })}
                  />
               </Form.Group>

               {/* Reason */}
               <Form.Group className="mb-2">
                  <Form.Label className="small fw-semibold">
                     Reason for Resignation <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                     as="textarea"
                     rows={4}
                     placeholder="Please describe your reason for resignation..."
                     value={resignFormData.resignationReason}
                     onChange={e => setResignFormData({ ...resignFormData, resignationReason: e.target.value })}
                  />
               </Form.Group>
            </Modal.Body>
            <Modal.Footer className="border-0 pt-0 flex-column gap-2">
               <Button
                  className="w-100 rounded-pill fw-semibold"
                  style={{ background: 'linear-gradient(135deg, #dc3545, #c82333)', border: 'none', color: '#fff' }}
                  disabled={resignSubmitting || !resignFormData.managerName.trim() || !resignFormData.resignationReason.trim()}
                  onClick={handleSubmitResignation}
               >
                  {resignSubmitting
                     ? <><span className="spinner-border spinner-border-sm me-2"></span>Submitting...</>
                     : <><i className="bi bi-send me-2"></i>Submit Resignation</>}
               </Button>
               <Button variant="light" className="w-100 rounded-pill" onClick={() => setShowResignModal(false)}>
                  Cancel
               </Button>
            </Modal.Footer>
         </Modal>

         {/* ============================= */}
         {/* HR — REJECTION REASON MODAL   */}
         {/* ============================= */}
         <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered className="leave-modal">
            <Modal.Header closeButton className="border-0 pb-0">
               <Modal.Title className="fw-bold fs-5">
                  <i className="bi bi-x-circle me-2 text-danger"></i>Reject Resignation
               </Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-2">
               <div className="alert py-2 small mb-3" style={{ background: '#f8d7da', border: '1px solid #f1aeb5', borderRadius: 8 }}>
                  <i className="bi bi-info-circle me-2 text-danger"></i>
                  The employee will see this reason on their dashboard and will be allowed to re-apply.
               </div>
               <Form.Group>
                  <Form.Label className="small fw-semibold">
                     Rejection Reason <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                     as="textarea"
                     rows={4}
                     placeholder="Explain why you are rejecting this resignation request..."
                     value={rejectionReason}
                     onChange={e => setRejectionReason(e.target.value)}
                  />
               </Form.Group>
            </Modal.Body>
            <Modal.Footer className="border-0 pt-0">
               <Button variant="light" className="rounded-pill px-4" onClick={() => setShowRejectModal(false)}>
                  Cancel
               </Button>
               <Button
                  variant="danger"
                  className="rounded-pill px-4 fw-semibold"
                  disabled={resignActionLoading || !rejectionReason.trim()}
                  onClick={handleHRReject}
               >
                  {resignActionLoading
                     ? <><span className="spinner-border spinner-border-sm me-2"></span>Rejecting...</>
                     : <><i className="bi bi-x-lg me-2"></i>Confirm Reject</>}
               </Button>
            </Modal.Footer>
         </Modal>

      </div>
   );
};

export default Dashboard;