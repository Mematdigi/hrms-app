import React, { useEffect, useState, useRef } from 'react';
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

// ─────────────────────────────────────────────────────────────────────────────
// Payslip View (printable)
// ─────────────────────────────────────────────────────────────────────────────
const PayslipView = ({ payroll, employee, breakdown }) => {
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
  const hra        = Math.round((b.baseSalary || 0) * 0.20);
  const conveyance = Math.round((b.baseSalary || 0) * 0.05);
  const special    = Math.round((b.baseSalary || 0) * 0.15);
  const medical    = Math.round((b.baseSalary || 0) * 0.10);
  const totalGross = basic + hra + conveyance + special + medical;

  // Statutory deductions
  const pf  = Math.round(basic * 0.12);
  const pt  = 200;
  const tds = Math.round(totalGross * 0.10);
  const otherDed = ded.totalDeductions || 0;
  const totalDed = pf + pt + tds + otherDed;
  const netSalary = Math.max(totalGross - totalDed, 0);

  return (
    <div>
      <button onClick={handlePrint} style={{
        background: '#1a237e', color: 'white', border: 'none',
        padding: '9px 20px', borderRadius: 7, cursor: 'pointer',
        fontSize: 14, fontWeight: 600, marginBottom: 16, float: 'right'
      }}>🖨️ Print / Download PDF</button>
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
              ['PAN Number',        emp.panCard     || 'N/A'],
              ['Bank Account',      emp.bankAccountNumber || 'N/A'],
              ['Bank Name',         emp.bankName    || 'N/A'],
              ['Total Working Days', b.workingDays  || 0],
              ['Days Attended',     att.presentDays || 0],
              // ['Paid Leaves',       att.paidLeaveDays || 0],
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
                ['PF (12% of Basic)',    pf],
                ['Professional Tax',     pt],
                ['TDS',                  tds],
                ['Absent Deduction',     ded.absentDeduction       || 0],
                ['Unpaid Leave Dedn.',   ded.unpaidLeaveDeduction  || 0],
                ['Half Day Deduction',   ded.halfDayDeduction      || 0],
                ['Late Deduction',       ded.lateDeduction         || 0],
              ].filter(([, v]) => v > 0).map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px dashed #e0e0e0' }}>
                  <span>{l}</span><span>{fmt(v)}</span>
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

  useEffect(() => {
    fetchPayrolls();
    if (isHR) fetchEmployees();
    // eslint-disable-next-line
  }, [selectedMonth, selectedYear]);

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

  // ── View payslip — fetch live breakdown from server ───────────────────────
  const handleViewPayslip = async (payroll) => {
    setShowPayslip(true);
    setPayslipLoading(true);
    setPayslipData({ payroll, employee: payroll.employee, breakdown: null });
    try {
      const res = await payrollAPI.getBreakdown(payroll._id);
      setPayslipData({
        payroll:   res.data.payroll,
        employee:  res.data.employee,
        breakdown: res.data.breakdown
      });
    } catch (e) {
      // fallback to stored data if breakdown fails
      console.error('Breakdown fetch failed:', e);
    } finally { setPayslipLoading(false); }
  };

  // ── Status transitions ────────────────────────────────────────────────────
  const handleProcess = async (payrollId) => {
    try {
      await payrollAPI.process({ payrollId });
      showSuccess('✅ Payroll status → Processed');
      fetchPayrolls();
    } catch (e) { showError(e?.response?.data?.message || 'Failed'); }
  };

  const handlePay = async (payrollId) => {
    if (!window.confirm('Mark this payroll as PAID?')) return;
    try {
      await payrollAPI.pay({ payrollId });
      showSuccess('✅ Payroll marked as Paid');
      fetchPayrolls();
    } catch (e) { showError(e?.response?.data?.message || 'Failed'); }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = payrolls.filter(p => {
    const name = `${p.employee?.firstName || ''} ${p.employee?.lastName || ''}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  // ── HR stats ─────────────────────────────────────────────────────────────
  const stats = {
    total:       payrolls.length,
    draft:       payrolls.filter(p => p.status === 'draft').length,
    processed:   payrolls.filter(p => p.status === 'processed').length,
    paid:        payrolls.filter(p => p.status === 'paid').length,
    totalPayout: payrolls.filter(p => p.status === 'paid').reduce((s, p) => s + (p.netSalary || 0), 0),
  };

  // ── Employee: own payroll ─────────────────────────────────────────────────
  const myPayroll = !isHR && payrolls[0];

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1a237e' }}>
            {isHR ? '💰 Payroll Management' : '📄 My Payslip'}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            {isHR
              ? 'Payroll is auto-calculated from attendance & leave records'
              : 'View and download your monthly salary slips'}
          </p>
        </div>

        {isHR && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setShowGenModal(true)} style={btnStyle('#1a237e')}>
              ⚡ Generate Single
            </button>
            <button onClick={handleGenerateAll} disabled={genAllLoading} style={btnStyle('#065f46')}>
              {genAllLoading ? '⏳ Generating...' : '🚀 Generate All Employees'}
            </button>
          </div>
        )}
      </div>

      {/* ── Alerts ── */}
      {successMsg && (
        <div style={alertStyle('#d1fae5', '#065f46', '#6ee7b7')}>✅ {successMsg}</div>
      )}
      {errorMsg && (
        <div style={{ ...alertStyle('#fee2e2', '#991b1b', '#fca5a5'), display: 'flex', justifyContent: 'space-between' }}>
          <span>❌ {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* ── Month / Year Selector ── */}
      <div style={cardStyle({ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' })}>
        <span style={{ fontSize: 14, color: '#555', fontWeight: 600 }}>📅 Period:</span>
        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={selectStyle}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={selectStyle}>
          {[NOW_YEAR - 2, NOW_YEAR - 1, NOW_YEAR, NOW_YEAR + 1].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {isHR && (
          <input
            placeholder="🔍 Search employee..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ marginLeft: 'auto', ...selectStyle, width: 240 }}
          />
        )}
        <button onClick={fetchPayrolls} style={{ ...btnStyle('#4f46e5'), padding: '7px 16px', fontSize: 13 }}>
          🔄 Refresh
        </button>
      </div>

      {/* ── HR: Stats Cards ── */}
      {isHR && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total',       value: stats.total,         color: '#3b82f6', icon: '📋' },
            { label: 'Draft',       value: stats.draft,         color: '#f59e0b', icon: '✏️' },
            { label: 'Processed',   value: stats.processed,     color: '#6366f1', icon: '⚙️' },
            { label: 'Paid',        value: stats.paid,          color: '#10b981', icon: '✅' },
            { label: 'Total Payout',value: fmt(stats.totalPayout), color: '#1a237e', icon: '💸' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${s.color}` }}>
              <div style={{ fontSize: 20 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── HR: Info banner ── */}
      {isHR && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 18px', marginBottom: 20, fontSize: 13, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>ℹ️</span>
          <span>
            Payroll is <strong>fully automatic</strong> — calculated from each employee's attendance records, approved leaves, and base salary from the database.
            Click <strong>"Generate All Employees"</strong> to process the selected month in one click.
          </span>
        </div>
      )}

      {/* ── EMPLOYEE: My Payslip Card ── */}
      {!isHR && (
        <>
          {loading ? (
            <div style={loadingStyle}>Loading your payslip...</div>
          ) : myPayroll ? (
            <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 2px 16px rgba(26,35,126,0.1)', overflow: 'hidden', maxWidth: 720 }}>
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
                    { label: 'Base Salary',  value: fmt(myPayroll.baseSalary), color: '#1a237e' },
                    { label: 'Deductions',   value: fmt(myPayroll.deductions),  color: '#dc2626' },
                    { label: 'Net Salary',   value: fmt(myPayroll.netSalary),   color: '#059669' },
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
                    ['Working Days',  myPayroll.workingDays],
                    ['Worked Days',   myPayroll.workedDays],
                    ['Month',         MONTHS[myPayroll.month - 1]],
                    ['Year',          myPayroll.year],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                      <span style={{ color: '#6b7280' }}>{l}</span>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <button onClick={() => handleViewPayslip(myPayroll)} style={{ ...btnStyle('#1a237e'), width: '100%', justifyContent: 'center', padding: '12px' }}>
                  📄 View & Download Full Payslip
                </button>
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
            />
          )}
        </Modal.Body>
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