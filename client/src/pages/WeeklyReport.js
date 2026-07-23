// src/pages/WeeklyReport.js
//
// TL WEEKLY REPORT.
//
//   TL view:              one card per team member for the selected week —
//                         dress code, task/behaviour notes, negative-feedback
//                         flag, recommendation, weekend client meetings.
//   HR / Manager / Admin: read-only audit view, filterable by team (TL).
//                         They can add an HR note but can NEVER silently
//                         alter what the TL submitted.
//
// Submitting a negative-feedback flag auto-creates a Feedback record; a
// recommendation auto-creates a Recommendation record. Both feed the score.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  CalendarCheck, ChevronLeft, ChevronRight, Send, AlertCircle,
  CheckCircle2, MessageSquare, Eye, Save, Users,
} from 'lucide-react';
import { weeklyReportAPI, hierarchyAPI } from '../services/api';

// Monday of the week containing `d`
const weekStart = (d) => {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const fmt = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

// Local calendar date as YYYY-MM-DD. IMPORTANT: do NOT use
// `new Date(d).toISOString().slice(0,10)` here — toISOString() converts to
// UTC first, which shifts the date backward by a day for any timezone ahead
// of UTC (e.g. IST, UTC+5:30) whenever the local time is between midnight
// and the UTC offset. weekStart() builds local midnight, so that bug would
// silently send/compare the WRONG week's date to the backend.
const iso = (d) => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const blankEntry = () => ({
  dressCodeFollowed: true,
  behaviourNotes: '',
  negativeFeedbackFlag: false,
  recommendation: '',
  weekendMeetingOccurred: false,
  weekendMeetingCount: 0,
});

// ── Notes formatting ─────────────────────────────────────────────────────
// TLs type one point per line (blank lines between points are fine — they're
// stripped out). This turns that raw text into a real bullet list instead of
// letting the browser collapse it into a single run-on paragraph.
// Lines shaped like "Label – description" get the label bolded.
const NOTE_LINE_RE = /^(.*?)\s+[–-]\s+(.*)$/;

const splitNoteLines = (text = '') =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[•*-]\s*/, '').trim())
    .filter(Boolean);

const renderNoteBullets = (text) => {
  const lines = splitNoteLines(text);
  if (lines.length === 0) return null;
  return (
    <ul className="wr-notes-list">
      {lines.map((line, i) => {
        const m = line.match(NOTE_LINE_RE);
        return (
          <li key={i}>
            {m ? (
              <>
                <strong>{m[1]}</strong> – {m[2]}
              </>
            ) : (
              line
            )}
          </li>
        );
      })}
    </ul>
  );
};

