import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { officeDocumentAPI, personalDocumentAPI } from '../services/api';
// import '../styles/_uploadOfficeDocument.scss';

// ── Constants ─────────────────────────────────────────────────────────────────
const OFFICE_CATEGORIES   = ['All', 'HR Policy', 'Compliance', 'Finance', 'Legal', 'Operations', 'IT', 'General'];
const PERSONAL_CATEGORIES = ['All', 'Identity', 'Education', 'Experience', 'Financial', 'Medical', 'Legal', 'Other'];
const DEPARTMENTS         = ['All', 'Engineering', 'HR', 'Finance', 'Marketing', 'Operations', 'Legal', 'Sales', 'Administration'];

const OFFICE_CAT_META = {
  'HR Policy':   { color: '#6f5edb', bg: '#f0eeff', icon: 'bi-people-fill' },
  'Compliance':  { color: '#dc6803', bg: '#fff7ed', icon: 'bi-shield-check' },
  'Finance':     { color: '#027a48', bg: '#ecfdf3', icon: 'bi-cash-stack' },
  'Legal':       { color: '#b42318', bg: '#fef3f2', icon: 'bi-briefcase-fill' },
  'Operations':  { color: '#026aa2', bg: '#e0f2fe', icon: 'bi-gear-fill' },
  'IT':          { color: '#5b21b6', bg: '#f5f3ff', icon: 'bi-cpu-fill' },
  'General':     { color: '#374151', bg: '#f3f4f6', icon: 'bi-file-earmark-fill' },
};

const PERSONAL_CAT_META = {
  'Identity':    { color: '#6f5edb', bg: '#f0eeff', icon: 'bi-person-badge-fill' },
  'Education':   { color: '#0369a1', bg: '#e0f2fe', icon: 'bi-mortarboard-fill' },
  'Experience':  { color: '#0f766e', bg: '#f0fdfa', icon: 'bi-briefcase-fill' },
  'Financial':   { color: '#027a48', bg: '#ecfdf3', icon: 'bi-cash-stack' },
  'Medical':     { color: '#be185d', bg: '#fdf2f8', icon: 'bi-heart-pulse-fill' },
  'Legal':       { color: '#b42318', bg: '#fef3f2', icon: 'bi-scale' },
  'Other':       { color: '#374151', bg: '#f3f4f6', icon: 'bi-file-earmark-fill' },
};

