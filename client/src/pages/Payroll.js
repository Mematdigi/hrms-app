import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { payrollAPI, employeeAPI } from '../services/api';
import { Modal } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const NOW_MONTH = new Date().getMonth() + 1;
const NOW_YEAR  = new Date().getFullYear();
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const STATUS_COLOR = { draft: '#f59e0b', processed: '#3b82f6', paid: '#10b981' };
const STATUS_BG    = { draft: '#fef3c7', processed: '#dbeafe', paid: '#d1fae5' };

const REQUEST_COLOR = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };
const REQUEST_BG    = { pending: '#fef3c7', approved: '#d1fae5', rejected: '#fee2e2' };

// ─────────────────────────────────────────────────────────────────────────────
// Payslip View (printable)
// ─────────────────────────────────────────────────────────────────────────────
const PayslipView = ({ payroll, employee, breakdown, canDownload }) => {
  const printRef = useRef();

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Payslip</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; color: #222; padding: 24px; }
      .header { background: #1a237e; color: white; padding: 18px 24px; text-align: center; border-radius: 8px 8px 0 0; }
      .header h2 { font-size: 20px; letter-spacing: 1px; }
      .header p  { font-size: 13px; opacity: 0.85; margin-top: 4px; }
      .body { border: 1px solid #ddd; border-top: none; padding: 20px 24px; border-radius: 0 0 8px 8px; }
      .section-title { color: #1a237e; font-weight: 700; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; margin: 16px 0 8px; border-bottom: 2px solid #1a237e; padding-bottom: 4px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
      .info-row { display: flex; justify-content: space-between; padding: 5px 8px; font-size: 12.5px; border-bottom: 1px solid #f0f0f0; }
      .info-row:nth-child(even) { background: #fafafa; }
      .info-row .lbl { color: #666; }
      .info-row .val { font-weight: 600; }
      .salary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 32px; }
      .sal-col-title { font-weight: 700; font-size: 13px; margin-bottom: 6px; }
      .sal-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px dashed #e0e0e0; }
      .sal-total { display: flex; justify-content: space-between; padding: 8px 0 4px; font-weight: 700; font-size: 14px; border-top: 2px solid #1a237e; margin-top: 4px; }
      .ded-total { display: flex; justify-content: space-between; padding: 8px 0 4px; font-weight: 700; font-size: 14px; border-top: 2px solid #e53935; margin-top: 4px; color: #e53935; }
      .net-bar { background: #1a237e; color: white; display: flex; justify-content: space-between; padding: 14px 20px; border-radius: 6px; margin-top: 18px; font-size: 18px; font-weight: 700; }
      .att-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin: 8px 0; }
      .att-box { background: #f5f5f5; border-radius: 6px; padding: 8px; text-align: center; font-size: 12px; }
      .att-box strong { display: block; font-size: 18px; color: #1a237e; }
      .footer { text-align: center; font-size: 11px; color: #888; margin-top: 16px; font-style: italic; }
      @media print { body { padding: 0; } }
    </style></head><body>${printRef.current.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const emp = employee || {};
  const b   = breakdown || {};
  const att = b.attendance || {};
  const ded = b.deductions || {};
  const lv  = b.leaves     || {};

  // Salary component split (standard Indian payroll structure)
  const basic      = Math.round((b.baseSalary || 0) * 0.50);
  const hra        = Math.round((b.baseSalary || 0) * 0.25);
  const conveyance = Math.round((b.baseSalary || 0) * 0.05);
  const special    = Math.round((b.baseSalary || 0) * 0.08);
  const medical    = Math.round((b.baseSalary || 0) * 0.12);
  const totalGross = basic + hra + conveyance + special + medical;

  const otherDed  = ded.totalDeductions || 0;
  const totalDed  = otherDed;
  const netSalary = Math.max(totalGross - totalDed, 0);

  return (
    <div>
      {/* Download button — only shown if canDownload is explicitly true */}
      {canDownload ? (
        <button onClick={handlePrint} style={{
          background: '#1a237e', color: 'white', border: 'none',
          padding: '9px 20px', borderRadius: 7, cursor: 'pointer',
          fontSize: 14, fontWeight: 600, marginBottom: 16, float: 'right'
        }}>🖨️ Print / Download PDF</button>
      ) : (
        <div style={{
          float: 'right', marginBottom: 16, background: '#fef3c7', border: '1px solid #f59e0b',
          borderRadius: 7, padding: '8px 16px', fontSize: 13, color: '#92400e', fontWeight: 500
        }}>
          🔒 Download requires HR approval
        </div>
      )}
      <div style={{ clear: 'both' }} />

      <div ref={printRef}>
        {/* Header */}
        <div style={{ background: '#1a237e', color: 'white', padding: '18px 24px', textAlign: 'center', borderRadius: '8px 8px 0 0' }}>
          <h2 style={{ fontSize: 20, letterSpacing: 1 }}>MEMAT DIGI PVT. LTD.</h2>
          <p style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            Payslip for {MONTHS[(payroll?.month || NOW_MONTH) - 1]} {payroll?.year || NOW_YEAR}
          </p>
        </div>

        <div style={{ border: '1px solid #ddd', borderTop: 'none', padding: '20px 24px', borderRadius: '0 0 8px 8px' }}>

          {/* Employee Details */}
          <div style={{ color: '#1a237e', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px', borderBottom: '2px solid #1a237e', paddingBottom: 4 }}>Employee Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {[
              ['Employee Name',     `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A'],
              ['Employee ID',       emp.employeeId ? `EMP${emp.employeeId}` : 'N/A'],
              ['Designation',       emp.designation || 'N/A'],
              ['Department',        emp.department  || 'N/A'],
              ['Date of Joining',   emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString('en-IN') : 'N/A'],
              ['Email',             emp.email        || 'N/A'],
              ['Mobile',            emp.contact|| 'N/A'],
              ['PAN Number',        emp.panCard || emp.pan  || 'N/A'],
              ['Bank Name',         emp.bankName        || 'N/A'],
              ['Account Number',    emp.bankAccountNumber || emp.accountNumber || 'N/A'],
              ['IFSC Code',         emp.ifscCode        || emp.bankIfsc || 'N/A'],
               ['Total Working Days', b.workingDays  || 0],
              ['Days Attended',     att.presentDays || 0],
              ['Leaves Taken',      (lv.casualLeavesTaken || 0) + (lv.sickLeavesTaken || 0) + (lv.earnedLeavesTaken || 0)],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: 12.5, borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ color: '#666' }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Salary Breakdown */}
          <div style={{ color: '#1a237e', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '16px 0 8px', borderBottom: '2px solid #1a237e', paddingBottom: 4 }}>Salary Breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
            {/* Income */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>INCOME</div>
              {[
                ['Basic Salary',       basic],
                ['HRA',                hra],
                ['Conveyance Allow.',  conveyance],
                ['Special Allowance',  special],
                ['Medical Allowance',  medical],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px dashed #e0e0e0' }}>
                  <span>{l}</span><span>{fmt(v)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', fontWeight: 700, fontSize: 14, borderTop: '2px solid #1a237e', marginTop: 4 }}>
                <span>Total Income</span><span>{fmt(totalGross)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#e53935' }}>DEDUCTIONS</div>
              {[
                ['PF (12% of Basic)',    'N/A'],
                ['Professional Tax',     'N/A'],
                ['TDS',                  'N/A'],
                ['Absent Deduction',     fmt(totalDed) || 'N/A'],
              ].filter(([, v]) => v).map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: 12.5, borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#666' }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', fontWeight: 700, fontSize: 14, borderTop: '2px solid #e53935', marginTop: 4, color: '#e53935' }}>
                <span>Total Deductions</span><span>{fmt(totalDed)}</span>
              </div>
            </div>
          </div>

          {/* Net Salary */}
          <div style={{ background: '#1a237e', color: 'white', display: 'flex', justifyContent: 'space-between', padding: '14px 20px', borderRadius: 6, marginTop: 18, fontSize: 18, fontWeight: 700 }}>
            <span>Net Salary</span>
            <span>{fmt(netSalary)}</span>
          </div>

          <div style={{ textAlign: 'center', fontSize: 11, color: '#888', marginTop: 16, fontStyle: 'italic' }}>
            This is a system-generated salary slip and does not require a signature.
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Payroll Component
// ─────────────────────────────────────────────────────────────────────────────
function Payroll() {
  const { user } = useSelector((state) => state.auth);
  const isHR = user?.role === 'admin' || user?.role === 'hr';

  const [payrolls,       setPayrolls]       = useState([]);
  const [employees,      setEmployees]      = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [generating,     setGenerating]     = useState(false);
  const [genAllLoading,  setGenAllLoading]  = useState(false);
  const [successMsg,     setSuccessMsg]     = useState('');
  const [errorMsg,       setErrorMsg]       = useState('');
  const [selectedMonth,  setSelectedMonth]  = useState(NOW_MONTH);
  const [selectedYear,   setSelectedYear]   = useState(NOW_YEAR);
  const [searchQuery,    setSearchQuery]    = useState('');

  // Generate single modal
  const [showGenModal,   setShowGenModal]   = useState(false);
  const [genEmployee,    setGenEmployee]    = useState('');

  // Payslip modal
  const [showPayslip,    setShowPayslip]    = useState(false);
  const [payslipData,    setPayslipData]    = useState({ payroll: null, employee: null, breakdown: null });
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [canDownload,    setCanDownload]    = useState(false);

  // ── Download Request: Employee ─────────────────────────────────────────────
  const [showRequestModal,  setShowRequestModal]  = useState(false);
  const [requestPayrollId,  setRequestPayrollId]  = useState('');
  const [requestReason,     setRequestReason]     = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [myRequests,        setMyRequests]        = useState([]); // { payrollId → request }

  // ── Download Request: HR ───────────────────────────────────────────────────
  const [showHRRequestsModal, setShowHRRequestsModal] = useState(false);
  const [hrRequests,           setHRRequests]          = useState([]);
  const [hrRequestsLoading,    setHRRequestsLoading]   = useState(false);
  const [rejectModal,          setRejectModal]         = useState({ open: false, requestId: '', reason: '' });
  const [reviewSubmitting,     setReviewSubmitting]    = useState(false);

  useEffect(() => {
    fetchPayrolls();
    if (isHR) fetchEmployees();
    // eslint-disable-next-line
  }, [selectedMonth, selectedYear]);

  // Fetch employee's own download requests whenever payrolls load
  useEffect(() => {
    if (!isHR) fetchMyDownloadRequests();
    // eslint-disable-next-line
  }, [payrolls]);

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };
  const showError   = (msg) => { setErrorMsg(msg);   setTimeout(() => setErrorMsg(''),   5000); };

  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      const params = { month: selectedMonth, year: selectedYear };
      if (!isHR) params.employeeId = user?.id;
      const res = await payrollAPI.getPayroll(params);
      setPayrolls(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      showError(e?.response?.data?.message || 'Failed to fetch payroll records');
    } finally { setLoading(false); }
  };

  const fetchEmployees = async () => {
    try {
      const res = await employeeAPI.getAll();
      setEmployees(res.data || []);
    } catch (e) { console.error('Failed to fetch employees:', e); }
  };

  // Build a map: payrollId → request (latest) for the employee
  const fetchMyDownloadRequests = async () => {
    try {
      const res = await payrollAPI.getMyDownloadRequests();
      const map = {};
      (res.data?.requests || []).forEach(r => {
        const pid = r.payroll?._id || r.payroll;
        // Keep only most recent per payroll
        if (!map[pid] || new Date(r.createdAt) > new Date(map[pid].createdAt)) {
          map[pid] = r;
        }
      });
      setMyRequests(map);
    } catch (e) { /* silent */ }
  };

  // Helper: safely call getById (not all API configs expose it)
  if (!employeeAPI.getById) {
    employeeAPI.getById = async (id) => {
      const res = await employeeAPI.getAll();
      const found = (res.data || []).find(e => e._id === id || e.id === id);
      if (found) return { data: found };
      throw new Error('Employee not found');
    };
  }

  // ── Generate single employee payroll ──────────────────────────────────────
  const handleGenerateSingle = async () => {
    if (!genEmployee) return showError('Please select an employee');
    setGenerating(true);
    try {
      await payrollAPI.generate({ employee: genEmployee, month: selectedMonth, year: selectedYear });
      showSuccess('✅ Payroll generated successfully from attendance & leave data');
      setShowGenModal(false);
      setGenEmployee('');
      fetchPayrolls();
    } catch (e) {
      showError(e?.response?.data?.message || 'Failed to generate payroll');
    } finally { setGenerating(false); }
  };

  // ── Generate ALL employees payroll ────────────────────────────────────────
  const handleGenerateAll = async () => {
    if (!window.confirm(`Auto-generate payroll for ALL active employees for ${MONTHS[selectedMonth - 1]} ${selectedYear}?\n\nThis will read attendance & leave data from the database automatically.`)) return;
    setGenAllLoading(true);
    try {
      const res = await payrollAPI.generateAll({ month: selectedMonth, year: selectedYear });
      const d = res.data;
      showSuccess(`✅ Generated: ${d.generated} employees. ${d.failed > 0 ? `⚠️ Failed: ${d.failed}` : ''}`);
      fetchPayrolls();
    } catch (e) {
      showError(e?.response?.data?.message || 'Failed to generate payrolls');
    } finally { setGenAllLoading(false); }
  };

  // ── View payslip — fetch live breakdown + check download permission ────────
  const handleViewPayslip = async (payroll) => {
    setShowPayslip(true);
    setPayslipLoading(true);
    setCanDownload(false);
    setPayslipData({ payroll, employee: payroll.employee, breakdown: null });
    try {
      const employeeId = payroll.employee?._id || payroll.employee;
      const promises = [
        payrollAPI.getBreakdown(payroll._id),
        employeeAPI.getById(employeeId).catch(() => null),
      ];
      // Employees also check their download permission
      if (!isHR) {
        promises.push(payrollAPI.checkDownloadPermission(payroll._id).catch(() => null));
      }

      const [breakdownRes, employeeRes, permRes] = await Promise.all(promises);

      setPayslipData({
        payroll:   breakdownRes.data?.payroll  || payroll,
        employee:  employeeRes?.data           || payroll.employee,
        breakdown: breakdownRes.data?.breakdown || null,
      });

      // HR can always download; employees need approved request
      setCanDownload(isHR || permRes?.data?.canDownload === true);
    } catch (e) {
      console.error('Error loading payslip:', e);
    } finally {
      setPayslipLoading(false);
    }
  };

  const handleProcess = async (payrollId) => {
    try {
      await payrollAPI.process({ payrollId });
      showSuccess('✅ Payroll marked as processed');
      fetchPayrolls();
    } catch (e) {
      showError(e?.response?.data?.message || 'Failed to process payroll');
    }
  };

  const handlePay = async (payrollId) => {
    try {
      await payrollAPI.pay({ payrollId });
      showSuccess('✅ Payroll marked as paid');
      fetchPayrolls();
    } catch (e) {
      showError(e?.response?.data?.message || 'Failed to mark as paid');
    }
  };

  // ── EMPLOYEE: Open request download modal ─────────────────────────────────
  const handleOpenRequestModal = (payrollId) => {
    setRequestPayrollId(payrollId);
    setRequestReason('');
    setShowRequestModal(true);
  };

  const handleSubmitDownloadRequest = async () => {
    if (!requestReason.trim()) return showError('Please provide a reason for the download request');
    setRequestSubmitting(true);
    try {
      await payrollAPI.requestDownload({ payrollId: requestPayrollId, reason: requestReason });
      showSuccess('✅ Download request submitted. HR will review shortly.');
      setShowRequestModal(false);
      fetchMyDownloadRequests();
    } catch (e) {
      showError(e?.response?.data?.message || 'Failed to submit request');
    } finally { setRequestSubmitting(false); }
  };

  // ── HR: Open pending requests panel ───────────────────────────────────────
  const handleOpenHRRequests = async () => {
    setShowHRRequestsModal(true);
    setHRRequestsLoading(true);
    try {
      const res = await payrollAPI.getPendingDownloadRequests({ status: 'all' });
      setHRRequests(res.data?.requests || []);
    } catch (e) {
      showError('Failed to load download requests');
    } finally { setHRRequestsLoading(false); }
  };

  const handleApproveRequest = async (requestId) => {
    setReviewSubmitting(true);
    try {
      await payrollAPI.approveDownloadRequest({ requestId });
      showSuccess('✅ Download request approved');
      setHRRequests(prev => prev.map(r => r._id === requestId ? { ...r, status: 'approved' } : r));
    } catch (e) {
      showError(e?.response?.data?.message || 'Failed to approve request');
    } finally { setReviewSubmitting(false); }
  };

  const handleOpenRejectModal = (requestId) => {
    setRejectModal({ open: true, requestId, reason: '' });
  };

  const handleRejectRequest = async () => {
    if (!rejectModal.reason.trim()) return showError('Please provide a rejection reason');
    setReviewSubmitting(true);
    try {
      await payrollAPI.rejectDownloadRequest({ requestId: rejectModal.requestId, hrResponse: rejectModal.reason });
      showSuccess('Request rejected');
      setHRRequests(prev => prev.map(r => r._id === rejectModal.requestId ? { ...r, status: 'rejected', hrResponse: rejectModal.reason } : r));
      setRejectModal({ open: false, requestId: '', reason: '' });
    } catch (e) {
      showError(e?.response?.data?.message || 'Failed to reject request');
    } finally { setReviewSubmitting(false); }
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const myPayroll = !isHR && payrolls.length > 0 ? payrolls[0] : null;

  const filtered = isHR ? payrolls.filter(p => {
    if (!searchQuery) return true;
    const emp = p.employee || {};
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase()) ||
      (emp.employeeId || '').toString().includes(searchQuery) ||
      (emp.department || '').toLowerCase().includes(searchQuery.toLowerCase());
  }) : [];

  const stats = isHR ? {
    total:       payrolls.length,
    draft:       payrolls.filter(p => p.status === 'draft').length,
    processed:   payrolls.filter(p => p.status === 'processed').length,
    paid:        payrolls.filter(p => p.status === 'paid').length,
    totalPayout: payrolls.reduce((s, p) => s + (p.netSalary || 0), 0)
  } : null;

  const pendingHRRequestCount = isHR ? 0 : 0; // loaded lazily

  // Helper: get download request for a payroll (employee view)
  const getRequestForPayroll = (payrollId) => myRequests[payrollId];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Alerts ── */}
      {successMsg && (
        <div style={alertStyle('#d1fae5', '#065f46', '#a7f3d0')}>✅ {successMsg}</div>
      )}
      {errorMsg && (
        <div style={alertStyle('#fee2e2', '#dc2626', '#fca5a5')}>❌ {errorMsg}</div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a237e' }}>
            {isHR ? '💰 Payroll Management' : '📄 My Payslip'}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            {isHR
              ? 'Auto-calculated from attendance, leaves & salary data'
              : 'View and download your salary slip'}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Month / Year selectors */}
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={selectStyle}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={selectStyle}>
            {[NOW_YEAR - 2, NOW_YEAR - 1, NOW_YEAR, NOW_YEAR + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {isHR && (
            <>
              <button onClick={() => setShowGenModal(true)} style={btnStyle('#1a237e')}>
                ⚡ Generate Single
              </button>
              <button onClick={handleGenerateAll} disabled={genAllLoading} style={btnStyle('#059669')}>
                {genAllLoading ? '⏳ Generating...' : '🚀 Generate All Employees'}
              </button>
              <button onClick={handleOpenHRRequests} style={btnStyle('#7c3aed')}>
                📥 Download Requests
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── HR: Stats ── */}
      {/* {isHR && stats && (
        // <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
        //   {[
        //     { label: 'Total Records', value: stats.total,            color: '#6366f1', icon: '📋' },
        //     { label: 'Draft',         value: stats.draft,            color: '#f59e0b', icon: '📝' },
        //     { label: 'Processed',     value: stats.processed,        color: '#3b82f6', icon: '⚙️' },
        //     { label: 'Paid',          value: stats.paid,             color: '#10b981', icon: '✅' },
        //     { label: 'Total Payout',  value: fmt(stats.totalPayout), color: '#1a237e', icon: '💸' },
        //   ].map(s => (
        //     <div key={s.label} style={{ background: 'white', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${s.color}` }}>
        //       <div style={{ fontSize: 20 }}>{s.icon}</div>
        //       <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
        //       <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
        //     </div>
        //   ))}
        // </div>
      )} */}

      {/* ── HR: Info banner ── */}
      {/* {isHR && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 18px', marginBottom: 20, fontSize: 13, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>ℹ️</span>
          <span>
            Payroll is <strong>fully automatic</strong> — calculated from each employee's attendance records, approved leaves, and base salary from the database.
            Click <strong>"Generate All Employees"</strong> to process the selected month in one click.
            Use <strong>"Download Requests"</strong> to manage employee payslip download permissions.
          </span>
        </div>
      )} */}

      {/* ── EMPLOYEE: My Payslip Card ── */}
      {!isHR && (
        <>
          {loading ? (
            <div style={loadingStyle}>Loading your payslip...</div>
          ) : myPayroll ? (
            <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 2px 16px rgba(26,35,126,0.1)', overflow: 'hidden'}}>
              {/* Card header */}
              <div style={{ background: '#1a237e', color: 'white', padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, letterSpacing: 0.5 }}>MEMAT DIGI PVT. LTD.</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.8 }}>
                      Payslip — {MONTHS[myPayroll.month - 1]} {myPayroll.year}
                    </p>
                  </div>
                  <span style={{ background: STATUS_BG[myPayroll.status], color: STATUS_COLOR[myPayroll.status], padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>
                    {myPayroll.status}
                  </span>
                </div>
              </div>

              <div style={{ padding: '20px 24px' }}>
                {/* Employee info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#e8eaf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#1a237e' }}>
                    {(myPayroll.employee?.firstName || user?.firstName || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#1a237e' }}>
                      {myPayroll.employee?.firstName || user?.firstName} {myPayroll.employee?.lastName || user?.lastName}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      {myPayroll.employee?.designation || 'Employee'} • {myPayroll.employee?.department || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Salary figures */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Base Salary', value: fmt(myPayroll.baseSalary), color: '#1a237e' },
                    { label: 'Deductions',  value: fmt(myPayroll.deductions),  color: '#dc2626' },
                    { label: 'Net Salary',  value: fmt(myPayroll.netSalary),   color: '#059669' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Days info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: 20 }}>
                  {[
                    ['Working Days', myPayroll.workingDays],
                    ['Worked Days',  myPayroll.workedDays],
                    ['Month',        MONTHS[myPayroll.month - 1]],
                    ['Year',         myPayroll.year],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                      <span style={{ color: '#6b7280' }}>{l}</span>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* ── Download request section ── */}
                {(() => {
                  const req = getRequestForPayroll(myPayroll._id);
                  if (req?.status === 'approved') {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#065f46' }}>
                          ✅ Download approved by HR
                        </div>
                        <button onClick={() => handleViewPayslip(myPayroll)} style={{ ...btnStyle('#1a237e'), width: '100%', justifyContent: 'center', padding: '12px' }}>
                          📄 View & Download Full Payslip
                        </button>
                      </div>
                    );
                  }
                  if (req?.status === 'pending') {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e' }}>
                          ⏳ Download request pending HR approval
                        </div>
                        <button onClick={() => handleViewPayslip(myPayroll)} style={{ ...btnStyle('#6b7280'), width: '100%', justifyContent: 'center', padding: '12px' }}>
                          👁 View Payslip (download locked)
                        </button>
                      </div>
                    );
                  }
                  if (req?.status === 'rejected') {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>
                          ❌ Request rejected — {req.hrResponse || 'No reason provided'}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleViewPayslip(myPayroll)} style={{ ...btnStyle('#6b7280'), flex: 1, justifyContent: 'center', padding: '10px' }}>
                            👁 View (no download)
                          </button>
                          <button onClick={() => handleOpenRequestModal(myPayroll._id)} style={{ ...btnStyle('#1a237e'), flex: 1, justifyContent: 'center', padding: '10px' }}>
                            🔁 Re-request Download
                          </button>
                        </div>
                      </div>
                    );
                  }
                  // No request yet
                  return (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleViewPayslip(myPayroll)} style={{ ...btnStyle('#6b7280'), flex: 1, justifyContent: 'center', padding: '12px' }}>
                        👁 View Payslip
                      </button>
                      <button onClick={() => handleOpenRequestModal(myPayroll._id)} style={{ ...btnStyle('#1a237e'), flex: 1, justifyContent: 'center', padding: '12px' }}>
                        📥 Request Download
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div style={cardStyle({ textAlign: 'center', padding: '56px 24px' })}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#374151' }}>No Payslip Found</div>
              <div style={{ color: '#9ca3af', marginTop: 8 }}>
                No payroll record for {MONTHS[selectedMonth - 1]} {selectedYear}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── HR: Payroll Table ── */}
      {isHR && (
        <div style={cardStyle({ padding: 0, overflow: 'hidden' })}>
          {/* Search */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0' }}>
            <input
              placeholder="🔍 Search by name, employee ID, or department…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ ...selectStyle, width: '100%', maxWidth: 400 }}
            />
          </div>

          {loading ? (
            <div style={loadingStyle}>Loading payroll records...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    {['Employee', 'Department', 'Month / Year', 'Working Days', 'Worked Days', 'Base Salary', 'Deductions', 'Net Salary', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '13px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontSize: 13 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                        No payroll records for {MONTHS[selectedMonth - 1]} {selectedYear}.
                        <br />
                        <span style={{ fontSize: 13, color: '#6b7280' }}>Click "Generate All Employees" to create payrolls automatically.</span>
                      </td>
                    </tr>
                  ) : filtered.map((p, i) => {
                    const emp = p.employee || {};
                    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A';
                    return (
                      <tr key={p._id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e8eaf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#1a237e', fontSize: 14, flexShrink: 0 }}>
                              {name[0]?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{name}</div>
                              <div style={{ fontSize: 12, color: '#9ca3af' }}>{emp.employeeId ? `EMP${emp.employeeId}` : emp.email || ''}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 13 }}>{emp.department || 'N/A'}</td>
                        <td style={{ padding: '12px 16px', color: '#374151', fontWeight: 500 }}>{MONTHS[p.month - 1]} {p.year}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{p.workingDays}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{p.workedDays}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{fmt(p.baseSalary)}</td>
                        <td style={{ padding: '12px 16px', color: '#dc2626', fontWeight: 600 }}>{fmt(p.deductions)}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#059669' }}>{fmt(p.netSalary)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: STATUS_BG[p.status],
                            color: STATUS_COLOR[p.status],
                            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
                            border: `1px solid ${STATUS_COLOR[p.status]}44`
                          }}>
                            {p.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => handleViewPayslip(p)} style={actionBtn('#e8eaf6', '#1a237e')}>
                              👁 View
                            </button>
                            {p.status === 'draft' && (
                              <button onClick={() => handleProcess(p._id)} style={actionBtn('#dbeafe', '#1d4ed8')}>
                                ⚙️ Process
                              </button>
                            )}
                            {p.status === 'processed' && (
                              <button onClick={() => handlePay(p._id)} style={actionBtn('#d1fae5', '#065f46')}>
                                ✅ Pay
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════════════════════ */}

      {/* ── Generate Single Modal ── */}
      <Modal show={showGenModal} onHide={() => setShowGenModal(false)} centered>
        <Modal.Header closeButton style={{ background: '#1a237e', color: 'white' }}>
          <Modal.Title style={{ fontSize: 16 }}>⚡ Generate Payroll</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 24 }}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            Select an employee. Payroll will be <strong>automatically calculated</strong> from their attendance records, approved leaves, and base salary — no manual entry needed.
          </p>
          <label style={labelStyle}>Period</label>
          <div style={{ background: '#f3f4f6', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600, color: '#1a237e' }}>
            {MONTHS[selectedMonth - 1]} {selectedYear}
          </div>
          <label style={labelStyle}>Employee *</label>
          <select value={genEmployee} onChange={e => setGenEmployee(e.target.value)} style={{ ...selectStyle, width: '100%', marginBottom: 8 }}>
            <option value="">-- Select Employee --</option>
            {employees.map(e => (
              <option key={e._id} value={e._id}>
                {e.firstName} {e.lastName}
                {e.employeeId ? ` (EMP${e.employeeId})` : ''}
                {e.department ? ` — ${e.department}` : ''}
                {e.baseSalary ? ` | ${fmt(e.baseSalary)}/mo` : ' | ⚠️ No salary set'}
              </option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: '#9ca3af' }}>
            ℹ️ Attendance, leaves & working days are read automatically from the database.
          </p>
        </Modal.Body>
        <Modal.Footer style={{ padding: '12px 24px' }}>
          <button onClick={() => setShowGenModal(false)} style={actionBtn('#f3f4f6', '#374151')}>Cancel</button>
          <button onClick={handleGenerateSingle} disabled={generating || !genEmployee} style={btnStyle('#1a237e')}>
            {generating ? '⏳ Generating...' : '⚡ Generate'}
          </button>
        </Modal.Footer>
      </Modal>

      {/* ── Payslip View Modal ── */}
      <Modal show={showPayslip} onHide={() => setShowPayslip(false)} size="xl" centered>
        <Modal.Header closeButton style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
          <Modal.Title style={{ fontSize: 16, color: '#1a237e' }}>
            📄 Payslip
            {payslipData.employee && ` — ${payslipData.employee.firstName} ${payslipData.employee.lastName}`}
            {payslipData.payroll && (
              <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 400, marginLeft: 8 }}>
                {MONTHS[(payslipData.payroll.month || NOW_MONTH) - 1]} {payslipData.payroll.year}
              </span>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 24 }}>
          {payslipLoading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
              Loading payslip data...
            </div>
          ) : (
            <PayslipView
              payroll={payslipData.payroll}
              employee={payslipData.employee}
              breakdown={payslipData.breakdown}
              canDownload={canDownload}
            />
          )}
        </Modal.Body>
      </Modal>

      {/* ── Employee: Request Download Modal ── */}
      <Modal show={showRequestModal} onHide={() => setShowRequestModal(false)} centered>
        <Modal.Header closeButton style={{ background: '#1a237e', color: 'white' }}>
          <Modal.Title style={{ fontSize: 16 }}>📥 Request Payslip Download</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 24 }}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            To download your payslip, please submit a request with a reason. HR will review and approve it.
          </p>
          <label style={labelStyle}>Reason for Download *</label>
          <textarea
            rows={4}
            placeholder="e.g. Required for bank loan application, visa documentation, income proof for rental agreement…"
            value={requestReason}
            onChange={e => setRequestReason(e.target.value)}
            style={{ ...selectStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          />
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
            Your request will be reviewed by HR and you'll be notified of the decision.
          </p>
        </Modal.Body>
        <Modal.Footer style={{ padding: '12px 24px' }}>
          <button onClick={() => setShowRequestModal(false)} style={actionBtn('#f3f4f6', '#374151')}>Cancel</button>
          <button onClick={handleSubmitDownloadRequest} disabled={requestSubmitting || !requestReason.trim()} style={btnStyle('#1a237e')}>
            {requestSubmitting ? '⏳ Submitting...' : '📤 Submit Request'}
          </button>
        </Modal.Footer>
      </Modal>

      {/* ── HR: Download Requests Panel Modal ── */}
      <Modal show={showHRRequestsModal} onHide={() => setShowHRRequestsModal(false)} size="xl" centered>
        <Modal.Header closeButton style={{ background: '#7c3aed', color: 'white' }}>
          <Modal.Title style={{ fontSize: 16 }}>📥 Payslip Download Requests</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0, maxHeight: '75vh', overflowY: 'auto' }}>
          {hrRequestsLoading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>⏳ Loading requests...</div>
          ) : hrRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
              No download requests found
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr style={{ background: '#f3f0ff' }}>
                  {['Employee', 'Payroll Period', 'Reason', 'Status', 'HR Note', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#5b21b6', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hrRequests.map((r, i) => {
                  const emp = r.employee || {};
                  const pr  = r.payroll  || {};
                  return (
                    <tr key={r._id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{emp.firstName} {emp.lastName}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{emp.employeeId ? `EMP${emp.employeeId}` : emp.email}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{emp.department}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                        {pr.month ? `${MONTHS[pr.month - 1]} ${pr.year}` : 'N/A'}
                        <div style={{ fontSize: 11, color: '#10b981' }}>{pr.netSalary ? fmt(pr.netSalary) : ''}</div>
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: 220, color: '#374151' }}>
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.reason}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: REQUEST_BG[r.status],
                          color: REQUEST_COLOR[r.status],
                          padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
                          border: `1px solid ${REQUEST_COLOR[r.status]}44`
                        }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 12, maxWidth: 180 }}>
                        {r.hrResponse || '—'}
                        {r.reviewedBy && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                            by {r.reviewedBy.firstName} {r.reviewedBy.lastName}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {r.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => handleApproveRequest(r._id)}
                              disabled={reviewSubmitting}
                              style={actionBtn('#d1fae5', '#065f46')}
                            >
                              ✅ Approve
                            </button>
                            <button
                              onClick={() => handleOpenRejectModal(r._id)}
                              disabled={reviewSubmitting}
                              style={actionBtn('#fee2e2', '#dc2626')}
                            >
                              ❌ Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>Reviewed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Modal.Body>
        <Modal.Footer style={{ padding: '10px 20px' }}>
          <button onClick={() => setShowHRRequestsModal(false)} style={actionBtn('#f3f4f6', '#374151')}>Close</button>
        </Modal.Footer>
      </Modal>

      {/* ── HR: Reject Reason Modal ── */}
      <Modal show={rejectModal.open} onHide={() => setRejectModal({ open: false, requestId: '', reason: '' })} centered>
        <Modal.Header closeButton style={{ background: '#dc2626', color: 'white' }}>
          <Modal.Title style={{ fontSize: 16 }}>❌ Reject Download Request</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 24 }}>
          <label style={labelStyle}>Rejection Reason *</label>
          <textarea
            rows={3}
            placeholder="e.g. Payroll is still being processed, please request again after approval."
            value={rejectModal.reason}
            onChange={e => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
            style={{ ...selectStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Modal.Body>
        <Modal.Footer style={{ padding: '12px 24px' }}>
          <button onClick={() => setRejectModal({ open: false, requestId: '', reason: '' })} style={actionBtn('#f3f4f6', '#374151')}>Cancel</button>
          <button onClick={handleRejectRequest} disabled={reviewSubmitting || !rejectModal.reason.trim()} style={btnStyle('#dc2626')}>
            {reviewSubmitting ? '⏳...' : '❌ Reject'}
          </button>
        </Modal.Footer>
      </Modal>

    </div>
  );
}

// ─── Style helpers ─────────────────────────────────────────────────────────────
const cardStyle = (extra = {}) => ({
  background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '16px 20px', ...extra
});
const alertStyle = (bg, color, border) => ({
  background: bg, color, padding: '12px 16px', borderRadius: 8,
  marginBottom: 16, border: `1px solid ${border}`, fontSize: 14
});
const btnStyle = (bg) => ({
  background: bg, color: 'white', border: 'none',
  padding: '9px 18px', borderRadius: 8, cursor: 'pointer',
  fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6
});
const actionBtn = (bg, color) => ({
  background: bg, color, border: 'none',
  padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
  fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
});
const selectStyle = {
  border: '1px solid #d1d5db', borderRadius: 8,
  padding: '8px 12px', fontSize: 14, cursor: 'pointer', outline: 'none', background: 'white'
};
const labelStyle = {
  display: 'block', marginBottom: 5, fontSize: 13, fontWeight: 600, color: '#374151'
};
const loadingStyle = { padding: 48, textAlign: 'center', color: '#6b7280', fontSize: 15 };

export default Payroll;