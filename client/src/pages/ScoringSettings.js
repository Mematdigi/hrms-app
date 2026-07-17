// src/pages/ScoringSettings.js
//
// SCORING RULES ENGINE — admin only.
//
// Every weight in the 100-point system is editable here. Nothing is hardcoded
// in the scoring service: it reads these values at compute time, so HR policy
// can change without a redeploy.

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Save, RotateCcw, AlertCircle, Info } from 'lucide-react';
import { scoringAPI } from '../services/api';

// Grouped so the admin sees the rules the way the policy document describes them
const SECTIONS = [
  {
    title: 'Bucket Caps',
    sub: 'The maximum points available in each of the four buckets. These should add up to 100.',
    fields: [
      { key: 'taskSheetMax',      label: 'Task Sheet max' },
      { key: 'behaviourMax',      label: 'Behaviour max' },
      { key: 'attendanceMax',     label: 'Leaves & Punctuality max' },
      { key: 'recommendationMax', label: 'Recommendations max' },
    ],
  },
  {
    title: 'Task Sheet (from TL Task Reports)',
    sub: 'Employees do not fill task sheets — the Team Lead logs tasks assigned vs completed. Penalties are negative numbers.',
    fields: [
      { key: 'incompleteTaskPenalty',   label: 'Per incomplete task' },
      { key: 'unfilledSheetDayPenalty', label: 'Per working day with no TL report' },
    ],
  },
  {
    title: 'Behaviour — Negative Feedback',
    sub: 'The cost of a negative feedback entry depends on who raised it.',
    fields: [
      { key: 'negFeedbackEmployee', label: 'From a peer/employee' },
      { key: 'negFeedbackTL',       label: 'From a Team Lead' },
      { key: 'negFeedbackHR',       label: 'From HR' },
      { key: 'negFeedbackManager',  label: 'From a Manager' },
    ],
  },
  {
    title: 'Leaves & Punctuality',
    sub: 'Late arrivals and unpaid leave deductions.',
    fields: [
      { key: 'lateArrivalPenalty',  label: 'Late arrival penalty' },
      { key: 'lateArrivalGroup',    label: 'Late arrivals per penalty group' },
      { key: 'halfDayPenalty',      label: 'Unpaid half-day' },
      { key: 'fullDayLeavePenalty', label: 'Unpaid full-day leave' },
      { key: 'noLeaveBonus',        label: 'Bonus for a leave-free month' },
    ],
  },
  {
    title: 'Recommendations & Conduct',
    sub: 'Positive contributions that add points back.',
    fields: [
      { key: 'recTL',                 label: 'Recommendation from a TL' },
      { key: 'recHR',                 label: 'Recommendation from HR' },
      { key: 'recManager',            label: 'Recommendation from a Manager' },
      { key: 'dressCodeBonus',        label: 'Dress code followed every week' },
      { key: 'weekendMeetingBonus',   label: 'Per weekend client meeting' },
    ],
  },
  {
    title: 'Nakshatra Award',
    sub: 'The cumulative, long-run award on top of the monthly score.',
    fields: [
      { key: 'nakshatraTarget',     label: 'Target points (12 × 100)' },
      { key: 'employeeOfMonthBonus', label: 'Bonus per Employee-of-Month win' },
    ],
  },
];