const FILE_ICONS = {
  'application/pdf':                                                             { icon: 'bi-file-earmark-pdf-fill',  color: '#e11d48' },
  'application/msword':                                                          { icon: 'bi-file-earmark-word-fill', color: '#2563eb' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':    { icon: 'bi-file-earmark-word-fill', color: '#2563eb' },
  'application/vnd.ms-excel':                                                   { icon: 'bi-file-earmark-excel-fill',color: '#16a34a' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':          { icon: 'bi-file-earmark-excel-fill',color: '#16a34a' },
  'application/vnd.ms-powerpoint':                                              { icon: 'bi-file-earmark-ppt-fill',  color: '#ea580c' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { icon: 'bi-file-earmark-ppt-fill',  color: '#ea580c' },
  'text/plain':    { icon: 'bi-file-earmark-text-fill', color: '#6b7280' },
  'text/csv':      { icon: 'bi-filetype-csv',           color: '#15803d' },
  'image/jpeg':    { icon: 'bi-file-earmark-image-fill',color: '#7c3aed' },
  'image/png':     { icon: 'bi-file-earmark-image-fill',color: '#7c3aed' },
  'image/gif':     { icon: 'bi-file-earmark-image-fill',color: '#7c3aed' },
  'image/webp':    { icon: 'bi-file-earmark-image-fill',color: '#7c3aed' },
  'application/zip':              { icon: 'bi-file-earmark-zip-fill', color: '#d97706' },
  'application/x-zip-compressed':{ icon: 'bi-file-earmark-zip-fill', color: '#d97706' },
};

const PREVIEWABLE_IMAGES = ['image/jpeg','image/png','image/gif','image/webp'];
const isImage     = (mime) => PREVIEWABLE_IMAGES.includes(mime);
const isPDF       = (mime) => mime === 'application/pdf';
const isText      = (mime) => mime === 'text/plain' || mime === 'text/csv';
const canPreview  = (mime) => isImage(mime) || isPDF(mime) || isText(mime);

const getFileInfo = (mime) => FILE_ICONS[mime] || { icon: 'bi-file-earmark-fill', color: '#6b7280' };
const formatBytes = (b) => {
  if (!b) return '—';
  if (b < 1024)        return `${b} B`;
  if (b < 1024*1024)   return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1024/1024).toFixed(1)} MB`;
};
const formatDate  = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB',{ day:'2-digit', month:'short', year:'numeric' }) : '—';
const isExpired   = (d) => d && new Date(d) < new Date();
const isExpiring  = (d) => {
  if (!d) return false;
  const diff = new Date(d) - new Date();
  return diff > 0 && diff < 30*24*60*60*1000;
};

// ── Helpers: download & preview blob ─────────────────────────────────────────
const triggerDownload = (blobData, filename) => {
  const url = window.URL.createObjectURL(new Blob([blobData]));
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  const map = {
    success:{ bg:'#f0fdf4',border:'#bbf7d0',text:'#166534',icon:'bi-check-circle-fill',ic:'#16a34a' },
    error:  { bg:'#fef2f2',border:'#fecaca',text:'#991b1b',icon:'bi-x-circle-fill',    ic:'#dc2626' },
    info:   { bg:'#eff6ff',border:'#bfdbfe',text:'#1e40af',icon:'bi-info-circle-fill', ic:'#2563eb' },
  };
  const c = map[toast.type] || map.info;
  return (
    <div className="od-toast" style={{ background:c.bg, border:`1px solid ${c.border}`, color:c.text }}>
      <i className={`bi ${c.icon}`} style={{ color:c.ic, fontSize:18 }} />
      <span>{toast.message}</span>
      <button onClick={onClose}><i className="bi bi-x" /></button>
    </div>
  );
}

// ── File Preview Modal ────────────────────────────────────────────────────────
function PreviewModal({ doc, apiModule, onClose, onDownload, onEdit, onDelete, canManage }) {
  const [blobUrl,       setBlobUrl]       = useState(null);
  const [textContent,   setTextContent]   = useState('');
  const [previewState,  setPreviewState]  = useState('loading'); // loading | ready | error | unsupported
  const urlRef = useRef(null);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;

    const load = async () => {
      setPreviewState('loading');
      setBlobUrl(null);
      setTextContent('');

      if (!canPreview(doc.mimeType)) {
        setPreviewState('unsupported');
        return;
      }

      try {
        const res = await apiModule.preview(doc._id);
        if (cancelled) return;

        const blob = new Blob([res.data], { type: doc.mimeType });

        if (isText(doc.mimeType)) {
          const text = await blob.text();
          if (!cancelled) { setTextContent(text); setPreviewState('ready'); }
        } else {
          const url = URL.createObjectURL(blob);
          if (!cancelled) { urlRef.current = url; setBlobUrl(url); setPreviewState('ready'); }
        }
      } catch {
        if (!cancelled) setPreviewState('error');
      }
    };

    load();
    return () => {
      cancelled = true;
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, [doc, apiModule]);

  if (!doc) return null;
  const fi  = getFileInfo(doc.mimeType);

  return (
    <div className="od-modal-backdrop od-preview-backdrop" onClick={onClose}>
      <div className="od-preview-shell" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="od-preview-header">
          <div className="od-preview-title-wrap">
            <div className="od-preview-file-icon" style={{ background: fi.color+'18' }}>
              <i className={`bi ${fi.icon}`} style={{ color: fi.color }} />
            </div>
            <div>
              <h3 className="od-preview-title">{doc.title}</h3>
              <p className="od-preview-meta">{doc.originalName} · {formatBytes(doc.size)}</p>
            </div>
          </div>

          <div className="od-preview-actions">
            <button className="od-prev-btn download" title="Download" onClick={() => onDownload(doc)}>
              <i className="bi bi-download" /> Download
            </button>
            {canManage && (
              <>
                <button className="od-prev-btn edit" title="Edit" onClick={() => { onClose(); onEdit(doc); }}>
                  <i className="bi bi-pencil-square" />
                </button>
                <button className="od-prev-btn danger" title="Delete" onClick={() => { onClose(); onDelete(doc); }}>
                  <i className="bi bi-trash3" />
                </button>
              </>
            )}
            <button className="od-prev-btn close-btn" title="Close" onClick={onClose}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>

        {/* ── Preview Area ── */}
        <div className="od-preview-body">
          {previewState === 'loading' && (
            <div className="od-preview-placeholder">
              <div className="od-spinner lg" />
              <p>Loading preview…</p>
            </div>
          )}

          {previewState === 'error' && (
            <div className="od-preview-placeholder">
              <i className="bi bi-exclamation-triangle-fill" style={{ fontSize:48, color:'#f59e0b' }} />
              <p>Could not load preview.</p>
              <button className="od-btn od-btn-primary" onClick={() => onDownload(doc)}>
                <i className="bi bi-download" /> Download Instead
              </button>
            </div>
          )}

          {previewState === 'unsupported' && (
            <div className="od-preview-placeholder">
              <i className={`bi ${fi.icon}`} style={{ fontSize:64, color:fi.color }} />
              <h4>{doc.originalName}</h4>
              <p>This file type cannot be previewed in the browser.</p>
              <p className="od-preview-hint">Download the file to view it on your device.</p>
              <button className="od-btn od-btn-primary mt-2" onClick={() => onDownload(doc)}>
                <i className="bi bi-download" /> Download File
              </button>
            </div>
          )}

          {previewState === 'ready' && isImage(doc.mimeType) && (
            <div className="od-preview-image-wrap">
              <img src={blobUrl} alt={doc.title} className="od-preview-image" />
            </div>
          )}

          {previewState === 'ready' && isPDF(doc.mimeType) && (
            <iframe
              src={blobUrl}
              className="od-preview-pdf"
              title={doc.title}
            />
          )}

          {previewState === 'ready' && isText(doc.mimeType) && (
            <div className="od-preview-text-wrap">
              <pre className="od-preview-text">{textContent}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteModal({ doc, onConfirm, onCancel, loading }) {
  if (!doc) return null;
  return (
    <div className="od-modal-backdrop" onClick={onCancel}>
      <div className="od-modal od-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="od-modal-icon-wrap danger"><i className="bi bi-trash3-fill" /></div>
        <h3>Delete Document?</h3>
        <p>Permanently delete <strong>"{doc.title}"</strong>? This cannot be undone.</p>
        <div className="od-modal-actions">
          <button className="od-btn od-btn-ghost"  onClick={onCancel}  disabled={loading}>Cancel</button>
          <button className="od-btn od-btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? <><i className="bi bi-arrow-repeat od-spin" /> Deleting…</> : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Drop Zone (shared) ────────────────────────────────────────────────────────
function DropZone({ file, setFile, currentName }) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef();
  const fi  = file ? getFileInfo(file.type) : null;

  return (
    <div
      className={`od-dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if(f) setFile(f); }}
      onClick={() => ref.current.click()}
    >
      <input
        ref={ref} type="file" style={{ display:'none' }}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.zip"
        onChange={e => setFile(e.target.files[0])}
      />
      {file ? (
        <div className="od-dropzone-file">
          <i className={`bi ${fi.icon}`} style={{ color:fi.color, fontSize:36 }} />
          <div>
            <p className="od-file-name">{file.name}</p>
            <p className="od-file-meta">{formatBytes(file.size)}</p>
          </div>
          <button className="od-file-remove" onClick={e => { e.stopPropagation(); setFile(null); }}>
            <i className="bi bi-x-circle-fill" />
          </button>
        </div>
      ) : (
        <div className="od-dropzone-empty">
          <i className="bi bi-cloud-arrow-up" />
          <p><strong>Drop file here</strong> or click to browse</p>
          <span>PDF, Word, Excel, Images, ZIP — Max 25 MB</span>
          {currentName && <span className="od-current-file">Current: <strong>{currentName}</strong></span>}
        </div>
      )}
    </div>
  );
}

