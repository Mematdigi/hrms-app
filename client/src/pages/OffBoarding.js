import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { employeeAPI, offboardingAPI } from '../services/api';
import BackButton from '../components/BackButton';
// import './_OffBoarding.scss';

// ─── Constants ────────────────────────────────────────────────────────────────
const INVOLUNTARY_REASONS = [
  { label: 'Misconduct',      icon: '🚫' },
  { label: 'Behavior',        icon: '😤' },
  { label: 'Abscond',         icon: '🏃' },
  { label: 'Unethical',       icon: '⚖️' },
  { label: 'Layoff',          icon: '📉' },
  { label: 'Separation',      icon: '✂️' },
  { label: 'BGC',             icon: '🔍' },
  { label: 'Infosec breach',  icon: '🔓' },
  { label: 'Others',          icon: '📝' },
];

// FNF metadata — abbr, full name, helper description
const FNF_META = {
  ral: {
    abbr: 'RAL',
    name: 'Resignation Acceptance Letter',
    desc: 'Formal letter acknowledging the employee resignation',
  },
  rl: {
    abbr: 'RL',
    name: 'Relieving Letter',
    desc: 'Official letter relieving the employee from all duties',
  },
  payslip: {
    abbr: 'PAY',
    name: 'Payslip',
    desc: 'Final month salary slip & full-and-final settlement',
  },
};

const FNF_PILL_OPTIONS = ['Yes', 'No', 'Not Applicable'];

const INITIAL_FORM = {
  actionType:             '',
  involuntaryReason:      '',
  involuntaryReasonOther: '',
  assets: {
    laptop:  false,
    mouse:   false,
    charger: false,
    others:  [],          // [{ label: string, checked: boolean }]
  },
  noticePeriod: 'Not Applicable',
  fnf: {
    ral:     'Not Applicable',
    rl:      'Not Applicable',
    payslip: 'Not Applicable',
  },
  remarks: '',
};

