// src/pages/TaskReport.js
//
// TASK REPORT — owned by the TEAM LEAD.
//
//   TL view:       select a team member, a start/end date range, the number of
//                  tasks assigned and how many were completed. This is the ONLY
//                  way task data enters the system.
//   Employee view: READ-ONLY. Employees can see the task report their TL logged
//                  for them, but can never create or edit one.
//
// The 50-point Task bucket of the monthly score is computed entirely from these
// records (−2 per incomplete task, −1 per working day the TL never covered).

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  ClipboardList, Plus, Pencil, Trash2, Info, AlertCircle,
  CheckCircle2, ListChecks, TrendingUp, X, Calendar,
} from 'lucide-react';
import { taskReportAPI, hierarchyAPI } from '../services/api';

const todayISO = () => new Date().toISOString().slice(0, 10);

// Monday of the current week — the usual reporting window
const mondayISO = () => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const rateClass = (rate) => (rate >= 85 ? 'high' : rate >= 60 ? 'mid' : 'low');

const EMPTY_FORM = {
  employee: '',
  startDate: mondayISO(),
  endDate: todayISO(),
  totalTasks: '',
  completedTasks: '',
  remarks: '',
};

const TaskReport = () => {
  const { user } = useSelector((state) => state.auth);
  const role = user?.role;
  const canManage = ['tl', 'manager', 'hr', 'admin'].includes(role);

  const [reports, setReports]   = useState([]);
  const [team, setTeam]         = useState([]);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);

  const [form, setForm]         = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const flash = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3800);
  };

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = canManage
        ? await taskReportAPI.getTeam()
        : await taskReportAPI.getMine();
      setReports(res.data?.data || []);
      setSummary(res.data?.summary || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load task reports');
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  const loadTeam = useCallback(async () => {
    if (!canManage) return;
    try {
      const res = await hierarchyAPI.getMyTeam();
      setTeam(res.data?.data || []);
    } catch {
      // Team roster is non-fatal — the list still renders
    }
  }, [canManage]);

  useEffect(() => {
    loadReports();
    loadTeam();
  }, [loadReports, loadTeam]);

  // ── Live preview of the score impact while the TL types ───────────────────
  const preview = useMemo(() => {
    const total     = parseInt(form.totalTasks, 10) || 0;
    const completed = parseInt(form.completedTasks, 10) || 0;
    const incomplete = Math.max(0, total - completed);
    return {
      incomplete,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      // Default weight is −2/incomplete task; admin can retune it in Scoring Settings
      impact: incomplete * -2,
    };
  }, [form.totalTasks, form.completedTasks]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.employee)   return flash('error', 'Please select a team member');
    if (!form.startDate || !form.endDate) return flash('error', 'Start and end date are required');
    if (new Date(form.startDate) > new Date(form.endDate)) {
      return flash('error', 'Start date cannot be after the end date');
    }
    const total     = parseInt(form.totalTasks, 10);
    const completed = parseInt(form.completedTasks, 10);
    if (isNaN(total) || total < 0)         return flash('error', 'Enter a valid number of tasks');
    if (isNaN(completed) || completed < 0) return flash('error', 'Enter a valid number of completed tasks');
    if (completed > total)                 return flash('error', 'Completed tasks cannot exceed total tasks');

    setSaving(true);
    try {
      const payload = { ...form, totalTasks: total, completedTasks: completed };
      if (editingId) {
        await taskReportAPI.update(editingId, payload);
        flash('success', 'Task report updated — the employee has been notified');
      } else {
        await taskReportAPI.create(payload);
        flash('success', 'Task report saved — the employee has been notified');
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      loadReports();
    } catch (err) {
      flash('error', err.response?.data?.message || 'Could not save the task report');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r) => {
    setEditingId(r._id);
    setForm({
      employee: r.employee?._id || r.employee,
      startDate: new Date(r.startDate).toISOString().slice(0, 10),
      endDate: new Date(r.endDate).toISOString().slice(0, 10),
      totalTasks: String(r.totalTasks),
      completedTasks: String(r.completedTasks),
      remarks: r.remarks || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task report? The employee\'s score will be recalculated.')) return;
    try {
      await taskReportAPI.delete(id);
      flash('success', 'Task report deleted');
      loadReports();
    } catch (err) {
      flash('error', err.response?.data?.message || 'Could not delete the task report');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  // ── Employee summary (read-only view) ─────────────────────────────────────
  const mySummary = useMemo(() => {
    if (summary) return summary;
    const s = reports.reduce((acc, r) => {
      acc.totalTasks += r.totalTasks;
      acc.completedTasks += r.completedTasks;
      acc.incompleteTasks += r.incompleteTasks;
      return acc;
    }, { totalTasks: 0, completedTasks: 0, incompleteTasks: 0 });
    s.completionRate = s.totalTasks ? Math.round((s.completedTasks / s.totalTasks) * 100) : 0;
    return s;
  }, [reports, summary]);

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="page-container task-report-page">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', top: 84, right: 22, zIndex: 9999,
            background: '#fff',
            border: `1px solid ${toast.type === 'error' ? '#D32F2F' : '#2E7D32'}`,
            borderLeft: `4px solid ${toast.type === 'error' ? '#D32F2F' : '#2E7D32'}`,
            borderRadius: 10, padding: '12px 16px', maxWidth: 380,
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)', fontSize: 13,
          }}
        >
          {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">
            <span className="page-title-icon"><ClipboardList size={21} /></span>
            <h1>Task Report</h1>
          </div>
          <p className="page-subtitle">
            {canManage
              ? 'Log tasks assigned and completed for each of your team members. This drives their 50-point Task score.'
              : 'Task reports logged for you by your Team Lead.'}
          </p>
        </div>
      </div>

      {/* Employees: make the read-only rule explicit */}
      {!canManage && (
        <div className="readonly-banner">
          <Info size={17} />
          <span>
            Your Team Lead maintains this report — it's read-only for you. If something looks
            wrong, raise it with your TL and they can revise it.
          </span>
        </div>
      )}

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      {!loading && reports.length > 0 && !canManage && (
        <div className="tr-summary-grid">
          <div className="stat-card">
            <div className="stat-icon"><ListChecks size={21} /></div>
            <div>
              <div className="stat-value">{mySummary.totalTasks}</div>
              <div className="stat-label">Tasks Assigned</div>
            </div>
          </div>
          <div className="stat-card success">
            <div className="stat-icon"><CheckCircle2 size={21} /></div>
            <div>
              <div className="stat-value">{mySummary.completedTasks}</div>
              <div className="stat-label">Completed</div>
            </div>
          </div>
          <div className="stat-card danger">
            <div className="stat-icon"><AlertCircle size={21} /></div>
            <div>
              <div className="stat-value">{mySummary.incompleteTasks}</div>
              <div className="stat-label">Incomplete</div>
            </div>
          </div>
          <div className="stat-card accent">
            <div className="stat-icon"><TrendingUp size={21} /></div>
            <div>
              <div className="stat-value">{mySummary.completionRate}%</div>
              <div className="stat-label">Completion Rate</div>
              <div className="progress-bar" style={{ width: 90 }}>
                <div
                  className={`progress-fill ${rateClass(mySummary.completionRate)}`}
                  style={{ width: `${mySummary.completionRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={canManage ? 'tr-layout' : ''}>
        {/* ── TL form ──────────────────────────────────────────────────── */}
        {canManage && (
          <div className="tr-form-card">
            <h3>{editingId ? 'Edit Task Report' : 'New Task Report'}</h3>
            <p className="tr-form-hint">
              Pick a team member and a date range, then record how many tasks were assigned
              and how many they completed.
            </p>

            <div className="form-field">
              <label>Team Member</label>
              <select
                value={form.employee}
                onChange={(e) => setForm({ ...form, employee: e.target.value })}
                disabled={!!editingId}
              >
                <option value="">Select an employee…</option>
                {team.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.firstName} {m.lastName} {m.employeeId ? `(${m.employeeId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="tr-form-row">
              <div className="form-field">
                <label>Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="tr-form-row">
              <div className="form-field">
                <label>No. of Tasks</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 12"
                  value={form.totalTasks}
                  onChange={(e) => setForm({ ...form, totalTasks: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Tasks Completed</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 10"
                  value={form.completedTasks}
                  onChange={(e) => setForm({ ...form, completedTasks: e.target.value })}
                />
              </div>
            </div>

            {/* Live score-impact preview */}
            {form.totalTasks !== '' && (
              <div className="tr-live-preview">
                <div className="tr-preview-row">
                  <span>Incomplete tasks</span>
                  <span className="tr-incomplete">{preview.incomplete}</span>
                </div>
                <div className="tr-preview-row">
                  <span>Completion rate</span>
                  <span>{preview.rate}%</span>
                </div>
                <div className="tr-preview-row">
                  <span>Task score impact</span>
                  <span className="tr-impact">
                    {preview.impact === 0 ? 'No deduction' : `${preview.impact} pts`}
                  </span>
                </div>
              </div>
            )}

            <div className="form-field">
              <label>Remarks (optional)</label>
              <textarea
                placeholder="Any context for this reporting period…"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </div>

            <div className="tr-form-actions">
              <button className="btn-primary-cta" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Update Report' : (<><Plus size={15} style={{ verticalAlign: -3, marginRight: 4 }} />Save Report</>)}
              </button>
              {editingId && (
                <button className="btn-secondary-cta" onClick={cancelEdit}>
                  <X size={15} style={{ verticalAlign: -3, marginRight: 4 }} />Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Reports list ─────────────────────────────────────────────── */}
        <div>
          {loading ? (
            <div className="table-wrap">
              <div className="state-block">
                <div className="spinner" />
                <div className="state-msg">Loading task reports…</div>
              </div>
            </div>
          ) : error ? (
            <div className="table-wrap">
              <div className="state-block error">
                <AlertCircle size={30} className="state-icon" />
                <div className="state-title">Could not load task reports</div>
                <div className="state-msg">{error}</div>
                <button className="btn-outline-cta" onClick={loadReports}>Try again</button>
              </div>
            </div>
          ) : reports.length === 0 ? (
            <div className="table-wrap">
              <div className="state-block">
                <ClipboardList size={34} className="state-icon" />
                <div className="state-title">No task reports yet</div>
                <div className="state-msg">
                  {canManage
                    ? 'Use the form to log the first task report for one of your team members.'
                    : 'Your Team Lead has not logged any task reports for you yet.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {canManage && <th>Employee</th>}
                    {!canManage && <th>Logged By</th>}
                    <th>Period</th>
                    <th>Tasks</th>
                    <th>Completed</th>
                    <th>Incomplete</th>
                    <th>Rate</th>
                    <th>Remarks</th>
                    {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r._id}>
                      {canManage ? (
                        <td>
                          <strong>{r.employee?.firstName} {r.employee?.lastName}</strong>
                          <div style={{ fontSize: 12, color: '#6B7280' }}>
                            {r.employee?.department || '—'}
                          </div>
                        </td>
                      ) : (
                        <td>
                          {r.teamLead
                            ? `${r.teamLead.firstName} ${r.teamLead.lastName}`
                            : r.teamLeadName || '—'}
                          <div style={{ fontSize: 12, color: '#6B7280' }}>Team Lead</div>
                        </td>
                      )}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Calendar size={13} style={{ verticalAlign: -2, marginRight: 5, color: '#9CA3AF' }} />
                        {fmtDate(r.startDate)} – {fmtDate(r.endDate)}
                      </td>
                      <td><strong>{r.totalTasks}</strong></td>
                      <td style={{ color: '#2E7D32', fontWeight: 600 }}>{r.completedTasks}</td>
                      <td style={{ color: r.incompleteTasks > 0 ? '#D32F2F' : '#6B7280', fontWeight: 600 }}>
                        {r.incompleteTasks}
                      </td>
                      <td style={{ minWidth: 110 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{r.completionRate}%</div>
                        <div className="progress-bar">
                          <div
                            className={`progress-fill ${rateClass(r.completionRate)}`}
                            style={{ width: `${r.completionRate}%` }}
                          />
                        </div>
                      </td>
                      <td style={{ maxWidth: 200, fontSize: 13, color: '#6B7280' }}>
                        {r.remarks || '—'}
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="btn-icon" onClick={() => handleEdit(r)} title="Edit">
                            <Pencil size={15} />
                          </button>{' '}
                          <button
                            className="btn-icon danger"
                            onClick={() => handleDelete(r._id)}
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskReport;
