import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { leaveAPI } from '../services/api'; // adjust import path as needed

// ─── Utility helpers ──────────────────────────────────────────────────────────

const fmt = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_COLORS = {
    approved: { bg: '#ECFDF5', text: '#027A48', dot: '#12B76A' },
    pending: { bg: '#FFFAEB', text: '#B54708', dot: '#F79009' },
    rejected: { bg: '#FFF1F3', text: '#C01048', dot: '#F63D68' },
};

// ── 'half' added to the leave type options ────────────────────────────────────
const LEAVE_TYPE_OPTIONS = ['', 'sick', 'casual', 'earned', 'maternity', 'paternity', 'unpaid', 'short', 'half', 'holidays'];
const STATUS_OPTIONS = ['', 'all', 'pending', 'approved', 'rejected'];
const CATEGORY_OPTIONS = ['', 'Full', 'Prob', 'Intern'];

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const c = STATUS_COLORS[status] || { bg: '#F2F4F7', text: '#344054', dot: '#667085' };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            backgroundColor: c.bg, color: c.text,
        }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: c.dot, flexShrink: 0 }} />
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : '—'}
        </span>
    );
};

// ─── Modal wrapper ────────────────────────────────────────────────────────────
// Rendered via React Portal into document.body so that no ancestor's
// transform/filter/animation can trap the modal inside a local stacking context.
const Modal = ({ open, onClose, title, subtitle, children, maxWidth = 720 }) => {
    if (!open) return null;
    return createPortal(
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(16, 24, 40, 0.6)', backdropFilter: 'blur(4px)',
            padding: 16,
        }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div style={{
                background: '#fff', borderRadius: 16, width: '100%', maxWidth,
                boxShadow: '0 20px 60px rgba(16,24,40,0.18)', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', maxHeight: '92vh',
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid #EAECF0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0,
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#101828' }}>{title}</h2>
                        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#667085' }}>{subtitle}</p>}
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
                        fontSize: 22, color: '#667085', lineHeight: 1,
                    }}>×</button>
                </div>
                {/* Body */}
                <div style={{ overflowY: 'auto', flex: 1 }}>{children}</div>
            </div>
        </div>,
        document.body
    );
};