// ── Upload / Edit Modal ───────────────────────────────────────────────────────
function DocumentFormModal({ mode, doc, isPersonal, onClose, onSuccess }) {
  const catList = isPersonal
    ? PERSONAL_CATEGORIES.filter(c => c !== 'All')
    : OFFICE_CATEGORIES.filter(c => c !== 'All');

  const [form, setForm] = useState({
    title:       doc?.title       || '',
    description: doc?.description || '',
    category:    doc?.category    || (isPersonal ? 'Other' : 'General'),
    department:  doc?.department  || 'All',
    tags:        doc?.tags?.join(', ') || '',
    expiryDate:  doc?.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : '',
    isActive:    doc?.isActive !== undefined ? doc.isActive : true,
  });
  const [file,    setFile]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const isEdit = mode === 'edit';
  const api    = isPersonal ? personalDocumentAPI : officeDocumentAPI;

  const change = (field) => (e) =>
    setForm(p => ({ ...p, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async () => {
    if (!form.title.trim())  { setError('Title is required.');    return; }
    if (!isEdit && !file)    { setError('Please select a file.'); return; }
    setError(''); setLoading(true);

    try {
      const fd = new FormData();
      fd.append('title',       form.title.trim());
      fd.append('description', form.description);
      fd.append('category',    form.category);
      if (!isPersonal) {
        fd.append('department',  form.department);
        fd.append('tags',        form.tags);
        fd.append('expiryDate',  form.expiryDate);
        fd.append('isActive',    form.isActive);
      }
      if (file) fd.append('documentFile', file);

      isEdit ? await api.update(doc._id, fd) : await api.create(fd);
      onSuccess(isEdit ? 'Document updated!' : 'Document uploaded!');
    } catch (err) {
      setError(err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="od-modal-backdrop" onClick={onClose}>
      <div className="od-modal od-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="od-modal-header">
          <div className="od-modal-title-group">
            <div className={`od-modal-icon-wrap ${isEdit ? 'edit' : isPersonal ? 'personal' : 'primary'}`}>
              <i className={`bi ${isEdit ? 'bi-pencil-square' : isPersonal ? 'bi-person-lock' : 'bi-cloud-arrow-up-fill'}`} />
            </div>
            <div>
              <h3>{isEdit ? 'Edit Document' : isPersonal ? 'Upload Personal Document' : 'Upload Office Document'}</h3>
              <p>
                {isEdit
                  ? 'Update details or replace the file'
                  : isPersonal
                    ? 'Only you can see this document'
                    : 'Add to the company document library'}
              </p>
            </div>
          </div>
          <button className="od-modal-close" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>

        <div className="od-modal-body">
          {error && (
            <div className="od-alert od-alert-error">
              <i className="bi bi-exclamation-triangle-fill" /> {error}
            </div>
          )}

          {isPersonal && (
            <div className="od-personal-notice">
              <i className="bi bi-lock-fill" />
              <span>This document is <strong>private</strong> — only you can view, download, or delete it.</span>
            </div>
          )}

          <DropZone file={file} setFile={setFile} currentName={isEdit ? doc?.originalName : null} />

          <div className="od-form-grid">
            <div className="od-form-group od-col-full">
              <label>Document Title <span className="od-required">*</span></label>
              <input type="text" placeholder="e.g. Aadhar Card" value={form.title} onChange={change('title')} />
            </div>
            <div className="od-form-group od-col-full">
              <label>Description</label>
              <textarea rows={2} placeholder="Brief description…" value={form.description} onChange={change('description')} />
            </div>
            <div className="od-form-group">
              <label>Category <span className="od-required">*</span></label>
              <select value={form.category} onChange={change('category')}>
                {catList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {!isPersonal && (
              <>
                <div className="od-form-group">
                  <label>Department</label>
                  <select value={form.department} onChange={change('department')}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="od-form-group">
                  <label>Expiry Date <span className="od-hint">(optional)</span></label>
                  <input type="date" value={form.expiryDate} onChange={change('expiryDate')} />
                </div>
                <div className="od-form-group">
                  <label>Tags <span className="od-hint">(comma-separated)</span></label>
                  <input type="text" placeholder="e.g. policy, 2025" value={form.tags} onChange={change('tags')} />
                </div>
                {isEdit && (
                  <div className="od-form-group od-col-full">
                    <label className="od-toggle-label">
                      <div className="od-toggle-switch">
                        <input type="checkbox" checked={form.isActive} onChange={change('isActive')} />
                        <span className="od-toggle-slider" />
                      </div>
                      <span>{form.isActive ? 'Active — visible to all employees' : 'Inactive — hidden'}</span>
                    </label>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="od-modal-footer">
          <button className="od-btn od-btn-ghost"   onClick={onClose}  disabled={loading}>Cancel</button>
          <button className="od-btn od-btn-primary"  onClick={submit}   disabled={loading}>
            {loading
              ? <><i className="bi bi-arrow-repeat od-spin" /> {isEdit ? 'Saving…' : 'Uploading…'}</>
              : <><i className={`bi ${isEdit ? 'bi-check-lg' : 'bi-cloud-arrow-up'}`} /> {isEdit ? 'Save Changes' : 'Upload'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Document Card ─────────────────────────────────────────────────────────────
function DocumentCard({ doc, catMeta, onPreview, onEdit, onDelete, onDownload, canManage }) {
  const fi  = getFileInfo(doc.mimeType);
  const cat = catMeta[doc.category] || catMeta['General'] || catMeta['Other'];
  const expired  = isExpired(doc.expiryDate);
  const expiring = isExpiring(doc.expiryDate);

  return (
    <div className={`od-card ${!doc.isActive ? 'od-card-inactive' : ''}`}>
      {expired  && <div className="od-card-strip expired" />}
      {expiring && !expired && <div className="od-card-strip expiring" />}

      <div className="od-card-top">
        <div className="od-card-file-icon" style={{ background: fi.color+'18' }}>
          <i className={`bi ${fi.icon}`} style={{ color: fi.color }} />
        </div>
        <div className="od-card-actions">
          {canPreview(doc.mimeType) && (
            <button className="od-card-action-btn" title="Preview" onClick={() => onPreview(doc)}>
              <i className="bi bi-eye" />
            </button>
          )}
          <button className="od-card-action-btn download-btn" title="Download" onClick={() => onDownload(doc)}>
            <i className="bi bi-download" />
          </button>
          {canManage && (
            <>
              <button className="od-card-action-btn" title="Edit" onClick={() => onEdit(doc)}>
                <i className="bi bi-pencil" />
              </button>
              <button className="od-card-action-btn danger" title="Delete" onClick={() => onDelete(doc)}>
                <i className="bi bi-trash3" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="od-card-body" onClick={() => onPreview(doc)} style={{ cursor:'pointer' }}>
        <span className="od-cat-badge" style={{ background: cat?.bg, color: cat?.color }}>
          <i className={`bi ${cat?.icon}`} /> {doc.category}
        </span>
        <h4 className="od-card-title">{doc.title}</h4>
        {doc.description && <p className="od-card-desc">{doc.description}</p>}
      </div>

      <div className="od-card-footer">
        <div className="od-card-file-meta">
          <span className="od-filename-trim">{doc.originalName}</span>
          <span className="od-dot">·</span>
          <span>{formatBytes(doc.size)}</span>
        </div>
        <div className="od-card-bottom-row">
          <span className="od-card-date">{formatDate(doc.createdAt)}</span>
          <div className="od-pill-row">
            {!doc.isActive && <span className="od-pill inactive">Inactive</span>}
            {expired        && <span className="od-pill expired">Expired</span>}
            {expiring && !expired && <span className="od-pill expiring">Expiring</span>}
            {canPreview(doc.mimeType) && <span className="od-pill previewable"><i className="bi bi-eye-fill" /> Preview</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Document Row ──────────────────────────────────────────────────────────────
function DocumentRow({ doc, catMeta, onPreview, onEdit, onDelete, onDownload, canManage }) {
  const fi  = getFileInfo(doc.mimeType);
  const cat = catMeta[doc.category] || catMeta['General'] || catMeta['Other'];
  const expired  = isExpired(doc.expiryDate);
  const expiring = isExpiring(doc.expiryDate);

  return (
    <tr className={`od-table-row ${!doc.isActive ? 'od-row-inactive' : ''}`}>
      <td onClick={() => onPreview(doc)} style={{ cursor:'pointer' }}>
        <div className="od-row-file">
          <div className="od-row-file-icon" style={{ background: fi.color+'18' }}>
            <i className={`bi ${fi.icon}`} style={{ color: fi.color }} />
          </div>
          <div>
            <p className="od-row-title">{doc.title}</p>
            <p className="od-row-filename">{doc.originalName}</p>
          </div>
        </div>
      </td>
      <td>
        <span className="od-cat-badge" style={{ background: cat?.bg, color: cat?.color }}>
          <i className={`bi ${cat?.icon}`} /> {doc.category}
        </span>
      </td>
      <td className="od-cell-dim">{doc.department || '—'}</td>
      <td className="od-cell-dim">{formatBytes(doc.size)}</td>
      <td>
        {expired        ? <span className="od-pill expired">Expired</span>
         : expiring     ? <span className="od-pill expiring">Expiring</span>
         : !doc.isActive? <span className="od-pill inactive">Inactive</span>
                        : <span className="od-pill active">Active</span>}
      </td>
      <td className="od-cell-dim">{formatDate(doc.createdAt)}</td>
      <td>
        <div className="od-row-actions">
          {canPreview(doc.mimeType) && (
            <button className="od-row-btn" title="Preview"  onClick={() => onPreview(doc)}><i className="bi bi-eye" /></button>
          )}
          <button className="od-row-btn download-btn" title="Download" onClick={() => onDownload(doc)}>
            <i className="bi bi-download" />
          </button>
          {canManage && (
            <>
              <button className="od-row-btn"        title="Edit"   onClick={() => onEdit(doc)}><i className="bi bi-pencil" /></button>
              <button className="od-row-btn danger" title="Delete" onClick={() => onDelete(doc)}><i className="bi bi-trash3" /></button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Shared Document List Panel (used by both tabs) ────────────────────────────
function DocumentPanel({
  documents, loading, viewMode, setViewMode,
  catMeta, categories, departments, showDeptFilter,
  onSearch, onCatFilter, catFilter, setCatFilter,
  onPreview, onEdit, onDelete, onDownload,
  canManage, emptyMsg, onUpload,
  showInactive, setShowInactive,
}) {
  return (
    <>
      {/* Filter bar */}
      <div className="od-filter-bar">
        <div className="od-search-wrap">
          <i className="bi bi-search od-search-icon" />
          <input type="text" placeholder="Search documents…" onChange={e => onSearch(e.target.value)} />
        </div>
        <select className="od-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
        </select>
        {showDeptFilter && (
          <select className="od-select" onChange={e => onSearch(e.target.value, e.target.value)}>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>)}
          </select>
        )}
        {canManage && setShowInactive && (
          <label className="od-toggle-label od-inline-toggle">
            <div className="od-toggle-switch sm">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
              <span className="od-toggle-slider" />
            </div>
            <span>Show Inactive</span>
          </label>
        )}
        <div className="od-view-toggles">
          <button className={`od-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><i className="bi bi-grid-fill" /></button>
          <button className={`od-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><i className="bi bi-list-ul" /></button>
        </div>
      </div>

      {/* Category quick-tabs */}
      <div className="od-cat-tabs">
        {categories.map(c => {
          const meta = c === 'All' ? null : catMeta[c];
          return (
            <button
              key={c}
              className={`od-cat-tab ${catFilter === c ? 'active' : ''}`}
              style={catFilter === c && meta ? { background: meta.bg, color: meta.color, borderColor: meta.color } : {}}
              onClick={() => setCatFilter(c)}
            >
              {meta && <i className={`bi ${meta.icon}`} />} {c}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="od-loading"><div className="od-spinner" /><p>Loading…</p></div>
      ) : documents.length === 0 ? (
        <div className="od-empty">
          <div className="od-empty-icon">📂</div>
          <h3>No Documents Found</h3>
          <p>{emptyMsg}</p>
          {onUpload && (
            <button className="od-btn od-btn-primary mt-3" onClick={onUpload}>
              <i className="bi bi-cloud-arrow-up-fill" /> Upload First Document
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="od-grid">
          {documents.map(doc => (
            <DocumentCard
              key={doc._id} doc={doc} catMeta={catMeta}
              onPreview={onPreview} onEdit={onEdit} onDelete={onDelete} onDownload={onDownload}
              canManage={canManage}
            />
          ))}
        </div>
      ) : (
        <div className="od-table-wrap">
          <table className="od-table">
            <thead>
              <tr>
                <th>Document</th><th>Category</th>
                {showDeptFilter && <th>Department</th>}
                <th>Size</th><th>Status</th><th>Uploaded</th><th className="od-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <DocumentRow
                  key={doc._id} doc={doc} catMeta={catMeta}
                  onPreview={onPreview} onEdit={onEdit} onDelete={onDelete} onDownload={onDownload}
                  canManage={canManage}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && documents.length > 0 && (
        <p className="od-result-count">Showing <strong>{documents.length}</strong> document{documents.length !== 1 ? 's' : ''}</p>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Main Component ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function UploadOfficeDocument() {
  const { user } = useSelector(state => state.auth);
  const canManage = user?.role === 'admin' || user?.role === 'hr';

  const [activeTab, setActiveTab] = useState('office'); // 'office' | 'personal'

  // ── Office state ──────────────────────────────────────────────────────────
  const [officeDocs,    setOfficeDocs]    = useState([]);
  const [officeStats,   setOfficeStats]   = useState(null);
  const [officeLoading, setOfficeLoading] = useState(true);
  const [officeCat,     setOfficeCat]     = useState('All');
  const [officeDept,    setOfficeDept]    = useState('All');
  const [officeSearch,  setOfficeSearch]  = useState('');
  const [showInactive,  setShowInactive]  = useState(false);
  const [officeView,    setOfficeView]    = useState('grid');

  // ── Personal state ────────────────────────────────────────────────────────
  const [personalDocs,    setPersonalDocs]    = useState([]);
  const [personalStats,   setPersonalStats]   = useState(null);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [personalCat,     setPersonalCat]     = useState('All');
  const [personalSearch,  setPersonalSearch]  = useState('');
  const [personalView,    setPersonalView]    = useState('grid');

  // ── Shared modal state ────────────────────────────────────────────────────
  const [modal,        setModal]       = useState(null); // 'upload-office'|'upload-personal'|'edit'|'delete'|'preview'
  const [selectedDoc,  setSelectedDoc] = useState(null);
  const [isPersonalDoc, setIsPersonalDoc] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => setToast({ message, type });

  // ── Search debounce refs ──────────────────────────────────────────────────
  const officeSearchRef   = useRef();
  const personalSearchRef = useRef();

  // ── Fetch office docs ─────────────────────────────────────────────────────
  const fetchOfficeDocs = useCallback(async () => {
    try {
      setOfficeLoading(true);
      const params = {};
      if (officeCat  !== 'All') params.category   = officeCat;
      if (officeDept !== 'All') params.department  = officeDept;
      if (officeSearch)         params.search      = officeSearch;
      if (!showInactive)        params.isActive    = true;
      const res = await officeDocumentAPI.getAll(params);
      setOfficeDocs(res.data?.data || []);
    } catch { showToast('Failed to load office documents.', 'error'); }
    finally { setOfficeLoading(false); }
  }, [officeCat, officeDept, officeSearch, showInactive]);

  const fetchOfficeStats = useCallback(async () => {
    try { const r = await officeDocumentAPI.getStats(); setOfficeStats(r.data?.data); } catch {}
  }, []);

  // ── Fetch personal docs ───────────────────────────────────────────────────
  const fetchPersonalDocs = useCallback(async () => {
    try {
      setPersonalLoading(true);
      const params = {};
      if (personalCat    !== 'All') params.category = personalCat;
      if (personalSearch)           params.search   = personalSearch;
      const res = await personalDocumentAPI.getAll(params);
      setPersonalDocs(res.data?.data || []);
    } catch { showToast('Failed to load personal documents.', 'error'); }
    finally { setPersonalLoading(false); }
  }, [personalCat, personalSearch]);

  const fetchPersonalStats = useCallback(async () => {
    try { const r = await personalDocumentAPI.getStats(); setPersonalStats(r.data?.data); } catch {}
  }, []);

  useEffect(() => { fetchOfficeDocs();   }, [fetchOfficeDocs]);
  useEffect(() => { fetchOfficeStats();  }, [fetchOfficeStats]);
  useEffect(() => { fetchPersonalDocs(); }, [fetchPersonalDocs]);
  useEffect(() => { fetchPersonalStats();}, [fetchPersonalStats]);

  // ── Download handler (works for both) ────────────────────────────────────
  const handleDownload = async (doc, isPersonal = false) => {
    try {
      const api = isPersonal ? personalDocumentAPI : officeDocumentAPI;
      const res = await api.download(doc._id);
      triggerDownload(res.data, doc.originalName);
      showToast('Download started!', 'info');
    } catch {
      showToast('Download failed. Please try again.', 'error');
    }
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const closeModal = () => { setModal(null); setSelectedDoc(null); setIsPersonalDoc(false); };

  const openPreview = (doc, isPersonal) => {
    setSelectedDoc(doc); setIsPersonalDoc(isPersonal); setModal('preview');
  };
  const openEdit = (doc, isPersonal) => {
    setSelectedDoc(doc); setIsPersonalDoc(isPersonal); setModal('edit');
  };
  const openDelete = (doc, isPersonal) => {
    setSelectedDoc(doc); setIsPersonalDoc(isPersonal); setModal('delete');
  };

  const handleFormSuccess = (msg) => {
    closeModal();
    showToast(msg);
    if (isPersonalDoc) { fetchPersonalDocs(); fetchPersonalStats(); }
    else               { fetchOfficeDocs();   fetchOfficeStats();   }
  };

  const handleDelete = async () => {
    if (!selectedDoc) return;
    try {
      setDeleteLoading(true);
      const api = isPersonalDoc ? personalDocumentAPI : officeDocumentAPI;
      await api.delete(selectedDoc._id);
      closeModal();
      showToast('Document deleted.');
      if (isPersonalDoc) { fetchPersonalDocs(); fetchPersonalStats(); }
      else               { fetchOfficeDocs();   fetchOfficeStats();   }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Delete failed.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Stats cards data ──────────────────────────────────────────────────────
  const officeStatCards = [
    { label:'Total Documents', value: officeStats?.total ?? '—', icon:'bi-folder2-open', color:'#6f5edb', bg:'#f0eeff' },
    ...(['HR Policy','Compliance','Finance','Legal'].map(cat => ({
      label: cat, icon: OFFICE_CAT_META[cat]?.icon,
      color: OFFICE_CAT_META[cat]?.color, bg: OFFICE_CAT_META[cat]?.bg,
      value: officeStats?.byCategory?.find(b => b._id === cat)?.count ?? 0,
    }))),
  ];

  const personalStatCards = [
    { label:'My Documents', value: personalStats?.total ?? '—', icon:'bi-person-lines-fill', color:'#6f5edb', bg:'#f0eeff' },
    ...(['Identity','Education','Experience','Financial'].map(cat => ({
      label: cat, icon: PERSONAL_CAT_META[cat]?.icon,
      color: PERSONAL_CAT_META[cat]?.color, bg: PERSONAL_CAT_META[cat]?.bg,
      value: personalStats?.byCategory?.find(b => b._id === cat)?.count ?? 0,
    }))),
  ];

  const statCards = activeTab === 'office' ? officeStatCards : personalStatCards;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="od-page">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* ── Header ── */}
      <div className="od-header">
        <div>
          <h1>
            <i className={activeTab === 'office' ? 'bi bi-folder2-open' : 'bi bi-person-lock'} />
            {activeTab === 'office' ? 'Office Documents' : 'My Documents'}
          </h1>
          <p>
            {activeTab === 'office'
              ? 'Company-wide policies, guidelines, and resources'
              : 'Your private documents — only you can see these'}
          </p>
        </div>
        <div className="od-header-btns">
          {activeTab === 'office' && canManage && (
            <button className="od-btn od-btn-primary" onClick={() => setModal('upload-office')}>
              <i className="bi bi-cloud-arrow-up-fill" /> Upload Document
            </button>
          )}
          {activeTab === 'personal' && (
            <button className="od-btn od-btn-personal" onClick={() => setModal('upload-personal')}>
              <i className="bi bi-person-plus-fill" /> Upload Personal Doc
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="od-tab-bar">
        <button
          className={`od-tab ${activeTab === 'office' ? 'active' : ''}`}
          onClick={() => setActiveTab('office')}
        >
          <i className="bi bi-building" />
          Office Documents
          {officeStats?.total > 0 && <span className="od-tab-count">{officeStats.total}</span>}
        </button>
        <button
          className={`od-tab ${activeTab === 'personal' ? 'active personal' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          <i className="bi bi-person-lock" />
          My Documents
          {personalStats?.total > 0 && <span className="od-tab-count personal-count">{personalStats.total}</span>}
        </button>
      </div>

      {/* ── Stats Cards ── */}
      <div className="od-stats-row">
        {statCards.map(s => (
          <div className="od-stat-card" key={s.label}>
            <div className="od-stat-icon" style={{ background: s.bg, color: s.color }}>
              <i className={`bi ${s.icon}`} />
            </div>
            <div>
              <p className="od-stat-label">{s.label}</p>
              <h3 className="od-stat-value">{s.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'office' ? (
        <DocumentPanel
          documents={officeDocs}
          loading={officeLoading}
          viewMode={officeView}
          setViewMode={setOfficeView}
          catMeta={OFFICE_CAT_META}
          categories={OFFICE_CATEGORIES}
          departments={DEPARTMENTS}
          showDeptFilter
          onSearch={(val) => {
            clearTimeout(officeSearchRef.current);
            officeSearchRef.current = setTimeout(() => setOfficeSearch(val), 350);
          }}
          catFilter={officeCat}
          setCatFilter={setOfficeCat}
          onPreview={doc => openPreview(doc, false)}
          onEdit={doc   => openEdit(doc, false)}
          onDelete={doc => openDelete(doc, false)}
          onDownload={doc => handleDownload(doc, false)}
          canManage={canManage}
          showInactive={showInactive}
          setShowInactive={canManage ? setShowInactive : null}
          emptyMsg={canManage
            ? 'Get started by uploading your first office document.'
            : 'No documents have been published yet.'}
          onUpload={canManage ? () => setModal('upload-office') : null}
        />
      ) : (
        <DocumentPanel
          documents={personalDocs}
          loading={personalLoading}
          viewMode={personalView}
          setViewMode={setPersonalView}
          catMeta={PERSONAL_CAT_META}
          categories={PERSONAL_CATEGORIES}
          showDeptFilter={false}
          onSearch={(val) => {
            clearTimeout(personalSearchRef.current);
            personalSearchRef.current = setTimeout(() => setPersonalSearch(val), 350);
          }}
          catFilter={personalCat}
          setCatFilter={setPersonalCat}
          onPreview={doc => openPreview(doc, true)}
          onEdit={doc   => openEdit(doc, true)}
          onDelete={doc => openDelete(doc, true)}
          onDownload={doc => handleDownload(doc, true)}
          canManage={true} // owner can always manage their own
          emptyMsg="Upload your personal documents — only you can see them."
          onUpload={() => setModal('upload-personal')}
        />
      )}

      {/* ── Personal tab: privacy notice ── */}
      {activeTab === 'personal' && (
        <div className="od-privacy-banner">
          <i className="bi bi-shield-lock-fill" />
          <div>
            <strong>Your documents are private.</strong>
            <span> No other employee or manager can view, search, or download your personal documents.</span>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {(modal === 'upload-office' || modal === 'upload-personal') && (
        <DocumentFormModal
          mode="upload"
          isPersonal={modal === 'upload-personal'}
          onClose={closeModal}
          onSuccess={handleFormSuccess}
        />
      )}

      {modal === 'edit' && selectedDoc && (
        <DocumentFormModal
          mode="edit"
          doc={selectedDoc}
          isPersonal={isPersonalDoc}
          onClose={closeModal}
          onSuccess={handleFormSuccess}
        />
      )}

      {modal === 'delete' && (
        <DeleteModal
          doc={selectedDoc}
          onConfirm={handleDelete}
          onCancel={closeModal}
          loading={deleteLoading}
        />
      )}

      {modal === 'preview' && selectedDoc && (
        <PreviewModal
          doc={selectedDoc}
          apiModule={isPersonalDoc ? personalDocumentAPI : officeDocumentAPI}
          onClose={closeModal}
          onDownload={doc => handleDownload(doc, isPersonalDoc)}
          onEdit={doc   => openEdit(doc, isPersonalDoc)}
          onDelete={doc => openDelete(doc, isPersonalDoc)}
          canManage={isPersonalDoc ? true : canManage}
        />
      )}
    </div>
  );
}

export default UploadOfficeDocument;