// ─── OffBoarding Component ─────────────────────────────────────────────────────
function OffBoarding() {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const { user }        = useSelector((state) => state.auth);

  const urlEmployeeId = searchParams.get('employeeId');

  // ── Page Mode ─────────────────────────────────────────────────────────────
  const [pageMode, setPageMode] = useState(urlEmployeeId ? 'form' : 'list');

  // ── Employee ──────────────────────────────────────────────────────────────
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeLoading, setEmployeeLoading]   = useState(false);

  // ── Records List ──────────────────────────────────────────────────────────
  const [records, setRecords]           = useState([]);
  const [listLoading, setListLoading]   = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  // ── Form ──────────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    ...INITIAL_FORM,
    assets: { ...INITIAL_FORM.assets, others: [] },
    fnf:    { ...INITIAL_FORM.fnf },
  });
  const [otherAssetInput, setOtherAssetInput] = useState('');
  const [formStep, setFormStep]               = useState(1);
  const [existingRecordId, setExistingRecordId] = useState(null);

  // ── Feedback ──────────────────────────────────────────────────────────────
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Auto-clear feedback ───────────────────────────────────────────────────
  useEffect(() => {
    if (!successMsg && !errorMsg) return;
    const t = setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 5000);
    return () => clearTimeout(t);
  }, [successMsg, errorMsg]);

  // ── On mount ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (urlEmployeeId) {
      loadEmployee(urlEmployeeId);
    } else {
      fetchRecords();
    }
  }, [urlEmployeeId]); // loadEmployee and fetchRecords are stable — defined inside component but don't need to be deps here

  // ─── Load Employee + check for existing offboarding record ───────────────
  const loadEmployee = async (empId) => {
    setEmployeeLoading(true);
    try {
      const res = await employeeAPI.getById(empId);
      setSelectedEmployee(res.data);

      try {
        const offRes = await offboardingAPI.getByEmployee(empId);
        if (offRes.data?.data) {
          const ex = offRes.data.data;
          setExistingRecordId(ex._id);
          setForm({
            actionType:             ex.actionType             || '',
            involuntaryReason:      ex.involuntaryReason      || '',
            involuntaryReasonOther: ex.involuntaryReasonOther || '',
            assets: {
              laptop:  ex.assets?.laptop  ?? false,
              mouse:   ex.assets?.mouse   ?? false,
              charger: ex.assets?.charger ?? false,
              others:  ex.assets?.others  ?? [],
            },
            noticePeriod: ex.noticePeriod || 'Not Applicable',
            fnf: {
              ral:     ex.fnf?.ral     || 'Not Applicable',
              rl:      ex.fnf?.rl      || 'Not Applicable',
              payslip: ex.fnf?.payslip || 'Not Applicable',
            },
            remarks: ex.remarks || '',
          });
          if (ex.actionType) setFormStep(2);
        }
      } catch (_) { /* no existing record — fresh form */ }

      setPageMode('form');
    } catch {
      setErrorMsg('Could not load employee details.');
    } finally {
      setEmployeeLoading(false);
    }
  };

  // ─── Fetch Records List ───────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setListLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await offboardingAPI.getAll(params);
      setRecords(res.data?.data || []);
    } catch {
      setErrorMsg('Failed to load offboarding records.');
    } finally {
      setListLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (pageMode === 'list') fetchRecords();
  }, [pageMode, statusFilter, fetchRecords]);

  // ─── Deep-set a nested form field by dot-path ─────────────────────────────
  const setFormField = (path, value) => {
    setForm((prev) => {
      const updated = { ...prev };
      const keys    = path.split('.');
      let node      = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        node[keys[i]] = { ...node[keys[i]] };
        node          = node[keys[i]];
      }
      node[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  // ─── Asset — Others Handlers ──────────────────────────────────────────────
  const handleAddOtherAsset = () => {
    const label = otherAssetInput.trim();
    if (!label) return;
    if (form.assets.others.some((o) => o.label.toLowerCase() === label.toLowerCase())) {
      setErrorMsg('This item already exists.'); return;
    }
    setForm((prev) => ({
      ...prev,
      assets: { ...prev.assets, others: [...prev.assets.others, { label, checked: true }] },
    }));
    setOtherAssetInput('');
  };

  const handleToggleOtherAsset = (index) =>
    setForm((prev) => ({
      ...prev,
      assets: {
        ...prev.assets,
        others: prev.assets.others.map((item, i) =>
          i === index ? { ...item, checked: !item.checked } : item
        ),
      },
    }));

  const handleRemoveOtherAsset = (index) =>
    setForm((prev) => ({
      ...prev,
      assets: { ...prev.assets, others: prev.assets.others.filter((_, i) => i !== index) },
    }));

  // ─── Step 1 → Step 2 ──────────────────────────────────────────────────────
  const handleActionSelect = (type) => {
    setForm((prev) => ({ ...prev, actionType: type, involuntaryReason: '', involuntaryReasonOther: '' }));
    setFormStep(2);
  };

  // ─── Form Submit ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    if (!form.actionType) {
      setErrorMsg('Please select an action type.'); return;
    }
    if (form.actionType === 'involuntary' && !form.involuntaryReason) {
      setErrorMsg('Please select a reason for involuntary action.'); return;
    }
    if (form.actionType === 'involuntary' && form.involuntaryReason === 'Others' && !form.involuntaryReasonOther.trim()) {
      setErrorMsg('Please specify the involuntary reason.'); return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        employeeId:             selectedEmployee._id,
        actionType:             form.actionType,
        involuntaryReason:      form.involuntaryReason,
        involuntaryReasonOther: form.involuntaryReasonOther,
        'assets.laptop':        form.assets.laptop,
        'assets.mouse':         form.assets.mouse,
        'assets.charger':       form.assets.charger,
        'assets.others':        JSON.stringify(form.assets.others),
        noticePeriod:           form.noticePeriod,
        'fnf.ral':              form.fnf.ral,
        'fnf.rl':               form.fnf.rl,
        'fnf.payslip':          form.fnf.payslip,
        remarks:                form.remarks,
        status:                 'pending',
      };

      if (existingRecordId) {
        await offboardingAPI.update(existingRecordId, payload);
        setSuccessMsg('✅ Offboarding record updated successfully!');
      } else {
        const res = await offboardingAPI.create(payload);
        setExistingRecordId(res.data?.data?._id);
        setSuccessMsg('✅ Offboarding process initiated successfully!');
      }
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || 'Failed to save offboarding record.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Mark Complete ────────────────────────────────────────────────────────
  const handleMarkComplete = async (id) => {
    if (!window.confirm('Mark this offboarding as completed?')) return;
    try {
      await offboardingAPI.markComplete(id);
      setSuccessMsg('✅ Marked as completed.');
      fetchRecords();
    } catch { setErrorMsg('Failed to mark as completed.'); }
  };

  // ─── Delete Record ────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this offboarding record? This cannot be undone.')) return;
    try {
      await offboardingAPI.delete(id);
      setSuccessMsg('✅ Record deleted.');
      fetchRecords();
    } catch { setErrorMsg('Failed to delete record.'); }
  };

  // ─── Reset & Go Back ──────────────────────────────────────────────────────
  const resetAndGoList = () => {
    setPageMode('list');
    setSelectedEmployee(null);
    setForm({ ...INITIAL_FORM, assets: { ...INITIAL_FORM.assets, others: [] }, fnf: { ...INITIAL_FORM.fnf } });
    setFormStep(1);
    setExistingRecordId(null);
    navigate('/OffBoarding');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ── renderFNFRow — Rich redesigned version ────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  const renderFNFRow = (key) => {
    const meta    = FNF_META[key];
    const current = form.fnf[key];                       // 'Yes' | 'No' | 'Not Applicable'

    // Row accent class — colours the left border + background tint
    const rowAccent =
      current === 'Yes'            ? 'fnf-yes'
      : current === 'No'           ? 'fnf-no'
      : current === 'Not Applicable' ? 'fnf-na'
      : '';

    // Status dot
    const dotClass =
      current === 'Yes'            ? 'dot-yes'
      : current === 'No'           ? 'dot-no'
      : current === 'Not Applicable' ? 'dot-na'
      : '';

    const dotIcon =
      current === 'Yes'            ? '✓'
      : current === 'No'           ? '✕'
      : current === 'Not Applicable' ? '—'
      : '?';

    return (
      <div key={key} className={`ob-fnf-row ${rowAccent}`}>

        {/* ── Left: document label ── */}
        <div className="ob-fnf-label">
          <div className="ob-fnf-doc-name">
            <span className="ob-fnf-abbr">{meta.abbr}</span>
            {meta.name}
          </div>
          <div className="ob-fnf-doc-desc">{meta.desc}</div>
        </div>

        {/* ── Centre: Yes / No / N-A pill buttons ── */}
        <div className="ob-fnf-options">
          {FNF_PILL_OPTIONS.map((opt) => (
            <label
              key={opt}
              className={`ob-fnf-option ${current === opt ? 'selected' : ''}`}
              data-value={opt}
            >
              <input
                type="radio"
                name={`fnf-${key}`}
                value={opt}
                checked={current === opt}
                onChange={() => setFormField(`fnf.${key}`, opt)}
              />
              {opt}
            </label>
          ))}
        </div>

        {/* ── Right: animated status dot ── */}
        <div className={`ob-fnf-status-dot ${dotClass}`}>
          {dotIcon}
        </div>

      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="offboarding-page">

      {/* ── Toasts ── */}
      {successMsg && (
        <div className="ob-toast ob-toast--success">
          <i className="bi bi-check-circle-fill" style={{ fontSize: 16 }}></i>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="ob-toast ob-toast--error">
          <i className="bi bi-exclamation-circle-fill" style={{ fontSize: 16 }}></i>
          {errorMsg}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* LIST VIEW                                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {pageMode === 'list' && (
        <>
          <div className="ob-page-header">
            <div>
              <h1><span className="mt-3"><BackButton/></span>
                <i className="bi bi-door-open me-2" style={{ color: '#6f5edb' }}></i>
                Off-Boarding
              </h1>
              <p>Manage employee exit processes, asset returns, and settlements.</p>
            </div>
          </div>

          {/* Status filter tabs */}
          <div className="ob-filter-bar">
            {['', 'pending', 'completed'].map((f) => (
              <button
                key={f}
                className={`ob-filter-btn ${statusFilter === f ? 'active' : ''}`}
                onClick={() => setStatusFilter(f)}
              >
                {f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {listLoading ? (
            <div className="ob-loading">Loading offboarding records...</div>
          ) : records.length === 0 ? (
            <div className="ob-empty-state">
              <span className="ob-empty-icon">🚪</span>
              <h3>No Offboarding Records</h3>
              <p>
                When an employee is marked inactive from the Employees page,
                their offboarding process will appear here.
              </p>
            </div>
          ) : (
            <div className="ob-records-grid">
              {records.map((rec) => {
                const emp = rec.employee || {};
                const assetList = [
                  rec.assets?.laptop  && 'Laptop',
                  rec.assets?.mouse   && 'Mouse',
                  rec.assets?.charger && 'Charger',
                  ...(rec.assets?.others?.filter((o) => o.checked).map((o) => o.label) || []),
                ].filter(Boolean);

                return (
                  <div key={rec._id} className={`ob-record-card ${rec.status}`}>

                    {/* Card header */}
                    <div className="ob-card-header">
                      <div className="ob-avatar">{emp.firstName?.[0] || '?'}</div>
                      <div className="ob-card-info">
                        <h3>{emp.firstName} {emp.lastName}</h3>
                        <p>{emp.designation || '—'} &bull; {emp.department || '—'}</p>
                        <p className="ob-emp-id">{emp.employeeId}</p>
                      </div>
                      <span className={`ob-status-badge ${rec.status}`}>
                        {rec.status === 'completed' ? (
                          <><i className="bi bi-check-circle-fill"></i> Completed</>
                        ) : (
                          <><i className="bi bi-clock-fill"></i> Pending</>
                        )}
                      </span>
                    </div>

                    {/* Card body */}
                    <div className="ob-card-body">
                      <div className="ob-info-row">
                        <span className="ob-info-label">Action</span>
                        <span className={`ob-action-badge ${rec.actionType}`}>
                          {rec.actionType === 'voluntary' ? '🤝 Voluntary' : '⚠️ Involuntary'}
                        </span>
                      </div>

                      {rec.actionType === 'involuntary' && rec.involuntaryReason && (
                        <div className="ob-info-row">
                          <span className="ob-info-label">Reason</span>
                          <span>
                            {rec.involuntaryReason === 'Others'
                              ? rec.involuntaryReasonOther || '—'
                              : rec.involuntaryReason}
                          </span>
                        </div>
                      )}

                      <div className="ob-info-row">
                        <span className="ob-info-label">Notice</span>
                        <span>{rec.noticePeriod}</span>
                      </div>

                      <div className="ob-info-row">
                        <span className="ob-info-label">Assets</span>
                        <span>{assetList.length ? assetList.join(', ') : 'None'}</span>
                      </div>

                      {/* FNF mini-badges */}
                      <div className="ob-info-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                        <span className="ob-info-label">FNF</span>
                        {Object.entries(FNF_META).map(([k, m]) => {
                          const val = rec.fnf?.[k];
                          const cls = val === 'Yes' ? 'fnf-mini-yes' : val === 'No' ? 'fnf-mini-no' : 'fnf-mini-na';
                          return (
                            <span key={k} className={`ob-fnf-mini-badge ${cls}`}>
                              {m.abbr}: {val || 'N/A'}
                            </span>
                          );
                        })}
                      </div>

                      <div className="ob-info-row">
                        <span className="ob-info-label">Date</span>
                        <span>{new Date(rec.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>

                    {/* Card footer */}
                    <div className="ob-card-footer">
                      <button
                        className="ob-btn ob-btn--outline ob-btn--sm"
                        onClick={() => { loadEmployee(emp._id); setExistingRecordId(rec._id); }}
                      >
                        <i className="bi bi-pencil me-1"></i>Edit
                      </button>
                      {rec.status === 'pending' && (user?.role === 'admin' || user?.role === 'hr') && (
                        <button
                          className="ob-btn ob-btn--success ob-btn--sm"
                          onClick={() => handleMarkComplete(rec._id)}
                        >
                          <i className="bi bi-check-circle me-1"></i>Mark Complete
                        </button>
                      )}
                      {user?.role === 'admin' && (
                        <button
                          className="ob-btn ob-btn--danger ob-btn--sm"
                          onClick={() => handleDelete(rec._id)}
                        >
                          <i className="bi bi-trash me-1"></i>Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* FORM VIEW                                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {pageMode === 'form' && (
        <>
          <div className="ob-page-header">
            <div>
              <h1>
                <button className="ob-back-btn" onClick={resetAndGoList} title="Back to list">
                  <i className="bi bi-arrow-left"></i>
                </button>
                Off-Boarding Process
              </h1>
              <p>Complete the exit process for the departing employee.</p>
            </div>
          </div>

          {employeeLoading ? (
            <div className="ob-loading">Loading employee details...</div>
          ) : selectedEmployee ? (
            <>
              {/* ── Employee Banner ── */}
              <div className="ob-employee-banner">
                <div className="ob-banner-avatar">
                  {selectedEmployee.profilePhoto ? (
                    <img
                      src={`http://localhost:5000/uploads/${selectedEmployee.profilePhoto}`}
                      alt={selectedEmployee.firstName}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    selectedEmployee.firstName?.[0] || '?'
                  )}
                </div>
                <div className="ob-banner-info">
                  <h2>{selectedEmployee.firstName} {selectedEmployee.lastName}</h2>
                  <div className="ob-banner-meta">
                    <span>
                      <i className="bi bi-briefcase me-1"></i>
                      {selectedEmployee.designation || '—'}
                    </span>
                    <span>
                      <i className="bi bi-building me-1"></i>
                      {selectedEmployee.department || '—'}
                    </span>
                    <span>
                      <i className="bi bi-envelope me-1"></i>
                      {selectedEmployee.email}
                    </span>
                    <span>
                      <i className="bi bi-person-badge me-1"></i>
                      {selectedEmployee.employeeId}
                    </span>
                    <span className="ob-inactive-badge">
                      <i className="bi bi-x-circle me-1"></i>Inactive
                    </span>
                  </div>
                </div>

                {/* Existing record status indicator */}
                {existingRecordId && (
                  <div className="ob-banner-record-tag">
                    <i className="bi bi-pencil-square me-1"></i>
                    Editing existing record
                  </div>
                )}
              </div>

              {/* ── Step Indicator ── */}
              <div className="ob-steps">
                <div className={`ob-step ${formStep >= 1 ? 'active' : ''} ${formStep > 1 ? 'done' : ''}`}>
                  <div className="ob-step-circle">
                    {formStep > 1 ? <i className="bi bi-check"></i> : '1'}
                  </div>
                  <span>Select Action</span>
                </div>
                <div className="ob-step-connector"></div>
                <div className={`ob-step ${formStep >= 2 ? 'active' : ''}`}>
                  <div className="ob-step-circle">2</div>
                  <span>Exit Details</span>
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════ */}
              {/* STEP 1 — Choose Action Type                              */}
              {/* ════════════════════════════════════════════════════════ */}
              {formStep === 1 && (
                <div className="ob-section">
                  <h3 className="ob-section-title">
                    <i className="bi bi-signpost-split me-2" style={{ color: '#6f5edb' }}></i>
                    Select Action Type
                  </h3>
                  <p className="ob-section-subtitle">
                    Choose the nature of this employee separation to trigger the appropriate workflow.
                  </p>

                  <div className="ob-action-cards">

                    {/* Voluntary */}
                    <div
                      className={`ob-action-card voluntary ${form.actionType === 'voluntary' ? 'selected' : ''}`}
                      onClick={() => handleActionSelect('voluntary')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleActionSelect('voluntary')}
                    >
                      <div className="ob-action-icon">🤝</div>
                      <h3>Voluntary Action</h3>
                      <p>Employee-initiated separation — resignations, retirements, and other voluntary exits.</p>
                      <ul>
                        <li>Employee resignation</li>
                        <li>Retirement</li>
                        <li>Personal reasons</li>
                      </ul>
                      <button type="button" className="ob-btn ob-btn--primary ob-btn--full" tabIndex={-1}>
                        Select Voluntary <i className="bi bi-arrow-right ms-1"></i>
                      </button>
                    </div>

                    {/* Involuntary */}
                    <div
                      className={`ob-action-card involuntary ${form.actionType === 'involuntary' ? 'selected' : ''}`}
                      onClick={() => handleActionSelect('involuntary')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleActionSelect('involuntary')}
                    >
                      <div className="ob-action-icon">⚠️</div>
                      <h3>Involuntary Action</h3>
                      <p>Company-initiated separation — terminations, layoffs, and other involuntary exits.</p>
                      <ul>
                        <li>Misconduct / Policy violation</li>
                        <li>Layoff / Restructuring</li>
                        <li>Background check failure</li>
                      </ul>
                      <button type="button" className="ob-btn ob-btn--warning ob-btn--full" tabIndex={-1}>
                        Select Involuntary <i className="bi bi-arrow-right ms-1"></i>
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════════════════════ */}
              {/* STEP 2 — Exit Details Form                               */}
              {/* ════════════════════════════════════════════════════════ */}
              {formStep === 2 && (
                <form onSubmit={handleSubmit}>

                  {/* Action type header bar */}
                  <div className={`ob-action-header ${form.actionType}`}>
                    <div className="ob-action-header-icon">
                      {form.actionType === 'voluntary' ? '🤝' : '⚠️'}
                    </div>
                    <div>
                      <h3>
                        {form.actionType === 'voluntary' ? 'Voluntary Action' : 'Involuntary Action'}
                      </h3>
                      <p>
                        {form.actionType === 'voluntary'
                          ? 'Employee-initiated separation process'
                          : 'Company-initiated separation process'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ob-change-action-btn"
                      onClick={() => setFormStep(1)}
                    >
                      <i className="bi bi-pencil me-1"></i>Change
                    </button>
                  </div>

                  {/* ── Involuntary: reason selection ── */}
                  {form.actionType === 'involuntary' && (
                    <div className="ob-section">
                      <h3 className="ob-section-title">
                        <i className="bi bi-exclamation-triangle me-2" style={{ color: '#f59e0b' }}></i>
                        Reason for Involuntary Action
                      </h3>
                      <p className="ob-section-subtitle">
                        Select the primary reason for this company-initiated separation.
                      </p>

                      <div className="ob-reason-grid">
                        {INVOLUNTARY_REASONS.map(({ label, icon }) => (
                          <label
                            key={label}
                            className={`ob-reason-card ${form.involuntaryReason === label ? 'selected' : ''}`}
                          >
                            <input
                              type="radio"
                              name="involuntaryReason"
                              value={label}
                              checked={form.involuntaryReason === label}
                              onChange={(e) => setFormField('involuntaryReason', e.target.value)}
                            />
                            <span className="ob-reason-icon">{icon}</span>
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>

                      {form.involuntaryReason === 'Others' && (
                        <div className="ob-other-input-wrap">
                          <label>Specify Reason <span style={{ color: '#ef4444' }}>*</span></label>
                          <input
                            type="text"
                            className="ob-input"
                            placeholder="Describe the specific reason for involuntary action..."
                            value={form.involuntaryReasonOther}
                            onChange={(e) => setFormField('involuntaryReasonOther', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Assets to Return ── */}
                  <div className="ob-section">
                    <h3 className="ob-section-title">
                      <i className="bi bi-laptop me-2" style={{ color: '#6f5edb' }}></i>
                      Assets to Return
                    </h3>
                    <p className="ob-section-subtitle">
                      Select all company assets the employee needs to hand over before leaving.
                    </p>

                    <div className="ob-assets-grid">
                      {/* Standard assets */}
                      {[
                        { key: 'laptop',  label: 'Laptop',  icon: '💻' },
                        { key: 'mouse',   label: 'Mouse',   icon: '🖱️' },
                        { key: 'charger', label: 'Charger', icon: '🔌' },
                      ].map(({ key, label, icon }) => (
                        <label key={key} className={`ob-asset-card ${form.assets[key] ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={form.assets[key]}
                            onChange={(e) => setFormField(`assets.${key}`, e.target.checked)}
                          />
                          <span className="ob-asset-icon">{icon}</span>
                          <span>{label}</span>
                          {form.assets[key] && (
                            <i className="bi bi-check-circle-fill ob-asset-check"></i>
                          )}
                        </label>
                      ))}

                      {/* Custom "Others" asset items */}
                      {form.assets.others.map((item, idx) => (
                        <label
                          key={idx}
                          className={`ob-asset-card ob-asset-card--other ${item.checked ? 'checked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => handleToggleOtherAsset(idx)}
                          />
                          <span className="ob-asset-icon">📦</span>
                          <span>{item.label}</span>
                          <button
                            type="button"
                            className="ob-remove-asset-btn"
                            onClick={(e) => { e.preventDefault(); handleRemoveOtherAsset(idx); }}
                            title="Remove"
                          >×</button>
                          {item.checked && (
                            <i className="bi bi-check-circle-fill ob-asset-check"></i>
                          )}
                        </label>
                      ))}
                    </div>

                    {/* Add custom asset */}
                    <div className="ob-add-other-row">
                      <input
                        type="text"
                        className="ob-input ob-input--sm"
                        placeholder="Add other asset (e.g. Keyboard, ID Card, Headset...)"
                        value={otherAssetInput}
                        onChange={(e) => setOtherAssetInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); handleAddOtherAsset(); }
                        }}
                      />
                      <button
                        type="button"
                        className="ob-btn ob-btn--outline ob-btn--sm"
                        onClick={handleAddOtherAsset}
                      >
                        <i className="bi bi-plus-circle me-1"></i>Add
                      </button>
                    </div>
                  </div>

                  {/* ── Notice Period ── */}
                  <div className="ob-section">
                    <h3 className="ob-section-title">
                      <i className="bi bi-calendar-check me-2" style={{ color: '#6f5edb' }}></i>
                      Notice Period
                    </h3>
                    <p className="ob-section-subtitle">
                      Did the employee serve the required notice period?
                    </p>
                    <div className="ob-radio-group">
                      {['Yes', 'No', 'Not Applicable'].map((opt) => (
                        <label
                          key={opt}
                          className={`ob-radio-card ${form.noticePeriod === opt ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="noticePeriod"
                            value={opt}
                            checked={form.noticePeriod === opt}
                            onChange={(e) => setFormField('noticePeriod', e.target.value)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* ── Full & Final (FNF) — RICH REDESIGN ── */}
                  <div className="ob-section">
                    <h3 className="ob-section-title">
                      <i className="bi bi-file-earmark-check me-2" style={{ color: '#6f5edb' }}></i>
                      Full &amp; Final (FNF) Process
                    </h3>
                    <p className="ob-section-subtitle">
                      Set the status of each settlement document. The row highlights based on your selection.
                    </p>

                    <div className="ob-fnf-table">
                      {renderFNFRow('ral')}
                      {renderFNFRow('rl')}
                      {renderFNFRow('payslip')}
                    </div>
                  </div>

                  {/* ── Remarks ── */}
                  <div className="ob-section">
                    <h3 className="ob-section-title">
                      <i className="bi bi-chat-square-text me-2" style={{ color: '#6f5edb' }}></i>
                      Remarks
                    </h3>
                    <p className="ob-section-subtitle">
                      Add any additional notes, instructions, or context for this employee's exit.
                    </p>
                    <textarea
                      className="ob-textarea"
                      rows={4}
                      placeholder="e.g. Employee was cooperative during the exit process. Knowledge transfer completed on..."
                      value={form.remarks}
                      onChange={(e) => setFormField('remarks', e.target.value)}
                    />
                  </div>

                  {/* ── Form Action Buttons ── */}
                  <div className="ob-form-actions">
                    <button
                      type="button"
                      className="ob-btn ob-btn--ghost"
                      onClick={resetAndGoList}
                    >
                      <i className="bi bi-x me-1"></i>Cancel
                    </button>
                    <button
                      type="submit"
                      className="ob-btn ob-btn--primary"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle me-1"></i>
                          {existingRecordId ? 'Update Record' : 'Initiate Offboarding'}
                        </>
                      )}
                    </button>
                  </div>

                </form>
              )}
            </>
          ) : (
            <div className="ob-empty-state">
              <span className="ob-empty-icon">👤</span>
              <h3>No Employee Selected</h3>
              <p>Please go back and select an employee to offboard.</p>
              <br />
              <button className="ob-btn ob-btn--outline" onClick={resetAndGoList}>
                <i className="bi bi-arrow-left me-1"></i>Back to List
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default OffBoarding;