const ScoringSettings = () => {
  const [config, setConfig]   = useState(null);
  const [draft, setDraft]     = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [toast, setToast]     = useState(null);

  const flash = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3600);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await scoringAPI.getConfig();
      const cfg = res.data?.data || res.data;
      setConfig(cfg);
      setDraft(cfg);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the scoring rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await scoringAPI.updateConfig(draft);
      flash('success', 'Scoring rules saved — they apply from the next recalculation onward');
      load();
    } catch (err) {
      flash('error', err.response?.data?.message || 'Could not save the scoring rules');
    } finally {
      setSaving(false);
    }
  };

  const capsTotal =
    (Number(draft.taskSheetMax) || 0) +
    (Number(draft.behaviourMax) || 0) +
    (Number(draft.attendanceMax) || 0) +
    (Number(draft.recommendationMax) || 0);

  if (loading) {
    return (
      <div className="page-container scoring-settings-page">
        <div className="state-block">
          <div className="spinner" />
          <div className="state-msg">Loading the scoring rules…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container scoring-settings-page">
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
            <span className="page-title-icon"><Settings size={21} /></span>
            <h1>Scoring Rules</h1>
          </div>
          <p className="page-subtitle">
            Every weight in the 100-point system, editable without a redeploy.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn-secondary-cta" onClick={() => setDraft(config)}>
            <RotateCcw size={15} style={{ verticalAlign: -3, marginRight: 5 }} />
            Reset changes
          </button>
          <button className="btn-primary-cta" onClick={handleSave} disabled={saving}>
            <Save size={15} style={{ verticalAlign: -3, marginRight: 5 }} />
            {saving ? 'Saving…' : 'Save Rules'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card state-block error" style={{ marginBottom: 18 }}>
          <AlertCircle size={26} className="state-icon" />
          <div className="state-title">{error}</div>
          <button className="btn-outline-cta" onClick={load}>Retry</button>
        </div>
      )}

      <div className="ss-note">
        <Info size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
        <strong>Penalties are entered as negative numbers</strong> (e.g. an incomplete task is
        <code> −2</code>), bonuses as positive. Saved rules apply from the next nightly recalculation, or
        immediately if you hit <strong>Recalculate Now</strong> on the Analytics page. Months that have
        already been finalized are locked and will not change.
      </div>

      {capsTotal !== 100 && (
        <div className="ss-note" style={{ borderLeftColor: '#D32F2F', background: 'rgba(211,47,47,0.06)' }}>
          <AlertCircle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          Your bucket caps currently add up to <strong>{capsTotal}</strong>, not 100. Scores will still
          compute, but they won't be out of 100 any more.
        </div>
      )}

      {SECTIONS.map((section) => (
        <div className="ss-section" key={section.title}>
          <h3>{section.title}</h3>
          <p className="ss-sub">{section.sub}</p>

          <div className="ss-grid">
            {section.fields.map((f) => (
              <div className="form-field" key={f.key}>
                <label>{f.label}</label>
                <input
                  type="number"
                  step="0.5"
                  value={draft[f.key] ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, [f.key]: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Interpretation switches for the genuinely ambiguous rules */}
      <div className="ss-section">
        <h3>Rule Interpretation</h3>
        <p className="ss-sub">
          A few rules in the original policy were ambiguous. These switches let you pick the reading you
          want rather than baking one into the code.
        </p>

        <div className="ss-grid">
          <div className="form-field">
            <label>Late arrival mode</label>
            <select
              value={draft.lateMode || 'group'}
              onChange={(e) => setDraft({ ...draft, lateMode: e.target.value })}
            >
              <option value="group">Per group (e.g. −0.5 for every 3 lates)</option>
              <option value="flat">Flat (penalty on every late arrival)</option>
            </select>
          </div>

          <div className="form-field">
            <label>Employee-of-Month tie-break</label>
            <select
              value={draft.tieBreak || 'taskSheet'}
              onChange={(e) => setDraft({ ...draft, tieBreak: e.target.value })}
            >
              <option value="taskSheet">Higher Task Sheet score wins</option>
              <option value="attendance">Higher Attendance score wins</option>
              <option value="recommendation">More recommendations win</option>
            </select>
          </div>

          <div className="form-field">
            <label>Weekly report edit window (days)</label>
            <input
              type="number"
              min="0"
              value={draft.weeklyReportEditWindowDays ?? 3}
              onChange={(e) =>
                setDraft({ ...draft, weeklyReportEditWindowDays: Number(e.target.value) })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoringSettings;