const WeeklyReport = () => {
  const { user } = useSelector((state) => state.auth);
  const role = user?.role;
  const isTL = role === 'tl';
  const isAuditor = ['hr', 'manager', 'admin'].includes(role);

  const [week, setWeek]         = useState(weekStart(new Date()));
  const [team, setTeam]         = useState([]);
  const [reports, setReports]   = useState([]);
  const [entries, setEntries]   = useState({});   // employeeId → form state
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [savingId, setSavingId] = useState(null);
  const [toast, setToast]       = useState(null);
  const [noteDraft, setNoteDraft] = useState({}); // reportId → hrNote draft
  const [teamFilter, setTeamFilter] = useState('all'); // audit view: filter by TL

  const flash = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3800);
  };

  const weekEnd = useMemo(() => addDays(week, 6), [week]);
  const isCurrentWeek = useMemo(
    () => iso(week) === iso(weekStart(new Date())),
    [week]
  );

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const calls = [weeklyReportAPI.getAll({ week: iso(week) })];
      if (isTL) calls.push(hierarchyAPI.getMyTeam());
      const res = await Promise.all(calls);

      const list = res[0].data?.data || [];
      setReports(list);
      if (isTL) setTeam(res[1].data?.data || []);

      // Prefill the form from any report already submitted for this week
      const map = {};
      list.forEach((r) => {
        const empId = r.employee?._id || r.employee;
        map[empId] = {
          dressCodeFollowed: r.dressCodeFollowed,
          behaviourNotes: r.behaviourNotes || '',
          negativeFeedbackFlag: r.negativeFeedbackFlag,
          recommendation: r.recommendation || '',
          weekendMeetingOccurred: r.weekendClientMeeting?.occurred || false,
          weekendMeetingCount: r.weekendClientMeeting?.count || 0,
          _reportId: r._id,
        };
      });
      setEntries(map);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load weekly reports');
    } finally {
      setLoading(false);
    }
  }, [week, isTL]);

  useEffect(() => { load(); }, [load]);

  // Reset the team filter whenever the week changes — the set of TLs who
  // submitted can differ from week to week, so a stale filter could hide
  // everything and look like a bug.
  useEffect(() => { setTeamFilter('all'); }, [week]);

  const getEntry = (empId) => entries[empId] || blankEntry();
  const setEntry = (empId, patch) =>
    setEntries((prev) => ({ ...prev, [empId]: { ...getEntry(empId), ...patch } }));

  // ── Submit / update one member's report ──────────────────────────────────
  const handleSubmit = async (empId) => {
    const e = getEntry(empId);
    setSavingId(empId);
    try {
      const payload = {
        employee: empId,
        weekStartDate: iso(week),
        dressCodeFollowed: e.dressCodeFollowed,
        behaviourNotes: e.behaviourNotes,
        negativeFeedbackFlag: e.negativeFeedbackFlag,
        recommendation: e.recommendation,
        weekendClientMeeting: {
          occurred: e.weekendMeetingOccurred,
          count: e.weekendMeetingOccurred ? Number(e.weekendMeetingCount) || 1 : 0,
        },
      };

      if (e._reportId) {
        await weeklyReportAPI.update(e._reportId, payload);
        flash('success', 'Weekly report updated');
      } else {
        await weeklyReportAPI.submit(payload);
        flash('success', 'Weekly report submitted — the employee and HR have been notified');
      }
      load();
    } catch (err) {
      flash('error', err.response?.data?.message || 'Could not save the weekly report');
    } finally {
      setSavingId(null);
    }
  };

  // ── HR/Manager annotate ──────────────────────────────────────────────────
  const handleAnnotate = async (reportId) => {
    const note = noteDraft[reportId];
    if (!note?.trim()) return flash('error', 'Write a note first');
    try {
      await weeklyReportAPI.annotate(reportId, { hrNote: note.trim() });
      flash('success', 'Note added — the TL\'s submission is unchanged');
      setNoteDraft((p) => ({ ...p, [reportId]: '' }));
      load();
    } catch (err) {
      flash('error', err.response?.data?.message || 'Could not add the note');
    }
  };

  const initials = (f = '', l = '') => `${f[0] || ''}${l[0] || ''}`.toUpperCase();

  // ── Team filter options, derived from whichever TLs actually submitted
  //    a report for the selected week ─────────────────────────────────────
  const teamOptions = useMemo(() => {
    const map = new Map();
    reports.forEach((r) => {
      const tlId = r.teamLead?._id || r.teamLead;
      if (!tlId) return;
      const name = `${r.teamLead?.firstName || ''} ${r.teamLead?.lastName || ''}`.trim() || 'Unnamed TL';
      if (!map.has(tlId)) map.set(tlId, name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [reports]);

  const filteredReports = useMemo(() => {
    if (teamFilter === 'all') return reports;
    return reports.filter((r) => (r.teamLead?._id || r.teamLead) === teamFilter);
  }, [reports, teamFilter]);

  const activeTeamName = teamOptions.find((t) => t.id === teamFilter)?.name;

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="page-container weekly-report-page">
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', top: 84, right: 22, zIndex: 9999,
            background: '#fff',
            border: `1px solid ${toast.type === 'error' ? '#D32F2F' : '#2E7D32'}`,
            borderLeft: `4px solid ${toast.type === 'error' ? '#D32F2F' : '#2E7D32'}`,
            borderRadius: 10, padding: '12px 16px', maxWidth: 400,
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)', fontSize: 13,
          }}
        >
          {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">
            <span className="page-title-icon"><CalendarCheck size={21} /></span>
            <h1>Weekly Report</h1>
          </div>
          <p className="page-subtitle">
            {isTL
              ? 'Submit a weekly report for each team member. This feeds the Tasks & Behaviour and Recommendations buckets of their score.'
              : 'Audit view — every weekly report submitted by your Team Leads. You can annotate, but never alter, a TL\'s submission.'}
          </p>
        </div>
      </div>

      {/* ── Week picker ────────────────────────────────────────────────── */}
      <div className="wr-week-picker">
        <div className="wr-week-nav">
          <button className="btn-icon" onClick={() => setWeek(addDays(week, -7))} title="Previous week">
            <ChevronLeft size={17} />
          </button>
          <span className="wr-week-label">
            {fmt(week)} – {fmt(weekEnd)}, {weekEnd.getFullYear()}
          </span>
          <button
            className="btn-icon"
            onClick={() => setWeek(addDays(week, 7))}
            disabled={isCurrentWeek}
            title="Next week"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {isAuditor && (
            <div className="wr-team-filter">
              <Users size={14} className="wr-team-filter-icon" />
              <select
                className="wr-team-select"
                value={teamFilter}
                onChange={(ev) => setTeamFilter(ev.target.value)}
                disabled={teamOptions.length === 0}
              >
                <option value="all">
                  All Teams {reports.length ? `(${reports.length})` : ''}
                </option>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}'s Team
                  </option>
                ))}
              </select>
            </div>
          )}

          {isCurrentWeek
            ? <span className="status-chip info">Current week</span>
            : (
              <button className="btn-secondary-cta" onClick={() => setWeek(weekStart(new Date()))}>
                Jump to current week
              </button>
            )}
        </div>
      </div>

      {loading ? (
        <div className="card state-block">
          <div className="spinner" />
          <div className="state-msg">Loading weekly reports…</div>
        </div>
      ) : error ? (
        <div className="card state-block error">
          <AlertCircle size={30} className="state-icon" />
          <div className="state-title">Could not load weekly reports</div>
          <div className="state-msg">{error}</div>
          <button className="btn-outline-cta" onClick={load}>Try again</button>
        </div>
      ) : isTL ? (
        // ══ TL: one card per team member ══════════════════════════════
        team.length === 0 ? (
          <div className="card state-block">
            <CalendarCheck size={34} className="state-icon" />
            <div className="state-title">No team members assigned to you yet</div>
            <div className="state-msg">
              Ask HR or an admin to assign team members to you on the Company Hierarchy page.
            </div>
          </div>
        ) : (
          <div className="wr-member-grid">
            {team.map((m) => {
              const e = getEntry(m._id);
              const submitted = !!e._reportId;

              return (
                <div key={m._id} className={`wr-member-card ${submitted ? 'submitted' : ''}`}>
                  <div className="wr-member-head">
                    <div className="wr-avatar">{initials(m.firstName, m.lastName)}</div>
                    <div style={{ flex: 1 }}>
                      <div className="wr-member-name">{m.firstName} {m.lastName}</div>
                      <div className="wr-member-meta">
                        {m.designation || m.department || m.employeeId || '—'}
                      </div>
                    </div>
                    {submitted
                      ? <span className="status-chip approved"><CheckCircle2 size={12} /> Submitted</span>
                      : <span className="status-chip pending">Pending</span>}
                  </div>

                  <div className="wr-toggle-row">
                    <div>
                      <div className="wr-toggle-label">Dress code followed</div>
                      <div className="wr-toggle-hint">All 4 weeks clean = +5 pts</div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={e.dressCodeFollowed}
                        onChange={(ev) => setEntry(m._id, { dressCodeFollowed: ev.target.checked })}
                      />
                      <span className="slider" />
                    </label>
                  </div>

                  <div className="wr-toggle-row">
                    <div>
                      <div className="wr-toggle-label">Flag negative feedback</div>
                      <div className="wr-toggle-hint">TL feedback = −2 pts on Behaviour</div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={e.negativeFeedbackFlag}
                        onChange={(ev) => setEntry(m._id, { negativeFeedbackFlag: ev.target.checked })}
                      />
                      <span className="slider" />
                    </label>
                  </div>

                  <div className="wr-toggle-row">
                    <div>
                      <div className="wr-toggle-label">Weekend client meeting</div>
                      <div className="wr-toggle-hint">+2 pts each</div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={e.weekendMeetingOccurred}
                        onChange={(ev) => setEntry(m._id, {
                          weekendMeetingOccurred: ev.target.checked,
                          weekendMeetingCount: ev.target.checked ? Math.max(1, e.weekendMeetingCount) : 0,
                        })}
                      />
                      <span className="slider" />
                    </label>
                  </div>

                  {e.weekendMeetingOccurred && (
                    <div className="form-field" style={{ marginTop: 11 }}>
                      <label>How many meetings?</label>
                      <input
                        type="number"
                        min="1"
                        value={e.weekendMeetingCount}
                        onChange={(ev) => setEntry(m._id, { weekendMeetingCount: ev.target.value })}
                      />
                    </div>
                  )}

                  <div className="form-field" style={{ marginTop: 13 }}>
                    <label>Task and behaviour notes</label>
                    <textarea
                      placeholder="List tasks completed and behaviour for the week — one point per line, e.g. 'Content Writing – wrote and optimized 12+ pages'"
                      value={e.behaviourNotes}
                      onChange={(ev) => setEntry(m._id, { behaviourNotes: ev.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label>Recommendation (optional)</label>
                    <textarea
                      placeholder="Recommend them for outstanding work — a TL recommendation is worth +5 pts"
                      value={e.recommendation}
                      onChange={(ev) => setEntry(m._id, { recommendation: ev.target.value })}
                    />
                  </div>

                  <button
                    className="btn-primary-cta"
                    style={{ width: '100%' }}
                    onClick={() => handleSubmit(m._id)}
                    disabled={savingId === m._id}
                  >
                    <Send size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                    {savingId === m._id
                      ? 'Saving…'
                      : submitted ? 'Update Report' : 'Submit Report'}
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : (
        // ══ HR / Manager / Admin: audit view (filterable by team) ══════
        filteredReports.length === 0 ? (
          <div className="card state-block">
            <Eye size={34} className="state-icon" />
            <div className="state-title">
              {teamFilter === 'all'
                ? 'No weekly reports for this week'
                : `No reports from ${activeTeamName || 'this team'} for this week`}
            </div>
            <div className="state-msg">
              {teamFilter === 'all'
                ? `Team Leads haven't submitted any reports for ${fmt(week)} – ${fmt(weekEnd)} yet.`
                : 'Try a different team, or switch back to "All Teams".'}
            </div>
          </div>
        ) : (
          <div className="wr-member-grid">
            {filteredReports.map((r) => (
              <div key={r._id} className="wr-member-card submitted">
                <div className="wr-member-head">
                  <div className="wr-avatar">
                    {initials(r.employee?.firstName, r.employee?.lastName)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="wr-member-name">
                      {r.employee?.firstName} {r.employee?.lastName}
                    </div>
                    <div className="wr-member-meta">
                      Submitted by {r.teamLead?.firstName} {r.teamLead?.lastName} (TL)
                    </div>
                  </div>
                </div>

                <div className="wr-toggle-row">
                  <span className="wr-toggle-label">Dress code</span>
                  <span className={`status-chip ${r.dressCodeFollowed ? 'approved' : 'rejected'}`}>
                    {r.dressCodeFollowed ? 'Followed' : 'Not followed'}
                  </span>
                </div>

                <div className="wr-toggle-row">
                  <span className="wr-toggle-label">Negative feedback</span>
                  <span className={`status-chip ${r.negativeFeedbackFlag ? 'rejected' : 'approved'}`}>
                    {r.negativeFeedbackFlag ? 'Flagged' : 'None'}
                  </span>
                </div>

                <div className="wr-toggle-row">
                  <span className="wr-toggle-label">Weekend meetings</span>
                  <span className="status-chip info">
                    {r.weekendClientMeeting?.count || 0}
                  </span>
                </div>

                {r.behaviourNotes && (
                  <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.55 }}>
                    <strong style={{ fontSize: 12, color: '#6B7280' }}>TASK AND BEHAVIOUR NOTES</strong>
                    {renderNoteBullets(r.behaviourNotes)}
                  </div>
                )}

                {r.recommendation && (
                  <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.55 }}>
                    <strong style={{ fontSize: 12, color: '#6B7280' }}>RECOMMENDATION</strong>
                    <div style={{ marginTop: 4, whiteSpace: 'pre-line' }}>{r.recommendation}</div>
                  </div>
                )}

                {r.hrNote && (
                  <div className="wr-audit-note">
                    <strong>HR note:</strong> {r.hrNote}
                  </div>
                )}

                {/* HR/Manager can annotate — never edit the TL's input */}
                <div className="form-field" style={{ marginTop: 14 }}>
                  <label>
                    <MessageSquare size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                    Add an HR note
                  </label>
                  <textarea
                    placeholder="Your note is appended — the TL's submission stays untouched."
                    value={noteDraft[r._id] || ''}
                    onChange={(e) => setNoteDraft((p) => ({ ...p, [r._id]: e.target.value }))}
                  />
                </div>
                <button
                  className="btn-secondary-cta"
                  style={{ width: '100%' }}
                  onClick={() => handleAnnotate(r._id)}
                >
                  <Save size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                  Save Note
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default WeeklyReport;