// ─── Upload Modal ─────────────────────────────────────────────────────────────
const UploadModal = ({ open, onClose }) => {
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null); // { inserted, skipped, errors }
    const [error, setError] = useState('');
    const fileRef = useRef();

    const reset = () => { setFile(null); setResult(null); setError(''); };
    const handleClose = () => { reset(); onClose(); };

    const onFileChange = (e) => {
        const f = e.target.files?.[0];
        if (f) { setFile(f); setResult(null); setError(''); }
    };

    const onDrop = useCallback((e) => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.name.match(/\.(xlsx|xls)$/i)) { setFile(f); setResult(null); setError(''); }
        else setError('Please drop a valid .xlsx or .xls file.');
    }, []);

    const downloadTemplate = async () => {
        try {
            const res = await leaveAPI.downloadTemplate();
            const url = URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'leave_upload_template.xlsx';
            link.click();
            URL.revokeObjectURL(url);
        } catch {
            setError('Failed to download template. Please try again.');
        }
    };

    const handleSubmit = async () => {
        if (!file) { setError('Please select an Excel file to upload.'); return; }
        setUploading(true); setError(''); setResult(null);
        try {
            const fd = new FormData();
            fd.append('leaveFile', file);
            const res = await leaveAPI.bulkUpload(fd);
            setResult(res.data);
            setFile(null);
            if (fileRef.current) fileRef.current.value = '';
        } catch (e) {
            setError(e?.response?.data?.message || 'Upload failed. Please check the file and try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={handleClose}
            title="Upload Leave Data"
            subtitle="Import employee leave records from an Excel file (.xlsx)"
            maxWidth={540}
        >
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Download Template Button */}
                <div style={{
                    background: '#F8FAFF', border: '1px solid #D1E0FF',
                    borderRadius: 10, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                    <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1D2939' }}>Download Format</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#667085' }}>
                            Use this template to fill in leave data correctly
                        </p>
                    </div>
                    <button onClick={downloadTemplate} style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '8px 16px', borderRadius: 8,
                        background: '#fff', border: '1.5px solid #2E6CF6',
                        color: '#2E6CF6', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        Download Format
                    </button>
                </div>

                {/* Drag & Drop Zone */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    onClick={() => fileRef.current?.click()}
                    style={{
                        border: `2px dashed ${dragging ? '#2E6CF6' : file ? '#12B76A' : '#D0D5DD'}`,
                        borderRadius: 12, padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
                        background: dragging ? '#EFF6FF' : file ? '#ECFDF5' : '#FAFAFA',
                        transition: 'all 0.2s',
                    }}
                >
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} style={{ display: 'none' }} />
                    <div style={{ fontSize: 32, marginBottom: 8 }}>{file ? '✅' : '📂'}</div>
                    {file ? (
                        <>
                            <p style={{ margin: 0, fontWeight: 600, color: '#027A48', fontSize: 14 }}>{file.name}</p>
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#667085' }}>
                                {(file.size / 1024).toFixed(1)} KB · Click to change
                            </p>
                        </>
                    ) : (
                        <>
                            <p style={{ margin: 0, fontWeight: 600, color: '#344054', fontSize: 14 }}>
                                Drag & drop your Excel file here
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#667085' }}>
                                or click to browse · .xlsx, .xls supported (max 10 MB)
                            </p>
                        </>
                    )}
                </div>

                {/* Column reference */}
                <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '12px 14px' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#344054' }}>Required columns:</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#667085', lineHeight: 1.8 }}>
                        <strong>Employee Phone</strong> (primary key) · Employee Name · Department · Designation ·
                        Intern/Probation · <strong>Leave Type</strong> (sick | casual | earned | maternity | paternity | unpaid | short | <strong>half</strong> | holidays) ·
                        Leave Start Date · Leave End Date · Total Days · Leave Status ·
                        Medical Document Submitted · Applied On · Remarks
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        background: '#FFF1F3', border: '1px solid #FECDCA', borderRadius: 8,
                        padding: '10px 14px', fontSize: 13, color: '#C01048',
                    }}>
                        {error}
                    </div>
                )}

                {/* Upload Result */}
                {result && (
                    <div style={{
                        background: result.skipped > 0 ? '#FFFAEB' : '#ECFDF5',
                        border: `1px solid ${result.skipped > 0 ? '#FEDF89' : '#A9EFC5'}`,
                        borderRadius: 8, padding: '12px 14px',
                    }}>
                        <p style={{ margin: '0 0 4px', fontWeight: 700, color: result.skipped > 0 ? '#B54708' : '#027A48', fontSize: 14 }}>
                            Upload Complete
                        </p>
                        <p style={{ margin: 0, fontSize: 13, color: '#344054' }}>
                            ✅ Inserted: <strong>{result.inserted}</strong> &nbsp;|&nbsp;
                            ⚠️ Skipped: <strong>{result.skipped}</strong>
                        </p>
                        {result.errors?.length > 0 && (
                            <div style={{ marginTop: 8, maxHeight: 120, overflowY: 'auto' }}>
                                {result.errors.map((e, i) => (
                                    <p key={i} style={{ margin: '2px 0', fontSize: 11, color: '#B54708' }}>
                                        Row {e.row}: {e.message}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 4 }}>
                    <button onClick={handleClose} style={{
                        padding: '10px 24px', borderRadius: 8, border: '1.5px solid #D0D5DD',
                        background: '#fff', color: '#344054', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}>
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={uploading || !file}
                        style={{
                            padding: '10px 28px', borderRadius: 8, border: 'none',
                            background: uploading || !file ? '#A4BCFD' : '#2E6CF6',
                            color: '#fff', fontSize: 14, fontWeight: 600, cursor: uploading || !file ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}
                    >
                        {uploading ? (
                            <>
                                <span style={{
                                    width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent',
                                    borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite',
                                }} />
                                Uploading…
                            </>
                        ) : 'Submit'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// ─── View Leaves Modal ────────────────────────────────────────────────────────
const ViewLeavesModal = ({ open, onClose }) => {
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [total, setTotal] = useState(0);
    const [fetched, setFetched] = useState(false);
    const [filters, setFilters] = useState({
        leaveType: '', status: '', category: '',
        startDate: '', endDate: '',
    });

    const fetchLeaves = async (f = filters) => {
        setLoading(true); setError('');
        try {
            const params = {};
            if (f.leaveType) params.leaveType = f.leaveType;
            if (f.status && f.status !== 'all') params.status = f.status;
            if (f.category) params.category = f.category;
            if (f.startDate) params.startDate = f.startDate;
            if (f.endDate) params.endDate = f.endDate;

            const res = await leaveAPI.getAllHR(params);
            setLeaves(res.data.leaves || []);
            setTotal(res.data.total || 0);
            setFetched(true);
        } catch (e) {
            setError(e?.response?.data?.message || 'Failed to fetch leave data.');
        } finally {
            setLoading(false);
        }
    };

    // Fetch on first open
    React.useEffect(() => {
        if (open && !fetched) fetchLeaves();
    }, [open]);

    const handleFilterChange = (key, val) => {
        const next = { ...filters, [key]: val };
        setFilters(next);
    };

    const applyFilters = () => fetchLeaves(filters);

    const resetFilters = () => {
        const blank = { leaveType: '', status: '', category: '', startDate: '', endDate: '' };
        setFilters(blank);
        fetchLeaves(blank);
    };

    const handleClose = () => { setFetched(false); setLeaves([]); setTotal(0); setError(''); onClose(); };

    const inputStyle = {
        padding: '7px 11px', border: '1.5px solid #D0D5DD', borderRadius: 8,
        fontSize: 13, color: '#344054', background: '#fff', outline: 'none',
    };

    // ── Helper: render leave type badge, appending half-day period if present ──
    const renderLeaveTypeBadge = (leave) => {
        const type = leave.leaveType || '';
        const isHalf = type === 'half';
        const periodLabel = isHalf && leave.halfDayPeriod
            ? leave.halfDayPeriod === 'first' ? ' · Morning' : ' · Afternoon'
            : '';
        return (
            <span style={{
                padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: isHalf ? '#FDF4FF' : '#EFF8FF',
                color: isHalf ? '#6941C6' : '#175CD3',
            }}>
                {type.charAt(0).toUpperCase() + type.slice(1)}{isHalf ? ' Day' : ''}{periodLabel}
            </span>
        );
    };

    return (
        <Modal open={open} onClose={handleClose} title="Leave Data" subtitle={`${total} record${total !== 1 ? 's' : ''} found`}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

                {/* ── Filters Bar ── */}
                <div style={{
                    padding: '14px 20px', background: '#F9FAFB', borderBottom: '1px solid #EAECF0',
                    display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', flexShrink: 0,
                }}>
                    {/* Leave Type */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#667085', textTransform: 'uppercase', letterSpacing: 0.5 }}>Leave Type</label>
                        <select value={filters.leaveType} onChange={(e) => handleFilterChange('leaveType', e.target.value)} style={inputStyle}>
                            <option value="">All Types</option>
                            {LEAVE_TYPE_OPTIONS.filter(Boolean).map(o => (
                                <option key={o} value={o}>
                                    {o === 'half' ? 'Half Day' : o.charAt(0).toUpperCase() + o.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Status */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#667085', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</label>
                        <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} style={inputStyle}>
                            <option value="">All Status</option>
                            {STATUS_OPTIONS.filter(Boolean).map(o => (
                                <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Category */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#667085', textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</label>
                        <select value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)} style={inputStyle}>
                            <option value="">All</option>
                            {CATEGORY_OPTIONS.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>

                    {/* Start Date */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#667085', textTransform: 'uppercase', letterSpacing: 0.5 }}>From Date</label>
                        <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} style={inputStyle} />
                    </div>

                    {/* End Date */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#667085', textTransform: 'uppercase', letterSpacing: 0.5 }}>To Date</label>
                        <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} style={inputStyle} />
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: 8, paddingBottom: 0 }}>
                        <button onClick={applyFilters} style={{
                            padding: '8px 20px', borderRadius: 8, border: 'none',
                            background: '#2E6CF6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        }}>Apply</button>
                        <button onClick={resetFilters} style={{
                            padding: '8px 16px', borderRadius: 8, border: '1.5px solid #D0D5DD',
                            background: '#fff', color: '#344054', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        }}>Reset</button>
                    </div>
                </div>

                {/* ── Table Area ── */}
                <div style={{ overflowX: 'auto', flex: 1 }}>
                    {loading ? (
                        <div style={{ padding: 60, textAlign: 'center', color: '#667085' }}>
                            <div style={{
                                width: 36, height: 36, border: '3px solid #E4E7EC', borderTopColor: '#2E6CF6',
                                borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px',
                            }} />
                            Loading leave data…
                        </div>
                    ) : error ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#C01048' }}>{error}</div>
                    ) : leaves.length === 0 ? (
                        <div style={{ padding: 60, textAlign: 'center', color: '#667085' }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                            No leave records found for the selected filters.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: '#F2F4F7', position: 'sticky', top: 0, zIndex: 1 }}>
                                    {[
                                        'Employee Name', 'Department', 'Designation', 'Intern/Probation',
                                        'Leave Type', 'Leave Start Date', 'Leave End Date', 'Total Days',
                                        'Leave Status', 'Medical Document Submitted', 'Applied On', 'Remarks',
                                    ].map((h) => (
                                        <th key={h} style={{
                                            padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                                            color: '#344054', whiteSpace: 'nowrap', borderBottom: '1px solid #EAECF0',
                                        }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {leaves.map((leave, idx) => {
                                    const emp = leave.employee || {};
                                    const fullName = emp.firstName ? `${emp.firstName} ${emp.lastName}` : '—';
                                    const category = leave.category || '—';
                                    const isEven = idx % 2 === 0;

                                    return (
                                        <tr key={leave._id} style={{ background: isEven ? '#fff' : '#FAFAFA' }}>
                                            <td style={{ padding: '10px 14px', color: '#101828', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #F2F4F7' }}>
                                                {fullName}
                                                {emp.employeeId && <span style={{ display: 'block', fontSize: 11, color: '#667085', fontWeight: 400 }}>{emp.employeeId}</span>}
                                            </td>
                                            <td style={{ padding: '10px 14px', color: '#344054', whiteSpace: 'nowrap', borderBottom: '1px solid #F2F4F7' }}>{emp.department || '—'}</td>
                                            <td style={{ padding: '10px 14px', color: '#344054', whiteSpace: 'nowrap', borderBottom: '1px solid #F2F4F7' }}>{emp.designation || '—'}</td>
                                            <td style={{ padding: '10px 14px', color: '#344054', borderBottom: '1px solid #F2F4F7' }}>
                                                <span style={{
                                                    padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                                                    background: category === 'Intern' ? '#EFF8FF' : category === 'Prob' ? '#FFF4ED' : '#F2F4F7',
                                                    color: category === 'Intern' ? '#175CD3' : category === 'Prob' ? '#B93815' : '#344054',
                                                }}>
                                                    {category}
                                                </span>
                                            </td>
                                            {/* Leave Type — shows "Half Day · Morning/Afternoon" for half leaves */}
                                            <td style={{ padding: '10px 14px', borderBottom: '1px solid #F2F4F7' }}>
                                                {renderLeaveTypeBadge(leave)}
                                            </td>
                                            <td style={{ padding: '10px 14px', color: '#344054', whiteSpace: 'nowrap', borderBottom: '1px solid #F2F4F7' }}>{fmt(leave.startDate)}</td>
                                            <td style={{ padding: '10px 14px', color: '#344054', whiteSpace: 'nowrap', borderBottom: '1px solid #F2F4F7' }}>{fmt(leave.endDate)}</td>
                                            <td style={{ padding: '10px 14px', color: '#344054', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #F2F4F7' }}>
                                                {/* Half day always shows 0.5 */}
                                                {leave.leaveType === 'half' ? '0.5' : (leave.numberOfDays ?? '—')}
                                            </td>
                                            <td style={{ padding: '10px 14px', borderBottom: '1px solid #F2F4F7' }}>
                                                <StatusBadge status={leave.status} />
                                            </td>
                                            <td style={{ padding: '10px 14px', borderBottom: '1px solid #F2F4F7', textAlign: 'center' }}>
                                                {leave.medicalDocumentSubmitted
                                                    ? <span style={{ color: '#027A48', fontWeight: 700, fontSize: 13 }}>✓ Yes</span>
                                                    : <span style={{ color: '#667085', fontSize: 13 }}>No</span>
                                                }
                                            </td>
                                            <td style={{ padding: '10px 14px', color: '#344054', whiteSpace: 'nowrap', borderBottom: '1px solid #F2F4F7' }}>{fmt(leave.createdAt)}</td>
                                            <td style={{ padding: '10px 14px', color: '#667085', borderBottom: '1px solid #F2F4F7', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {leave.reason || '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer count */}
                {!loading && leaves.length > 0 && (
                    <div style={{
                        padding: '10px 20px', borderTop: '1px solid #EAECF0', flexShrink: 0,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <span style={{ fontSize: 12, color: '#667085' }}>
                            Showing <strong>{leaves.length}</strong> of <strong>{total}</strong> records
                        </span>
                    </div>
                )}
            </div>
        </Modal>
    );
};

// ─── Spinner keyframe (injected once) ────────────────────────────────────────
const SpinStyle = () => (
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
);

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN EXPORTED COMPONENT
//  Drop this anywhere on the HR Dashboard.
//  Usage: <LeaveImportExport />
// ═════════════════════════════════════════════════════════════════════════════
const LeaveImportExport = () => {
    const [uploadOpen, setUploadOpen] = useState(false);
    const [viewOpen, setViewOpen] = useState(false);

    return (
        <>
            <SpinStyle />

            {/* ── Trigger Buttons ── */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {/* Upload Leave Data */}
                <button
                    onClick={() => setUploadOpen(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 10,
                        background: '#2E6CF6', border: 'none',
                        color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(46,108,246,0.25)',
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#1D5CE0'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#2E6CF6'}
                >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                    Upload Leave Data
                </button>

                {/* View Leave Data */}
                <button
                    onClick={() => setViewOpen(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 10,
                        background: '#fff', border: '1.5px solid #2E6CF6',
                        color: '#2E6CF6', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F0F5FF'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    View Leave Data
                </button>
            </div>

            {/* ── Modals ── */}
            <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
            <ViewLeavesModal open={viewOpen} onClose={() => setViewOpen(false)} />
        </>
    );
};

export default LeaveImportExport;